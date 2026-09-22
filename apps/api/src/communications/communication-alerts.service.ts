import { Injectable, Logger } from '@nestjs/common';
import {
  ClientUserRole,
  CommunicationChannel,
  EpiDeliveryItemStatus,
  EpiDeliveryStatus,
  Prisma,
  ServedClientStatus,
  WorkerFacialReferenceStatus,
  WorkerStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildDailyClientAlertsEmail,
  buildDailyClientAlertsWhatsapp,
  COMM_TEMPLATE_DAILY_ALERTS,
} from './communication.templates';
import { CommunicationsService } from './communications.service';
import {
  REPLACEMENT_WARN_DAYS,
  usefulLifeToBaseDays,
} from '../portal/replacement-schedule.utils';
import type { CaAlertFact, ReplacementAlertFact } from '@gestao-epi/shared';

const VALIDITY_SOON_DAYS = 90;

type Recipient = {
  name: string;
  email: string | null;
  phone: string | null;
};

function addUtcDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + Math.max(1, Math.floor(days)));
  return next;
}

function resolveLineLifeDays(input: {
  usefulLifeValue: number | null | undefined;
  usefulLifeUnit: string | null | undefined;
  quantity: number | null | undefined;
}): number | null {
  const unitDays = usefulLifeToBaseDays(
    input.usefulLifeValue,
    input.usefulLifeUnit,
  );
  if (unitDays == null || unitDays <= 0) return null;
  const qty = Math.max(1, Math.floor(input.quantity ?? 1));
  return unitDays * qty;
}

@Injectable()
export class CommunicationAlertsService {
  private readonly logger = new Logger(CommunicationAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly communications: CommunicationsService,
  ) {}

  /**
   * Varre clientes ativos e envia digest diario (EPI/CA/biometria)
   * para contato institucional + gestores e operadores do portal.
   */
  async runDailyClientAlerts(options?: {
    organizationId?: string;
    servedClientId?: string;
    /** Disparo manual de um cliente. Ignora o bloqueio do envio automatico do dia. */
    bypassDedupe?: boolean;
  }) {
    if (!this.communications.isEnabled()) {
      this.logger.debug('Alertas diarios ignorados (comunicacoes off).');
      return {
        clients: 0,
        messages: 0,
        skippedReason: 'communications_disabled' as const,
      };
    }
    if (!this.communications.isAlertsEnabled()) {
      return {
        clients: 0,
        messages: 0,
        skippedReason: 'alerts_disabled' as const,
      };
    }

    const clients = await this.prisma.servedClient.findMany({
      where: {
        status: ServedClientStatus.ACTIVE,
        ...(options?.organizationId
          ? { organizationId: options.organizationId }
          : {}),
        ...(options?.servedClientId ? { id: options.servedClientId } : {}),
      },
      select: {
        id: true,
        organizationId: true,
        legalName: true,
        tradeName: true,
        contactEmail: true,
        contactPhone: true,
      },
    });

    if (options?.servedClientId && clients.length === 0) {
      return {
        clients: 0,
        messages: 0,
        skippedReason: 'client_not_found' as const,
      };
    }

    let messages = 0;
    let lastSkip: string | undefined;
    for (const client of clients) {
      try {
        const result = await this.processClient(
          client,
          options?.bypassDedupe === true,
        );
        messages += result.queued;
        if (result.skipReason) lastSkip = result.skipReason;
      } catch (err) {
        this.logger.warn(
          `Alerta diario falhou para cliente ${client.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    this.logger.log(
      `Alertas diarios: ${clients.length} cliente(s), ${messages} mensagem(ns) enfileirada(s).`,
    );

    const skippedReason =
      clients.length === 1 && messages === 0 && lastSkip
        ? (lastSkip as
            | 'no_alerts'
            | 'no_recipients'
            | 'already_sent_today')
        : undefined;

    return { clients: clients.length, messages, skippedReason };
  }

  private async processClient(
    client: {
      id: string;
      organizationId: string;
      legalName: string;
      tradeName: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
    },
    bypassDedupe = false,
  ): Promise<{ queued: number; skipReason?: string }> {
    const metrics = await this.collectMetrics(
      client.organizationId,
      client.id,
    );
    if (
      metrics.replacements.length === 0 &&
      metrics.caAlerts.length === 0 &&
      metrics.biometricNames.length === 0
    ) {
      return { queued: 0, skipReason: 'no_alerts' };
    }

    const recipients = await this.resolveRecipients(client);
    if (recipients.length === 0) {
      this.logger.debug(
        `Cliente ${client.id} com alertas, mas sem destinatarios.`,
      );
      return { queued: 0, skipReason: 'no_recipients' };
    }

    const clientName = client.tradeName || client.legalName;
    const portalUrl = this.communications.resolvePortalUrl();
    const digestBase = {
      clientName,
      portalUrl,
      replacements: metrics.replacements,
      caAlerts: metrics.caAlerts,
      biometricNames: metrics.biometricNames,
    };

    let queued = 0;
    let deduped = 0;
    for (const recipient of recipients) {
      const content = {
        ...digestBase,
        recipientName: recipient.name,
      };
      const emailBody = buildDailyClientAlertsEmail(content);
      const whatsappBody = buildDailyClientAlertsWhatsapp(content);

      if (recipient.email) {
        const row = await this.communications.enqueueMessage({
          organizationId: client.organizationId,
          channel: CommunicationChannel.EMAIL,
          templateKey: COMM_TEMPLATE_DAILY_ALERTS,
          toAddress: recipient.email,
          subject: emailBody.subject,
          bodyText: emailBody.text,
          relatedType: 'ServedClient',
          relatedId: client.id,
          dedupePerDay: !bypassDedupe,
          payload: { kind: 'daily_alerts', clientId: client.id },
        });
        if (row?.created) queued += 1;
        else if (row) deduped += 1;
      }
      if (recipient.phone) {
        const row = await this.communications.enqueueMessage({
          organizationId: client.organizationId,
          channel: CommunicationChannel.WHATSAPP,
          templateKey: COMM_TEMPLATE_DAILY_ALERTS,
          toAddress: recipient.phone,
          bodyText: whatsappBody,
          relatedType: 'ServedClient',
          relatedId: client.id,
          dedupePerDay: !bypassDedupe,
          payload: { kind: 'daily_alerts', clientId: client.id },
        });
        if (row?.created) queued += 1;
        else if (row) deduped += 1;
      }
    }

    if (queued === 0 && deduped > 0) {
      return { queued: 0, skipReason: 'already_sent_today' };
    }
    return { queued };
  }

  private async resolveRecipients(client: {
    id: string;
    contactEmail: string | null;
    contactPhone: string | null;
    legalName: string;
  }): Promise<Recipient[]> {
    const portalRecipients = await this.prisma.clientUserMembership.findMany({
      where: {
        servedClientId: client.id,
        role: {
          in: [ClientUserRole.CLIENT_MANAGER, ClientUserRole.STOCK_OPERATOR],
        },
        isActive: true,
      },
      select: { name: true, email: true, phone: true },
    });

    const map = new Map<string, Recipient>();
    const add = (name: string, email: string | null, phone: string | null) => {
      const e = email?.trim().toLowerCase() || null;
      const p = phone?.trim() || null;
      if (!e && !p) return;
      const key = `${e ?? ''}|${p ?? ''}`;
      if (!map.has(key)) {
        map.set(key, { name: name.trim() || 'Gestor', email: e, phone: p });
      }
    };

    add(client.legalName, client.contactEmail, client.contactPhone);
    for (const m of portalRecipients) {
      add(m.name, m.email, m.phone);
    }
    return [...map.values()];
  }

  private async collectMetrics(organizationId: string, servedClientId: string) {
    const now = new Date();
    const warnHorizon = new Date(now);
    warnHorizon.setUTCDate(warnHorizon.getUTCDate() + REPLACEMENT_WARN_DAYS);
    warnHorizon.setUTCHours(23, 59, 59, 999);
    const caSoon = new Date(now);
    caSoon.setUTCDate(caSoon.getUTCDate() + VALIDITY_SOON_DAYS);

    const [deliveryItems, activeWorkers, workersWithBio, caItems] =
      await Promise.all([
        this.prisma.epiDeliveryItem.findMany({
          where: {
            status: {
              in: [
                EpiDeliveryItemStatus.DELIVERED,
                EpiDeliveryItemStatus.PARTIALLY_RETURNED,
              ],
            },
            delivery: {
              organizationId,
              servedClientId,
              status: {
                in: [
                  EpiDeliveryStatus.COMPLETED,
                  EpiDeliveryStatus.PARTIALLY_RETURNED,
                ],
              },
            },
          },
          select: {
            epiItemId: true,
            quantity: true,
            returnedQuantity: true,
            cancelledQuantity: true,
            usefulLifeValue: true,
            usefulLifeUnit: true,
            epiItem: { select: { name: true, caNumber: true } },
            delivery: {
              select: {
                id: true,
                deliveredAt: true,
                workerId: true,
                worker: { select: { name: true } },
              },
            },
          },
        }),
        this.prisma.worker.findMany({
          where: {
            organizationId,
            servedClientId,
            status: WorkerStatus.ACTIVE,
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.workerFacialReference.findMany({
          where: {
            organizationId,
            servedClientId,
            status: WorkerFacialReferenceStatus.ACTIVE,
            faceDescriptor: { not: Prisma.DbNull },
            worker: { status: WorkerStatus.ACTIVE },
          },
          distinct: ['workerId'],
          select: { workerId: true },
        }),
        this.prisma.epiItem.findMany({
          where: {
            organizationId,
            isActive: true,
            // So alerta CA de item que ainda pode ser entregue.
            // Saldo zerado ou so vinculo de PGR nao gera aviso de validade.
            stockBalances: {
              some: {
                quantity: { gt: 0 },
                stockLocation: { servedClientId, isActive: true },
              },
            },
          },
          select: {
            name: true,
            requiresCa: true,
            caNumber: true,
            caExpiresAt: true,
          },
        }),
      ]);

    // Mesma regra do painel/ficha: vida util unitaria × quantidade restante
    // na ultima entrega do par trabalhador+EPI. Nao usar nextReplacementAt
    // legado (pode ter sido gravado sem multiplicar a quantidade).
    const latestByWorkerEpi = new Map<string, Date>();
    for (const item of deliveryItems) {
      const key = `${item.delivery.workerId}:${item.epiItemId}`;
      const latest = latestByWorkerEpi.get(key);
      if (!latest || item.delivery.deliveredAt.getTime() > latest.getTime()) {
        latestByWorkerEpi.set(key, item.delivery.deliveredAt);
      }
    }

    const replacementAgg = new Map<
      string,
      {
        at: Date;
        workerName: string;
        epiName: string;
        caNumber: string | null;
      }
    >();
    for (const item of deliveryItems) {
      const workerEpiKey = `${item.delivery.workerId}:${item.epiItemId}`;
      const latest = latestByWorkerEpi.get(workerEpiKey);
      if (!latest || item.delivery.deliveredAt.getTime() !== latest.getTime()) {
        continue;
      }
      const remainingQty =
        item.quantity - item.returnedQuantity - item.cancelledQuantity;
      if (remainingQty <= 0) continue;
      const lineDays = resolveLineLifeDays({
        usefulLifeValue: item.usefulLifeValue,
        usefulLifeUnit: item.usefulLifeUnit,
        quantity: remainingQty,
      });
      if (lineDays == null) continue;
      const aggKey = `${item.delivery.id}:${item.epiItemId}`;
      const current = replacementAgg.get(aggKey);
      if (!current) {
        replacementAgg.set(aggKey, {
          at: addUtcDays(item.delivery.deliveredAt, lineDays),
          workerName: item.delivery.worker.name,
          epiName: item.epiItem.name,
          caNumber: item.epiItem.caNumber,
        });
        continue;
      }
      replacementAgg.set(aggKey, {
        ...current,
        at: addUtcDays(current.at, lineDays),
      });
    }

    const replacements: ReplacementAlertFact[] = [];
    for (const row of replacementAgg.values()) {
      if (row.at.getTime() > warnHorizon.getTime()) continue;
      replacements.push({
        workerName: row.workerName,
        epiName: row.epiName,
        caNumber: row.caNumber,
        dueAt: row.at,
      });
    }
    replacements.sort(
      (a, b) =>
        (a.dueAt instanceof Date ? a.dueAt : new Date(a.dueAt)).getTime() -
        (b.dueAt instanceof Date ? b.dueAt : new Date(b.dueAt)).getTime(),
    );

    const caAlerts: CaAlertFact[] = [];
    for (const item of caItems) {
      if (item.requiresCa && !item.caNumber) {
        caAlerts.push({
          epiName: item.name,
          caNumber: null,
          expiresAt: null,
          kind: 'missing',
          requiresCa: true,
        });
        continue;
      }
      if (!item.caExpiresAt) continue;
      if (item.caExpiresAt.getTime() < now.getTime()) {
        caAlerts.push({
          epiName: item.name,
          caNumber: item.caNumber,
          expiresAt: item.caExpiresAt,
          kind: 'expired',
          requiresCa: item.requiresCa,
        });
      } else if (item.caExpiresAt.getTime() <= caSoon.getTime()) {
        caAlerts.push({
          epiName: item.name,
          caNumber: item.caNumber,
          expiresAt: item.caExpiresAt,
          kind: 'soon',
          requiresCa: item.requiresCa,
        });
      }
    }

    const withBio = new Set(workersWithBio.map((row) => row.workerId));
    const biometricNames = activeWorkers
      .filter((worker) => !withBio.has(worker.id))
      .map((worker) => worker.name);

    return { replacements, caAlerts, biometricNames };
  }
}
