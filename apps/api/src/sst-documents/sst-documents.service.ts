import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SstDocumentStatus,
  SstDocumentType,
  WorkerFacialReferenceStatus,
  WorkerStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { isValidFaceDescriptor } from '@gestao-epi/shared';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { stripCpf } from '../common/cpf';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildIntegrationTerm,
  buildOsTerm,
  DEFAULT_EPCS,
  DEFAULT_INTEGRATION_TOPICS,
  DEFAULT_OS_RECOMMENDATIONS,
  DEFAULT_OS_RESPONSIBILITIES,
  maskCpf,
  type SstDocumentPayload,
} from './sst-document-content';
import { SstDocumentPdfService } from './sst-document-pdf.service';

const LINK_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function getPublicWebBaseUrl(): string {
  const fromEnv = process.env.PUBLIC_WEB_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const cors = process.env.CORS_ORIGIN?.split(',')[0]?.trim();
  if (cors && cors !== '*') return cors.replace(/\/$/, '');
  return 'http://localhost:3000';
}

function buildSignUrl(token: string) {
  return `${getPublicWebBaseUrl()}/assinar/sst/${encodeURIComponent(token)}`;
}

function formatDay(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class SstDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly communications: CommunicationsService,
    private readonly pdf: SstDocumentPdfService,
  ) {}

  async getProfile(organizationId: string, servedClientId: string) {
    await this.requireClient(organizationId, servedClientId);
    const row = await this.prisma.sstClientProfile.findUnique({
      where: { servedClientId },
    });
    return {
      technicalResponsibleName: row?.technicalResponsibleName ?? '',
      technicalResponsibleRegistry: row?.technicalResponsibleRegistry ?? '',
      city: row?.city ?? '',
      integrationDurationHours: row?.integrationDurationHours ?? 2,
      integrationTime: row?.integrationTime ?? '08:00',
    };
  }

  async upsertProfile(
    organizationId: string,
    servedClientId: string,
    userId: string,
    dto: {
      technicalResponsibleName?: string;
      technicalResponsibleRegistry?: string;
      city?: string;
      integrationDurationHours?: number;
      integrationTime?: string;
    },
  ) {
    await this.requireClient(organizationId, servedClientId);
    const hours = dto.integrationDurationHours;
    if (hours != null && (!Number.isFinite(hours) || hours < 1 || hours > 24)) {
      throw new BadRequestException('Duracao da integracao deve ser entre 1 e 24 horas.');
    }
    const row = await this.prisma.sstClientProfile.upsert({
      where: { servedClientId },
      create: {
        organizationId,
        servedClientId,
        technicalResponsibleName: dto.technicalResponsibleName?.trim() || null,
        technicalResponsibleRegistry:
          dto.technicalResponsibleRegistry?.trim() || null,
        city: dto.city?.trim() || null,
        integrationDurationHours: hours ?? 2,
        integrationTime: dto.integrationTime?.trim() || '08:00',
      },
      update: {
        technicalResponsibleName:
          dto.technicalResponsibleName === undefined
            ? undefined
            : dto.technicalResponsibleName.trim() || null,
        technicalResponsibleRegistry:
          dto.technicalResponsibleRegistry === undefined
            ? undefined
            : dto.technicalResponsibleRegistry.trim() || null,
        city: dto.city === undefined ? undefined : dto.city.trim() || null,
        integrationDurationHours: hours,
        integrationTime: dto.integrationTime?.trim() || undefined,
      },
    });
    await this.audit.log({
      action: 'sst.profile.updated',
      organizationId,
      userId,
      entityType: 'SstClientProfile',
      entityId: row.id,
      metadata: { servedClientId },
    });
    return this.getProfile(organizationId, servedClientId);
  }

  async list(organizationId: string, servedClientId: string) {
    await this.requireClient(organizationId, servedClientId);
    const rows = await this.prisma.sstDocument.findMany({
      where: { organizationId, servedClientId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        worker: {
          select: { id: true, name: true, registration: true },
        },
        links: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            expiresAt: true,
            consumedAt: true,
            revokedAt: true,
          },
        },
      },
    });
    return {
      documents: rows.map((row) => this.mapRow(row)),
    };
  }

  async createAndSend(
    organizationId: string,
    servedClientId: string,
    userId: string,
    dto: { workerId: string; type: SstDocumentType },
  ) {
    const worker = await this.requireWorker(
      organizationId,
      servedClientId,
      dto.workerId,
    );
    if (stripCpf(worker.cpf ?? '').length < 4) {
      throw new BadRequestException(
        'Informe o CPF do trabalhador (pelo menos 4 digitos finais).',
      );
    }
    const face = await this.prisma.workerFacialReference.findFirst({
      where: {
        organizationId,
        workerId: worker.id,
        status: WorkerFacialReferenceStatus.ACTIVE,
      },
      select: { faceDescriptor: true },
    });
    if (!isValidFaceDescriptor(face?.faceDescriptor)) {
      throw new BadRequestException(
        'Cadastre a biometria facial do trabalhador antes de enviar o documento.',
      );
    }
    if (dto.type === SstDocumentType.ORDEM_SERVICO && !worker.clientJobFunction) {
      throw new BadRequestException(
        'Vincule o trabalhador a uma funcao para gerar a Ordem de Servico.',
      );
    }

    const payload = await this.buildPayload(
      organizationId,
      servedClientId,
      worker,
      dto.type,
    );
    const title =
      dto.type === SstDocumentType.ORDEM_SERVICO
        ? `Ordem de Servico — ${payload.worker.jobFunctionName ?? 'funcao'}`
        : 'Integracao de SST';

    const document = await this.prisma.sstDocument.create({
      data: {
        organizationId,
        servedClientId,
        workerId: worker.id,
        type: dto.type,
        status: SstDocumentStatus.PENDING_SIGNATURE,
        title,
        payload: payload as object,
        createdByUserId: userId,
      },
    });

    const sent = await this.issueLink(
      organizationId,
      servedClientId,
      userId,
      document.id,
    );

    await this.audit.log({
      action: 'sst.document.created',
      organizationId,
      userId,
      entityType: 'SstDocument',
      entityId: document.id,
      metadata: { type: dto.type, workerId: worker.id },
    });

    return sent;
  }

  async resendLink(
    organizationId: string,
    servedClientId: string,
    userId: string,
    documentId: string,
  ) {
    const document = await this.requireDocument(
      organizationId,
      servedClientId,
      documentId,
    );
    if (document.status === SstDocumentStatus.SIGNED) {
      throw new BadRequestException('Este documento ja foi assinado.');
    }
    if (document.status === SstDocumentStatus.CANCELLED) {
      throw new BadRequestException('Documento cancelado.');
    }
    return this.issueLink(organizationId, servedClientId, userId, document.id);
  }

  async getPdf(
    organizationId: string,
    servedClientId: string,
    documentId: string,
  ) {
    const document = await this.requireDocument(
      organizationId,
      servedClientId,
      documentId,
    );
    const payload = document.payload as SstDocumentPayload;
    const buffer = await this.pdf.build(
      payload,
      document.signedAt?.toISOString() ?? null,
    );
    const slug =
      document.type === SstDocumentType.ORDEM_SERVICO ? 'os' : 'integracao';
    return {
      buffer,
      fileName: `${slug}-${document.workerId.slice(-6)}.pdf`,
    };
  }

  private async issueLink(
    organizationId: string,
    servedClientId: string,
    userId: string,
    documentId: string,
  ) {
    const document = await this.prisma.sstDocument.findFirst({
      where: { id: documentId, organizationId, servedClientId },
      include: {
        worker: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!document) throw new NotFoundException('Documento nao encontrado.');

    const now = new Date();
    await this.prisma.sstDocumentLink.updateMany({
      where: {
        documentId: document.id,
        consumedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + LINK_TTL_MS);
    const link = await this.prisma.sstDocumentLink.create({
      data: {
        organizationId,
        servedClientId,
        workerId: document.workerId,
        documentId: document.id,
        tokenHash: hashToken(token),
        expiresAt,
        createdByUserId: userId,
      },
    });

    const url = buildSignUrl(token);
    const whatsapp = await this.communications.enqueueSstDocumentWhatsapp({
      organizationId,
      workerId: document.workerId,
      linkId: link.id,
      phone: document.worker.phone,
      invite: {
        workerName: document.worker.name,
        documentTitle: document.title,
        signUrl: url,
        expiresAtIso: expiresAt.toISOString(),
      },
    });

    return {
      id: document.id,
      type: document.type,
      title: document.title,
      status: document.status,
      workerId: document.workerId,
      workerName: document.worker.name,
      url,
      expiresAt: expiresAt.toISOString(),
      whatsapp: whatsapp.status,
      whatsappError: whatsapp.error ?? null,
      notice:
        whatsapp.status === 'SENT'
          ? 'WhatsApp enviado com o link de ciencia facial.'
          : whatsapp.status === 'NO_PHONE'
            ? 'Trabalhador sem telefone. Copie o link e envie manualmente.'
            : 'Link gerado. Se o WhatsApp falhar, copie e envie manualmente.',
    };
  }

  private async buildPayload(
    organizationId: string,
    servedClientId: string,
    worker: Awaited<ReturnType<SstDocumentsService['requireWorker']>>,
    type: SstDocumentType,
  ): Promise<SstDocumentPayload> {
    const [client, profile] = await Promise.all([
      this.prisma.servedClient.findFirstOrThrow({
        where: { id: servedClientId, organizationId },
        select: { legalName: true, tradeName: true, cnpj: true },
      }),
      this.prisma.sstClientProfile.findUnique({
        where: { servedClientId },
      }),
    ]);

    const job = worker.clientJobFunction;
    const city =
      profile?.city?.trim() ||
      worker.operationalUnit?.city?.trim() ||
      null;

    const base: SstDocumentPayload = {
      type,
      company: {
        legalName: client.legalName,
        tradeName: client.tradeName,
        cnpj: client.cnpj,
        city,
      },
      worker: {
        name: worker.name,
        cpfMasked: maskCpf(worker.cpf),
        registration: worker.registration,
        admissionDate: formatDay(worker.admissionDate),
        sectorName:
          worker.clientSector?.name ?? worker.department ?? null,
        jobFunctionName:
          job?.name ?? worker.role ?? null,
      },
      technicalResponsible: {
        name: profile?.technicalResponsibleName ?? null,
        registry: profile?.technicalResponsibleRegistry ?? null,
      },
      integration: null,
      os: null,
      termText: '',
      generatedAt: new Date().toISOString(),
    };

    if (type === SstDocumentType.INTEGRACAO) {
      base.integration = {
        date: formatDay(worker.admissionDate) ?? formatDay(new Date()),
        time: profile?.integrationTime ?? '08:00',
        durationHours: profile?.integrationDurationHours ?? 2,
        topics: [...DEFAULT_INTEGRATION_TOPICS],
      };
      base.termText = buildIntegrationTerm(client.legalName);
      return base;
    }

    const risks = (job?.risks ?? []).map((link) => ({
      category: link.risk.category,
      agent: link.risk.name,
      source: link.source ?? link.risk.description ?? null,
      evaluation: 'Qualitativa',
      exposure: link.exposure ?? null,
    }));
    const epis = (job?.epiRequirements ?? [])
      .filter((row) => row.isActive)
      .map((row) => row.epiNeed.name);

    base.os = {
      environment: job?.environmentDescription ?? null,
      functionDescription: job?.description ?? null,
      risks,
      epis,
      epcs: [...DEFAULT_EPCS],
      recommendations: [...DEFAULT_OS_RECOMMENDATIONS],
      responsibilities: [...DEFAULT_OS_RESPONSIBILITIES],
    };
    base.termText = buildOsTerm(
      client.legalName,
      job?.name ?? worker.role ?? 'a funcao',
    );
    return base;
  }

  private mapRow(row: {
    id: string;
    type: SstDocumentType;
    status: SstDocumentStatus;
    title: string;
    signedAt: Date | null;
    createdAt: Date;
    worker: { id: string; name: string; registration: string | null };
    links: Array<{
      expiresAt: Date;
      consumedAt: Date | null;
      revokedAt: Date | null;
    }>;
  }) {
    const link = row.links[0] ?? null;
    return {
      id: row.id,
      type: row.type,
      typeLabel:
        row.type === SstDocumentType.ORDEM_SERVICO
          ? 'Ordem de Servico'
          : 'Integracao de SST',
      status: row.status,
      statusLabel:
        row.status === SstDocumentStatus.SIGNED
          ? 'Assinado'
          : row.status === SstDocumentStatus.CANCELLED
            ? 'Cancelado'
            : 'Aguardando ciencia',
      title: row.title,
      workerId: row.worker.id,
      workerName: row.worker.name,
      workerRegistration: row.worker.registration,
      signedAt: row.signedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      linkExpiresAt: link?.expiresAt.toISOString() ?? null,
      linkConsumed: Boolean(link?.consumedAt),
    };
  }

  private async requireClient(organizationId: string, servedClientId: string) {
    const client = await this.prisma.servedClient.findFirst({
      where: { id: servedClientId, organizationId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Cliente nao encontrado.');
  }

  private async requireDocument(
    organizationId: string,
    servedClientId: string,
    documentId: string,
  ) {
    const row = await this.prisma.sstDocument.findFirst({
      where: { id: documentId, organizationId, servedClientId },
    });
    if (!row) throw new NotFoundException('Documento nao encontrado.');
    return row;
  }

  private async requireWorker(
    organizationId: string,
    servedClientId: string,
    workerId: string,
  ) {
    const worker = await this.prisma.worker.findFirst({
      where: {
        id: workerId,
        organizationId,
        servedClientId,
        status: WorkerStatus.ACTIVE,
      },
      include: {
        operationalUnit: { select: { city: true } },
        clientSector: { select: { name: true } },
        clientJobFunction: {
          include: {
            risks: {
              include: {
                risk: {
                  select: {
                    name: true,
                    category: true,
                    description: true,
                  },
                },
              },
            },
            epiRequirements: {
              where: { isActive: true },
              include: { epiNeed: { select: { name: true } } },
            },
          },
        },
      },
    });
    if (!worker) {
      throw new NotFoundException('Trabalhador nao encontrado.');
    }
    return worker;
  }
}
