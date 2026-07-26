import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import {
  WORKER_BIOMETRIC_CONSENT_TEXT,
  WORKER_BIOMETRIC_CONSENT_VERSION,
  isValidFaceDescriptor,
} from '@gestao-epi/shared';
import { AuditService } from '../audit/audit.service';
import { stripCpf } from '../common/cpf';
import { PrismaService } from '../prisma/prisma.service';
import { WorkerBiometricConsentService } from './worker-biometric-consent.service';
import { WorkerFacialReferenceService } from './worker-facial-reference.service';

const LINK_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

export type FacialEnrollmentLinkStatus =
  | 'PENDING'
  | 'EXPIRED'
  | 'CONSUMED'
  | 'REVOKED'
  | 'MISSING';

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function getPublicWebBaseUrl(): string {
  const fromEnv = process.env.PUBLIC_WEB_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const cors = process.env.CORS_ORIGIN?.split(',')[0]?.trim();
  if (cors && cors !== '*') return cors.replace(/\/$/, '');
  return 'http://localhost:3000';
}

function buildEnrollmentUrl(token: string): string {
  return `${getPublicWebBaseUrl()}/enroll/facial/${encodeURIComponent(token)}`;
}

function deriveStatus(row: {
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
}): FacialEnrollmentLinkStatus {
  if (row.revokedAt) return 'REVOKED';
  if (row.consumedAt) return 'CONSUMED';
  if (row.expiresAt.getTime() <= Date.now()) return 'EXPIRED';
  return 'PENDING';
}

@Injectable()
export class WorkerFacialEnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly biometricConsent: WorkerBiometricConsentService,
    private readonly facialReference: WorkerFacialReferenceService,
  ) {}

  /** Gera (ou regenera) link de 24h. Exige CPF no trabalhador. */
  async generate(organizationId: string, userId: string, workerId: string) {
    const worker = await this.requireWorker(organizationId, workerId);
    const cpfDigits = stripCpf(worker.cpf ?? '');
    if (cpfDigits.length < 4) {
      throw new BadRequestException(
        'Informe o CPF do trabalhador (pelo menos 4 digitos finais) antes de gerar o link.',
      );
    }

    const activeFace = await this.prisma.workerFacialReference.findFirst({
      where: {
        organizationId,
        workerId: worker.id,
        status: 'ACTIVE',
      },
      select: { faceDescriptor: true },
    });
    if (activeFace && isValidFaceDescriptor(activeFace.faceDescriptor)) {
      throw new BadRequestException(
        'Trabalhador ja possui biometria valida. Revogue a biometria atual antes de gerar um novo link.',
      );
    }

    const now = new Date();
    await this.prisma.workerFacialEnrollmentLink.updateMany({
      where: {
        organizationId,
        workerId: worker.id,
        consumedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + LINK_TTL_MS);

    const created = await this.prisma.workerFacialEnrollmentLink.create({
      data: {
        organizationId,
        servedClientId: worker.servedClientId,
        workerId: worker.id,
        tokenHash: hashToken(token),
        expiresAt,
        createdByUserId: userId,
      },
      select: {
        id: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    await this.audit.log({
      action: 'worker.facial_enrollment_link.generated',
      organizationId,
      userId,
      entityType: 'WorkerFacialEnrollmentLink',
      entityId: created.id,
      metadata: {
        workerId: worker.id,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      id: created.id,
      workerId: worker.id,
      workerName: worker.name,
      status: 'PENDING' as const,
      url: buildEnrollmentUrl(token),
      expiresAt: expiresAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      requiresCpfLast4: true,
      notice:
        'Copie o link e envie ao trabalhador. Ele precisara dos 4 ultimos digitos do CPF. Validade: 24 horas.',
    };
  }

  /** Status do link ativo mais recente (sem token/URL regeneravel). */
  async getLatestStatus(organizationId: string, workerId: string) {
    const worker = await this.requireWorker(organizationId, workerId);
    const latest = await this.prisma.workerFacialEnrollmentLink.findFirst({
      where: { organizationId, workerId: worker.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        expiresAt: true,
        consumedAt: true,
        revokedAt: true,
        createdAt: true,
        failedAttempts: true,
      },
    });

    if (!latest) {
      return {
        workerId: worker.id,
        workerName: worker.name,
        hasCpf: stripCpf(worker.cpf ?? '').length >= 4,
        status: 'MISSING' as const,
        link: null,
        canGenerate: stripCpf(worker.cpf ?? '').length >= 4,
      };
    }

    const status = deriveStatus(latest);
    return {
      workerId: worker.id,
      workerName: worker.name,
      hasCpf: stripCpf(worker.cpf ?? '').length >= 4,
      status,
      link: {
        id: latest.id,
        status,
        expiresAt: latest.expiresAt.toISOString(),
        consumedAt: latest.consumedAt?.toISOString() ?? null,
        revokedAt: latest.revokedAt?.toISOString() ?? null,
        createdAt: latest.createdAt.toISOString(),
      },
      canGenerate: stripCpf(worker.cpf ?? '').length >= 4,
    };
  }

  /** Preview publico apos validar CPF (sem imagem/template). */
  async unlock(token: string, cpfLast4Raw: string) {
    const link = await this.findValidLinkOrThrow(token);
    await this.assertCpfLast4(link, cpfLast4Raw);

    const firstName = link.worker.name.trim().split(/\s+/)[0] || link.worker.name;

    return {
      workerFirstName: firstName,
      expiresAt: link.expiresAt.toISOString(),
      consentText: WORKER_BIOMETRIC_CONSENT_TEXT,
      consentVersion: WORKER_BIOMETRIC_CONSENT_VERSION,
      notice:
        'Centralize o rosto no oval e aguarde a captura automatica. Aceite o consentimento antes de salvar.',
    };
  }

  /** Conclui consentimento + biometria via link publico. */
  async complete(
    token: string,
    input: {
      cpfLast4: string;
      consentAccepted: boolean;
      file: { buffer: Buffer; mimeType?: string };
      faceDescriptor: number[];
      faceEngine?: string;
      faceEngineVersion?: string;
      qualityScore?: number | null;
    },
  ) {
    if (input.consentAccepted !== true) {
      throw new BadRequestException(
        'E necessario aceitar o consentimento biometrico.',
      );
    }

    const link = await this.findValidLinkOrThrow(token);
    await this.assertCpfLast4(link, input.cpfLast4);

    const actorUserId = link.createdByUserId;
    if (!actorUserId) {
      throw new BadRequestException(
        'Link sem responsavel de auditoria. Gere um novo link na Consultoria.',
      );
    }

    await this.biometricConsent.grant(
      link.organizationId,
      actorUserId,
      link.workerId,
      { accepted: true },
    );

    const facial = await this.facialReference.upload(
      link.organizationId,
      actorUserId,
      link.workerId,
      input.file,
      {
        consentAccepted: true,
        faceDescriptor: input.faceDescriptor,
        faceEngine: input.faceEngine,
        faceEngineVersion: input.faceEngineVersion,
        qualityScore: input.qualityScore ?? null,
      },
    );

    const now = new Date();
    await this.prisma.workerFacialEnrollmentLink.update({
      where: { id: link.id },
      data: { consumedAt: now },
    });

    await this.audit.log({
      action: 'worker.facial_enrollment_link.completed',
      organizationId: link.organizationId,
      userId: actorUserId,
      entityType: 'WorkerFacialEnrollmentLink',
      entityId: link.id,
      metadata: {
        workerId: link.workerId,
        facialReferenceId: facial.reference?.id ?? null,
      },
    });

    return {
      ok: true as const,
      workerFirstName:
        link.worker.name.trim().split(/\s+/)[0] || link.worker.name,
      message:
        'Biometria cadastrada com sucesso. Voce ja pode fechar esta pagina.',
      completedAt: now.toISOString(),
    };
  }

  private async requireWorker(organizationId: string, workerId: string) {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, organizationId },
      select: {
        id: true,
        name: true,
        cpf: true,
        servedClientId: true,
        organizationId: true,
      },
    });
    if (!worker) {
      throw new NotFoundException('Trabalhador nao encontrado.');
    }
    return worker;
  }

  private async findValidLinkOrThrow(tokenRaw: string) {
    const token = tokenRaw?.trim();
    if (!token) {
      throw new NotFoundException('Link invalido ou expirado.');
    }

    const link = await this.prisma.workerFacialEnrollmentLink.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            cpf: true,
          },
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Link invalido ou expirado.');
    }

    const status = deriveStatus(link);
    if (status === 'REVOKED') {
      throw new BadRequestException(
        'Este link foi revogado. Solicite um novo a Consultoria.',
      );
    }
    if (status === 'CONSUMED') {
      throw new BadRequestException(
        'Este link ja foi utilizado. A biometria ja esta cadastrada.',
      );
    }
    if (status === 'EXPIRED') {
      throw new BadRequestException(
        'Este link expirou. Solicite um novo a Consultoria.',
      );
    }
    if (link.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      throw new BadRequestException(
        'Muitas tentativas invalidas. Solicite um novo link a Consultoria.',
      );
    }

    return link;
  }

  private async assertCpfLast4(
    link: {
      id: string;
      failedAttempts: number;
      worker: { cpf: string | null };
    },
    cpfLast4Raw: string,
  ) {
    const provided = stripCpf(cpfLast4Raw).slice(-4);
    const expected = stripCpf(link.worker.cpf ?? '').slice(-4);

    if (provided.length !== 4 || expected.length !== 4 || provided !== expected) {
      const nextAttempts = link.failedAttempts + 1;
      await this.prisma.workerFacialEnrollmentLink.update({
        where: { id: link.id },
        data: {
          failedAttempts: nextAttempts,
          ...(nextAttempts >= MAX_FAILED_ATTEMPTS
            ? { revokedAt: new Date() }
            : {}),
        },
      });
      throw new UnauthorizedException(
        nextAttempts >= MAX_FAILED_ATTEMPTS
          ? 'Muitas tentativas invalidas. Solicite um novo link a Consultoria.'
          : 'CPF invalido. Confira os 4 ultimos digitos.',
      );
    }
  }
}
