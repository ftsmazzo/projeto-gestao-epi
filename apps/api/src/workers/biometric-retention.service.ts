import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WorkerBiometricDeletionStatus,
  WorkerFacialReferenceStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { getDeliveryEvidenceRoot } from '../portal/facial-evidence.storage';
import { safeUnlinkInsideRoot } from './biometric-storage-path';
import { getWorkerFaceReferenceRoot } from './worker-face-reference.storage';

export type BiometricRetentionTrigger = 'MANUAL' | 'SCHEDULED';

const PUBLIC_SELECT_REF = {
  id: true,
  workerId: true,
  servedClientId: true,
  status: true,
  deletionStatus: true,
  retentionUntil: true,
  deletedAt: true,
  deletionError: true,
  uploadedAt: true,
  revokedAt: true,
  worker: { select: { id: true, name: true } },
} as const;

const PUBLIC_SELECT_EVIDENCE = {
  id: true,
  deliveryId: true,
  deletionStatus: true,
  retentionUntil: true,
  deletedAt: true,
  deletionError: true,
  capturedAt: true,
  delivery: {
    select: {
      id: true,
      receiptNumber: true,
      organizationId: true,
      servedClientId: true,
      worker: { select: { id: true, name: true } },
    },
  },
} as const;

@Injectable()
export class BiometricRetentionService {
  private readonly logger = new Logger(BiometricRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  assertAdmin(membershipRole: string) {
    if (membershipRole !== 'OWNER' && membershipRole !== 'ADMIN') {
      throw new ForbiddenException(
        'Apenas OWNER ou ADMIN podem gerenciar retencao biometrica.',
      );
    }
  }

  /** Lista pendencias do tenant (sem path/template). */
  async listPending(organizationId: string) {
    await this.enqueueExpiredEvidence(organizationId);

    const [references, evidences] = await Promise.all([
      this.prisma.workerFacialReference.findMany({
        where: {
          organizationId,
          deletionStatus: {
            in: [
              WorkerBiometricDeletionStatus.PENDING,
              WorkerBiometricDeletionStatus.FAILED,
            ],
          },
        },
        orderBy: [{ revokedAt: 'desc' }, { uploadedAt: 'desc' }],
        take: 100,
        select: PUBLIC_SELECT_REF,
      }),
      this.prisma.deliveryEvidence.findMany({
        where: {
          deletionStatus: {
            in: [
              WorkerBiometricDeletionStatus.PENDING,
              WorkerBiometricDeletionStatus.FAILED,
            ],
          },
          delivery: { organizationId },
        },
        orderBy: { capturedAt: 'desc' },
        take: 100,
        select: PUBLIC_SELECT_EVIDENCE,
      }),
    ]);

    return {
      references: references.map((row) => ({
        id: row.id,
        kind: 'FACIAL_REFERENCE' as const,
        workerId: row.workerId,
        workerName: row.worker.name,
        servedClientId: row.servedClientId,
        status: row.status,
        deletionStatus: row.deletionStatus,
        retentionUntil: row.retentionUntil?.toISOString() ?? null,
        deletedAt: row.deletedAt?.toISOString() ?? null,
        deletionError: row.deletionError,
        uploadedAt: row.uploadedAt.toISOString(),
        revokedAt: row.revokedAt?.toISOString() ?? null,
      })),
      evidences: evidences.map((row) => ({
        id: row.id,
        kind: 'DELIVERY_EVIDENCE' as const,
        deliveryId: row.deliveryId,
        receiptNumber: row.delivery.receiptNumber,
        servedClientId: row.delivery.servedClientId,
        workerId: row.delivery.worker.id,
        workerName: row.delivery.worker.name,
        deletionStatus: row.deletionStatus,
        retentionUntil: row.retentionUntil?.toISOString() ?? null,
        deletedAt: row.deletedAt?.toISOString() ?? null,
        deletionError: row.deletionError,
        capturedAt: row.capturedAt.toISOString(),
      })),
      summary: {
        referencesPending: references.filter(
          (r) => r.deletionStatus === WorkerBiometricDeletionStatus.PENDING,
        ).length,
        referencesFailed: references.filter(
          (r) => r.deletionStatus === WorkerBiometricDeletionStatus.FAILED,
        ).length,
        evidencesPending: evidences.filter(
          (e) => e.deletionStatus === WorkerBiometricDeletionStatus.PENDING,
        ).length,
        evidencesFailed: evidences.filter(
          (e) => e.deletionStatus === WorkerBiometricDeletionStatus.FAILED,
        ).length,
      },
    };
  }

  /**
   * Marca referencia para exclusao (Consultoria).
   * So aceita REVOKED/NEEDS_REENROLLMENT ou ACTIVE ja sem uso — tipicamente REVOKED.
   */
  async requestReferenceDeletion(
    organizationId: string,
    userId: string,
    workerId: string,
    referenceId: string,
  ) {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, organizationId },
      select: { id: true, name: true, servedClientId: true },
    });
    if (!worker) {
      throw new NotFoundException('Trabalhador nao encontrado.');
    }

    const ref = await this.prisma.workerFacialReference.findFirst({
      where: {
        id: referenceId,
        organizationId,
        workerId: worker.id,
      },
    });
    if (!ref) {
      throw new NotFoundException('Referencia facial nao encontrada.');
    }
    if (ref.deletionStatus === WorkerBiometricDeletionStatus.DELETED) {
      return this.publicReferenceMeta(ref.id);
    }
    if (ref.deletionStatus === WorkerBiometricDeletionStatus.PENDING) {
      return this.publicReferenceMeta(ref.id);
    }
    if (ref.status === WorkerFacialReferenceStatus.ACTIVE) {
      throw new BadRequestException(
        'Revogue a biometria antes de solicitar exclusao definitiva.',
      );
    }

    await this.prisma.workerFacialReference.update({
      where: { id: ref.id },
      data: {
        deletionStatus: WorkerBiometricDeletionStatus.PENDING,
        deletionError: null,
      },
    });

    await this.audit.log({
      action: 'biometric.retention.deletion_requested',
      organizationId,
      userId,
      entityType: 'WorkerFacialReference',
      entityId: ref.id,
      metadata: {
        workerId: worker.id,
        previousStatus: ref.status,
      },
    });

    return this.publicReferenceMeta(ref.id);
  }

  /** Executa exclusao no tenant (manual) ou em todos (agendada). */
  async run(options: {
    triggeredBy: BiometricRetentionTrigger;
    organizationId?: string | null;
    userId?: string | null;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const organizationId = options.organizationId ?? null;

    if (organizationId) {
      await this.enqueueExpiredEvidence(organizationId);
    } else {
      await this.enqueueExpiredEvidence(null);
    }

    const refWhere: Prisma.WorkerFacialReferenceWhereInput = {
      deletionStatus: {
        in: [
          WorkerBiometricDeletionStatus.PENDING,
          WorkerBiometricDeletionStatus.FAILED,
        ],
      },
      ...(organizationId ? { organizationId } : {}),
    };

    const evidenceWhere: Prisma.DeliveryEvidenceWhereInput = {
      deletionStatus: {
        in: [
          WorkerBiometricDeletionStatus.PENDING,
          WorkerBiometricDeletionStatus.FAILED,
        ],
      },
      ...(organizationId
        ? { delivery: { organizationId } }
        : {}),
    };

    const [refs, evidences] = await Promise.all([
      this.prisma.workerFacialReference.findMany({
        where: refWhere,
        take: limit,
        orderBy: { updatedAt: 'asc' },
        select: {
          id: true,
          organizationId: true,
          workerId: true,
          filePath: true,
          deletionStatus: true,
        },
      }),
      this.prisma.deliveryEvidence.findMany({
        where: evidenceWhere,
        take: limit,
        orderBy: { capturedAt: 'asc' },
        select: {
          id: true,
          filePath: true,
          deletionStatus: true,
          delivery: { select: { organizationId: true } },
        },
      }),
    ]);

    let referencesDeleted = 0;
    let referencesFailed = 0;
    let evidencesDeleted = 0;
    let evidencesFailed = 0;

    for (const ref of refs) {
      const result = await this.purgeFacialReference(
        ref.id,
        ref.organizationId,
        ref.filePath,
        options.userId ?? null,
      );
      if (result === 'deleted') referencesDeleted += 1;
      else referencesFailed += 1;
    }

    for (const ev of evidences) {
      const result = await this.purgeDeliveryEvidence(
        ev.id,
        ev.delivery.organizationId,
        ev.filePath,
        options.userId ?? null,
      );
      if (result === 'deleted') evidencesDeleted += 1;
      else evidencesFailed += 1;
    }

    const summary = {
      triggeredBy: options.triggeredBy,
      referencesProcessed: refs.length,
      evidencesProcessed: evidences.length,
      referencesDeleted,
      referencesFailed,
      evidencesDeleted,
      evidencesFailed,
    };

    if (organizationId) {
      await this.audit.log({
        action: 'biometric.retention.run',
        organizationId,
        userId: options.userId ?? undefined,
        entityType: 'BiometricRetention',
        entityId: organizationId,
        metadata: summary,
      });
    } else {
      this.logger.log(
        `Retencao biometrica agendada: refs=${referencesDeleted}/${refs.length} evid=${evidencesDeleted}/${evidences.length}`,
      );
      // Auditoria por organizacao afetada (sem path).
      const orgIds = new Set<string>([
        ...refs.map((r) => r.organizationId),
        ...evidences.map((e) => e.delivery.organizationId),
      ]);
      for (const orgId of orgIds) {
        await this.audit.log({
          action: 'biometric.retention.run',
          organizationId: orgId,
          userId: undefined,
          entityType: 'BiometricRetention',
          entityId: orgId,
          metadata: {
            ...summary,
            scope: 'SCHEDULED_GLOBAL',
          },
        });
      }
    }

    return summary;
  }

  private async publicReferenceMeta(referenceId: string) {
    const row = await this.prisma.workerFacialReference.findUniqueOrThrow({
      where: { id: referenceId },
      select: {
        id: true,
        workerId: true,
        status: true,
        deletionStatus: true,
        deletedAt: true,
        deletionError: true,
        retentionUntil: true,
        revokedAt: true,
        uploadedAt: true,
      },
    });
    return {
      id: row.id,
      workerId: row.workerId,
      status: row.status,
      deletionStatus: row.deletionStatus,
      deletedAt: row.deletedAt?.toISOString() ?? null,
      deletionError: row.deletionError,
      retentionUntil: row.retentionUntil?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      uploadedAt: row.uploadedAt.toISOString(),
    };
  }

  /** Marca evidencias vencidas como PENDING (sem path). */
  private async enqueueExpiredEvidence(organizationId: string | null) {
    const now = new Date();
    await this.prisma.deliveryEvidence.updateMany({
      where: {
        deletionStatus: WorkerBiometricDeletionStatus.NONE,
        retentionUntil: { lte: now },
        filePath: { not: null },
        ...(organizationId
          ? { delivery: { organizationId } }
          : {}),
      },
      data: {
        deletionStatus: WorkerBiometricDeletionStatus.PENDING,
      },
    });

    // Referencias REVOKED com retentionUntil vencido e ainda NONE.
    await this.prisma.workerFacialReference.updateMany({
      where: {
        deletionStatus: WorkerBiometricDeletionStatus.NONE,
        retentionUntil: { lte: now },
        status: WorkerFacialReferenceStatus.REVOKED,
        ...(organizationId ? { organizationId } : {}),
        filePath: { not: null },
      },
      data: {
        deletionStatus: WorkerBiometricDeletionStatus.PENDING,
      },
    });
  }

  private async purgeFacialReference(
    id: string,
    organizationId: string,
    filePath: string | null,
    userId: string | null,
  ): Promise<'deleted' | 'failed'> {
    try {
      await safeUnlinkInsideRoot(getWorkerFaceReferenceRoot(), filePath);

      await this.prisma.workerFacialReference.update({
        where: { id },
        data: {
          filePath: null,
          faceDescriptor: Prisma.DbNull,
          mimeType: null,
          byteSize: null,
          // Mantem fileHash / faceEngine como metadado nao recuperavel de imagem.
          deletionStatus: WorkerBiometricDeletionStatus.DELETED,
          deletedAt: new Date(),
          deletionError: null,
          deletedByUserId: userId,
        },
      });

      await this.audit.log({
        action: 'biometric.retention.reference_deleted',
        organizationId,
        userId: userId ?? undefined,
        entityType: 'WorkerFacialReference',
        entityId: id,
        metadata: { hadFile: Boolean(filePath) },
      });

      return 'deleted';
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message.slice(0, 240)
          : 'Falha na exclusao biometrica.';
      this.logger.warn(`Falha ao purgar referencia ${id}: ${message}`);
      await this.prisma.workerFacialReference.update({
        where: { id },
        data: {
          deletionStatus: WorkerBiometricDeletionStatus.FAILED,
          deletionError: message,
        },
      });
      await this.audit.log({
        action: 'biometric.retention.reference_failed',
        organizationId,
        userId: userId ?? undefined,
        entityType: 'WorkerFacialReference',
        entityId: id,
        metadata: { error: message },
      });
      return 'failed';
    }
  }

  private async purgeDeliveryEvidence(
    id: string,
    organizationId: string,
    filePath: string | null,
    userId: string | null,
  ): Promise<'deleted' | 'failed'> {
    try {
      await safeUnlinkInsideRoot(getDeliveryEvidenceRoot(), filePath);

      await this.prisma.deliveryEvidence.update({
        where: { id },
        data: {
          filePath: null,
          byteSize: null,
          deletionStatus: WorkerBiometricDeletionStatus.DELETED,
          deletedAt: new Date(),
          deletionError: null,
          deletedByUserId: userId,
        },
      });

      await this.audit.log({
        action: 'biometric.retention.evidence_deleted',
        organizationId,
        userId: userId ?? undefined,
        entityType: 'DeliveryEvidence',
        entityId: id,
        metadata: { hadFile: Boolean(filePath) },
      });

      return 'deleted';
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message.slice(0, 240)
          : 'Falha na exclusao da evidencia.';
      this.logger.warn(`Falha ao purgar evidencia ${id}: ${message}`);
      await this.prisma.deliveryEvidence.update({
        where: { id },
        data: {
          deletionStatus: WorkerBiometricDeletionStatus.FAILED,
          deletionError: message,
        },
      });
      await this.audit.log({
        action: 'biometric.retention.evidence_failed',
        organizationId,
        userId: userId ?? undefined,
        entityType: 'DeliveryEvidence',
        entityId: id,
        metadata: { error: message },
      });
      return 'failed';
    }
  }
}
