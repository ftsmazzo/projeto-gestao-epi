import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  WorkerBiometricConsentStatus,
  WorkerBiometricDeletionStatus,
  WorkerFacialReferenceStatus,
} from '@prisma/client';
import {
  WORKER_BIOMETRIC_CONSENT_TEXT,
  WORKER_BIOMETRIC_CONSENT_VERSION,
} from '@gestao-epi/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export type BiometricConsentPublicStatus =
  | 'GRANTED'
  | 'REVOKED'
  | 'NOT_REGISTERED';

@Injectable()
export class WorkerBiometricConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async requireWorker(organizationId: string, workerId: string) {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, organizationId },
      select: {
        id: true,
        name: true,
        organizationId: true,
        servedClientId: true,
      },
    });
    if (!worker) {
      throw new NotFoundException('Trabalhador nao encontrado.');
    }
    return worker;
  }

  /** Ultimo registro de consentimento (nao expoe dados sensiveis). */
  async getLatest(organizationId: string, workerId: string) {
    const worker = await this.requireWorker(organizationId, workerId);
    const latest = await this.prisma.workerBiometricConsent.findFirst({
      where: {
        organizationId,
        workerId: worker.id,
      },
      orderBy: [{ grantedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        status: true,
        consentVersion: true,
        consentText: true,
        grantedAt: true,
        revokedAt: true,
        revocationReason: true,
        retentionUntil: true,
        deletionStatus: true,
      },
    });

    const status: BiometricConsentPublicStatus = !latest
      ? 'NOT_REGISTERED'
      : latest.status === WorkerBiometricConsentStatus.GRANTED
        ? 'GRANTED'
        : 'REVOKED';

    return {
      workerId: worker.id,
      workerName: worker.name,
      status,
      consent: latest
        ? {
            id: latest.id,
            status: latest.status as 'GRANTED' | 'REVOKED',
            consentVersion: latest.consentVersion,
            consentText: latest.consentText,
            grantedAt: latest.grantedAt.toISOString(),
            revokedAt: latest.revokedAt?.toISOString() ?? null,
            revocationReason: latest.revocationReason,
            retentionUntil: latest.retentionUntil?.toISOString() ?? null,
            deletionStatus: latest.deletionStatus as
              | 'NONE'
              | 'PENDING'
              | 'DELETED',
          }
        : null,
      canEnrollBiometrics: status === 'GRANTED',
      canDeliverWithBiometrics: status === 'GRANTED',
      consentTextTemplate: WORKER_BIOMETRIC_CONSENT_TEXT,
      consentVersionTemplate: WORKER_BIOMETRIC_CONSENT_VERSION,
    };
  }

  async assertGranted(organizationId: string, workerId: string) {
    const latest = await this.prisma.workerBiometricConsent.findFirst({
      where: { organizationId, workerId },
      orderBy: [{ grantedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        status: true,
        consentVersion: true,
        grantedAt: true,
      },
    });
    if (!latest || latest.status !== WorkerBiometricConsentStatus.GRANTED) {
      throw new BadRequestException(
        'Trabalhador sem consentimento biometrico ativo. Registre o aceite LGPD antes de cadastrar biometria.',
      );
    }
    return latest;
  }

  async getGrantedOrNull(organizationId: string, workerId: string) {
    const latest = await this.prisma.workerBiometricConsent.findFirst({
      where: { organizationId, workerId },
      orderBy: [{ grantedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        status: true,
        consentVersion: true,
        grantedAt: true,
      },
    });
    if (!latest || latest.status !== WorkerBiometricConsentStatus.GRANTED) {
      return null;
    }
    return latest;
  }

  async grant(
    organizationId: string,
    userId: string,
    workerId: string,
    input: { accepted: boolean },
  ) {
    if (input.accepted !== true) {
      throw new BadRequestException(
        'E necessario aceitar o consentimento biometrico do trabalhador.',
      );
    }
    const worker = await this.requireWorker(organizationId, workerId);
    const now = new Date();
    // Retencao inicial sugerida: 5 anos a partir do aceite (politica final pendente).
    const retentionUntil = new Date(now);
    retentionUntil.setFullYear(retentionUntil.getFullYear() + 5);

    const created = await this.prisma.workerBiometricConsent.create({
      data: {
        organizationId,
        servedClientId: worker.servedClientId,
        workerId: worker.id,
        status: WorkerBiometricConsentStatus.GRANTED,
        consentText: WORKER_BIOMETRIC_CONSENT_TEXT,
        consentVersion: WORKER_BIOMETRIC_CONSENT_VERSION,
        grantedAt: now,
        createdByUserId: userId,
        updatedByUserId: userId,
        retentionUntil,
        deletionStatus: WorkerBiometricDeletionStatus.NONE,
      },
      select: {
        id: true,
        status: true,
        consentVersion: true,
        consentText: true,
        grantedAt: true,
        retentionUntil: true,
      },
    });

    await this.audit.log({
      action: 'worker.biometric_consent.granted',
      organizationId,
      userId,
      entityType: 'WorkerBiometricConsent',
      entityId: created.id,
      metadata: {
        workerId: worker.id,
        consentVersion: created.consentVersion,
      },
    });

    return this.getLatest(organizationId, worker.id);
  }

  async revoke(
    organizationId: string,
    userId: string,
    workerId: string,
    input?: { reason?: string | null },
  ) {
    const worker = await this.requireWorker(organizationId, workerId);
    const latest = await this.prisma.workerBiometricConsent.findFirst({
      where: {
        organizationId,
        workerId: worker.id,
        status: WorkerBiometricConsentStatus.GRANTED,
      },
      orderBy: [{ grantedAt: 'desc' }, { createdAt: 'desc' }],
    });
    if (!latest) {
      throw new BadRequestException(
        'Nao ha consentimento biometrico ativo para revogar.',
      );
    }

    const now = new Date();
    const reason = input?.reason?.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      await tx.workerBiometricConsent.update({
        where: { id: latest.id },
        data: {
          status: WorkerBiometricConsentStatus.REVOKED,
          revokedAt: now,
          revocationReason: reason,
          updatedByUserId: userId,
          // Marca pendencia de exclusao definitiva (job fisico futuro).
          deletionStatus: WorkerBiometricDeletionStatus.PENDING,
        },
      });

      await tx.workerFacialReference.updateMany({
        where: {
          organizationId,
          workerId: worker.id,
          status: {
            in: [
              WorkerFacialReferenceStatus.ACTIVE,
              WorkerFacialReferenceStatus.NEEDS_REENROLLMENT,
            ],
          },
        },
        data: {
          status: WorkerFacialReferenceStatus.REVOKED,
          revokedAt: now,
          deletionStatus: WorkerBiometricDeletionStatus.PENDING,
        },
      });
    });

    await this.audit.log({
      action: 'worker.biometric_consent.revoked',
      organizationId,
      userId,
      entityType: 'WorkerBiometricConsent',
      entityId: latest.id,
      metadata: {
        workerId: worker.id,
        reason: reason ? 'provided' : null,
        facialReferencesMarkedRevoked: true,
        deletionPending: true,
      },
    });

    return this.getLatest(organizationId, worker.id);
  }
}
