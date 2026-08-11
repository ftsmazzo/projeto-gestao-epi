import { Injectable, Logger } from '@nestjs/common';
import {
  CommunicationChannel,
  CommunicationStatus,
  OrganizationContactRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoEmailSender } from './brevo-email.sender';
import type { EmailSender, WhatsappSender } from './communication.ports';
import {
  NoopEmailSender,
  NoopWhatsappSender,
} from './communication.ports';
import {
  buildClientAccessInviteEmail,
  buildClientAccessInviteWhatsapp,
  buildFacialEnrollmentInviteWhatsapp,
  COMM_TEMPLATE_CLIENT_ACCESS_INVITE,
  COMM_TEMPLATE_FACIAL_ENROLLMENT_INVITE,
  type ClientAccessInviteInput,
  type FacialEnrollmentInviteInput,
} from './communication.templates';
import { EvolutionWhatsappSender } from './evolution-whatsapp.sender';

const MAX_ATTEMPTS = 3;

export type AccessInviteChannelStatus =
  | 'SENT'
  | 'FAILED'
  | 'PENDING'
  | 'SKIPPED'
  | 'NOT_REQUESTED';

export type AccessInviteChannelResult = {
  status: AccessInviteChannelStatus;
  error?: string | null;
  detail?: string | null;
};

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);
  private readonly emailSender: EmailSender;
  private readonly whatsappSender: WhatsappSender;

  constructor(private readonly prisma: PrismaService) {
    this.emailSender = this.isEnabled()
      ? new BrevoEmailSender()
      : new NoopEmailSender();
    this.whatsappSender = this.isEnabled()
      ? new EvolutionWhatsappSender()
      : new NoopWhatsappSender();
  }

  isEnabled() {
    return process.env.COMMUNICATIONS_ENABLED?.trim().toLowerCase() === 'true';
  }

  /** Alertas diarios ligados por padrao; pause com COMMUNICATIONS_ALERTS_ENABLED=false. */
  isAlertsEnabled() {
    return process.env.COMMUNICATIONS_ALERTS_ENABLED?.trim().toLowerCase() !== 'false';
  }

  /**
   * Enfileira e tenta entregar imediatamente o convite de acesso.
   * Falhas de envio nao derrubam o provisionamento — retornam status.
   */
  async enqueueClientAccessInvite(
    input: Omit<ClientAccessInviteInput, 'replyToEmail' | 'organizationName'> & {
      organizationName?: string;
    },
  ): Promise<{
    enabled: boolean;
    email: AccessInviteChannelStatus;
    whatsapp: AccessInviteChannelStatus;
    emailError?: string | null;
    whatsappError?: string | null;
    whatsappDetail?: string | null;
  }> {
    const enabled = this.isEnabled();
    const empty = {
      enabled,
      email: 'NOT_REQUESTED' as AccessInviteChannelStatus,
      whatsapp: 'NOT_REQUESTED' as AccessInviteChannelStatus,
    };

    try {
      const org = await this.prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { name: true },
      });
      const replyTo = await this.resolvePrimaryReplyTo(input.organizationId);
      const full: ClientAccessInviteInput = {
        ...input,
        organizationName: input.organizationName ?? org?.name ?? 'Consultoria',
        replyToEmail: replyTo,
      };

      const [emailResult, whatsappResult] = await Promise.all([
        full.recipientEmail?.trim()
          ? this.enqueueAccessEmail(full)
          : Promise.resolve({
              status: 'NOT_REQUESTED' as AccessInviteChannelStatus,
              error: null as string | null,
              detail: null as string | null,
            }),
        full.recipientPhone?.trim()
          ? this.enqueueAccessWhatsapp(full)
          : Promise.resolve({
              status: 'NOT_REQUESTED' as AccessInviteChannelStatus,
              error: null as string | null,
              detail: null as string | null,
            }),
      ]);

      return {
        enabled,
        email: emailResult.status,
        whatsapp: whatsappResult.status,
        emailError: emailResult.error ?? null,
        whatsappError: whatsappResult.error ?? null,
        whatsappDetail: whatsappResult.detail ?? null,
      };
    } catch (err) {
      this.logger.warn(
        `Falha ao enfileirar convite de acesso: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return empty;
    }
  }

  /**
   * Enfileira WhatsApp do link de cadastro facial e tenta entregar na hora.
   * Falha de envio nao invalida o link — so retorna status.
   */
  async enqueueFacialEnrollmentWhatsapp(input: {
    organizationId: string;
    workerId: string;
    linkId: string;
    phone: string | null | undefined;
    invite: FacialEnrollmentInviteInput;
  }): Promise<{
    status: AccessInviteChannelStatus | 'NO_PHONE' | 'DISABLED';
    error?: string | null;
    detail?: string | null;
  }> {
    if (!this.isEnabled()) {
      return { status: 'DISABLED' };
    }
    const phone = input.phone?.trim();
    if (!phone) {
      return { status: 'NO_PHONE' };
    }

    try {
      const text = buildFacialEnrollmentInviteWhatsapp(input.invite);
      const row = await this.prisma.communicationOutbox.create({
        data: {
          organizationId: input.organizationId,
          channel: CommunicationChannel.WHATSAPP,
          templateKey: COMM_TEMPLATE_FACIAL_ENROLLMENT_INVITE,
          toAddress: phone,
          subject: null,
          bodyText: text,
          payload: {
            workerId: input.workerId,
            linkId: input.linkId,
            enrollmentUrl: input.invite.enrollmentUrl,
          },
          relatedType: 'WorkerFacialEnrollmentLink',
          relatedId: input.linkId,
          status: CommunicationStatus.PENDING,
        },
      });
      const result = await this.deliver(row.id);
      return {
        status: result.status,
        error: result.error ?? null,
        detail: result.detail ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Falha ao enfileirar WhatsApp facial (${input.workerId}): ${message}`,
      );
      return { status: 'FAILED', error: message.slice(0, 500) };
    }
  }

  async processPending(limit = 20) {
    if (!this.isEnabled()) return { processed: 0 };

    const rows = await this.prisma.communicationOutbox.findMany({
      where: {
        status: { in: [CommunicationStatus.PENDING, CommunicationStatus.FAILED] },
        attempts: { lt: MAX_ATTEMPTS },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let processed = 0;
    for (const row of rows) {
      await this.deliver(row.id);
      processed += 1;
    }
    return { processed };
  }

  /**
   * Enfileira mensagem generica (e-mail ou WhatsApp) com dedupe diario opcional.
   */
  async enqueueMessage(input: {
    organizationId: string;
    channel: CommunicationChannel;
    templateKey: string;
    toAddress: string;
    subject?: string | null;
    bodyText: string;
    payload?: Record<string, unknown>;
    relatedType?: string | null;
    relatedId?: string | null;
    /** Se true, nao cria outro envio do mesmo template/destino/related no dia UTC. */
    dedupePerDay?: boolean;
  }): Promise<{ id: string; created: boolean } | null> {
    const toAddress = input.toAddress.trim();
    if (!toAddress) return null;

    if (input.dedupePerDay) {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const existing = await this.prisma.communicationOutbox.findFirst({
        where: {
          organizationId: input.organizationId,
          channel: input.channel,
          templateKey: input.templateKey,
          toAddress:
            input.channel === CommunicationChannel.EMAIL
              ? toAddress.toLowerCase()
              : toAddress,
          relatedType: input.relatedType ?? undefined,
          relatedId: input.relatedId ?? undefined,
          createdAt: { gte: start },
          status: {
            in: [
              CommunicationStatus.PENDING,
              CommunicationStatus.SENT,
              CommunicationStatus.SKIPPED,
            ],
          },
        },
        select: { id: true },
      });
      if (existing) return { id: existing.id, created: false };
    }

    const replyTo =
      input.channel === CommunicationChannel.EMAIL
        ? await this.resolvePrimaryReplyTo(input.organizationId)
        : null;

    const row = await this.prisma.communicationOutbox.create({
      data: {
        organizationId: input.organizationId,
        channel: input.channel,
        templateKey: input.templateKey,
        toAddress:
          input.channel === CommunicationChannel.EMAIL
            ? toAddress.toLowerCase()
            : toAddress,
        subject: input.subject ?? null,
        bodyText: input.bodyText,
        payload: {
          ...(input.payload ?? {}),
          ...(replyTo ? { replyTo } : {}),
        },
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        status: this.isEnabled()
          ? CommunicationStatus.PENDING
          : CommunicationStatus.SKIPPED,
        errorMessage: this.isEnabled()
          ? null
          : 'COMMUNICATIONS_ENABLED!=true',
      },
    });

    if (this.isEnabled()) {
      void this.deliver(row.id);
    }
    return { id: row.id, created: true };
  }

  resolvePortalUrl() {
    const fromEnv =
      process.env.CLIENT_PORTAL_URL?.trim() ||
      process.env.WEB_APP_URL?.trim() ||
      process.env.CORS_ORIGIN?.split(',')[0]?.trim();
    const base = (fromEnv || 'http://localhost:3000').replace(/\/$/, '');
    if (base.endsWith('/portal')) return base;
    if (base.endsWith('/portal/login')) return base.replace(/\/login$/, '');
    return `${base}/portal`;
  }

  private async enqueueAccessEmail(
    input: ClientAccessInviteInput,
  ): Promise<AccessInviteChannelResult> {
    const { subject, text } = buildClientAccessInviteEmail(input);
    const row = await this.prisma.communicationOutbox.create({
      data: {
        organizationId: input.organizationId,
        channel: CommunicationChannel.EMAIL,
        templateKey: COMM_TEMPLATE_CLIENT_ACCESS_INVITE,
        toAddress: input.recipientEmail!.trim().toLowerCase(),
        subject,
        bodyText: text,
        payload: {
          membershipId: input.membershipId,
          accessUrl: input.accessUrl,
          replyTo: input.replyToEmail,
        },
        relatedType: 'ClientUserMembership',
        relatedId: input.membershipId,
        status: this.isEnabled()
          ? CommunicationStatus.PENDING
          : CommunicationStatus.SKIPPED,
        errorMessage: this.isEnabled()
          ? null
          : 'COMMUNICATIONS_ENABLED!=true',
      },
    });

    if (!this.isEnabled()) return { status: 'SKIPPED' };
    return this.deliver(row.id);
  }

  private async enqueueAccessWhatsapp(
    input: ClientAccessInviteInput,
  ): Promise<AccessInviteChannelResult> {
    const text = buildClientAccessInviteWhatsapp(input);
    const row = await this.prisma.communicationOutbox.create({
      data: {
        organizationId: input.organizationId,
        channel: CommunicationChannel.WHATSAPP,
        templateKey: COMM_TEMPLATE_CLIENT_ACCESS_INVITE,
        toAddress: input.recipientPhone!.trim(),
        subject: null,
        bodyText: text,
        payload: {
          membershipId: input.membershipId,
          accessUrl: input.accessUrl,
        },
        relatedType: 'ClientUserMembership',
        relatedId: input.membershipId,
        status: this.isEnabled()
          ? CommunicationStatus.PENDING
          : CommunicationStatus.SKIPPED,
        errorMessage: this.isEnabled()
          ? null
          : 'COMMUNICATIONS_ENABLED!=true',
      },
    });

    if (!this.isEnabled()) return { status: 'SKIPPED' };
    return this.deliver(row.id);
  }

  private async deliver(outboxId: string): Promise<AccessInviteChannelResult> {
    const row = await this.prisma.communicationOutbox.findUnique({
      where: { id: outboxId },
    });
    if (!row) return { status: 'FAILED', error: 'Outbox nao encontrado' };
    if (row.status === CommunicationStatus.SENT) return { status: 'SENT' };
    if (row.status === CommunicationStatus.SKIPPED) {
      return { status: 'SKIPPED', error: row.errorMessage };
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      return { status: 'FAILED', error: row.errorMessage };
    }

    try {
      let detail: string | null = null;
      if (row.channel === CommunicationChannel.EMAIL) {
        const replyTo =
          row.payload &&
          typeof row.payload === 'object' &&
          row.payload !== null &&
          'replyTo' in row.payload
            ? String(
                (row.payload as { replyTo?: string | null }).replyTo ?? '',
              ) || null
            : null;
        await this.emailSender.sendEmail({
          to: row.toAddress,
          subject: row.subject ?? 'Gestao EPI',
          text: row.bodyText,
          replyTo,
        });
      } else if (this.whatsappSender instanceof EvolutionWhatsappSender) {
        const receipt = await this.whatsappSender.sendWhatsappWithReceipt({
          to: row.toAddress,
          text: row.bodyText,
        });
        detail = `number=${receipt.number}; msgId=${receipt.messageId}; remoteJid=${receipt.remoteJid ?? '-'}`;
      } else {
        await this.whatsappSender.sendWhatsapp({
          to: row.toAddress,
          text: row.bodyText,
        });
      }

      await this.prisma.communicationOutbox.update({
        where: { id: row.id },
        data: {
          status: CommunicationStatus.SENT,
          attempts: { increment: 1 },
          sentAt: new Date(),
          errorMessage: null,
        },
      });
      return { status: 'SENT', detail };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Envio ${row.channel} falhou (${row.id}): ${message}`);
      await this.prisma.communicationOutbox.update({
        where: { id: row.id },
        data: {
          status: CommunicationStatus.FAILED,
          attempts: { increment: 1 },
          errorMessage: message.slice(0, 500),
        },
      });
      return { status: 'FAILED', error: message.slice(0, 500) };
    }
  }

  private async resolvePrimaryReplyTo(organizationId: string) {
    const primary = await this.prisma.organizationContact.findFirst({
      where: {
        organizationId,
        isActive: true,
        email: { not: null },
        OR: [
          { isPrimary: true },
          { role: OrganizationContactRole.SUPPORT },
        ],
      },
      orderBy: [{ isPrimary: 'desc' }, { role: 'asc' }],
      select: { email: true },
    });
    return primary?.email ?? null;
  }
}
