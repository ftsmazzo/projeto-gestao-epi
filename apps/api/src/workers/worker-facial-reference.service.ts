import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WorkerBiometricDeletionStatus,
  WorkerFacialReferenceStatus,
} from '@prisma/client';
import {
  FACE_ENGINE,
  FACE_ENGINE_VERSION,
  isValidFaceDescriptor,
} from '@gestao-epi/shared';
import { createReadStream, existsSync } from 'fs';
import { unlink } from 'fs/promises';
import type { Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  resolveWorkerFaceReferenceAbsolutePath,
  saveWorkerFaceReferenceFile,
} from './worker-face-reference.storage';
import { WorkerBiometricConsentService } from './worker-biometric-consent.service';

export const WORKER_FACE_REFERENCE_CONSENT_VERSION = 'v1-2026-07';

export const WORKER_FACE_REFERENCE_CONSENT_TEXT =
  'Esta imagem sera usada como biometria facial de referencia do trabalhador para validacao automatica na entrega de EPI.';

const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class WorkerFacialReferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly biometricConsent: WorkerBiometricConsentService,
  ) {}

  async getMeta(organizationId: string, workerId: string) {
    const worker = await this.requireWorker(organizationId, workerId);
    const active = await this.prisma.workerFacialReference.findFirst({
      where: {
        organizationId,
        workerId,
        status: WorkerFacialReferenceStatus.ACTIVE,
      },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        status: true,
        uploadedAt: true,
        revokedAt: true,
        mimeType: true,
        byteSize: true,
        consentAcceptedAt: true,
        faceDescriptor: true,
        faceEngine: true,
        faceEngineVersion: true,
        qualityScore: true,
        deletionStatus: true,
        deletedAt: true,
        deletionError: true,
        retentionUntil: true,
        filePath: true,
      },
    });

    const needsReenroll = !active
      ? await this.prisma.workerFacialReference.findFirst({
          where: {
            organizationId,
            workerId,
            status: WorkerFacialReferenceStatus.NEEDS_REENROLLMENT,
          },
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true,
            status: true,
            uploadedAt: true,
            revokedAt: true,
            deletionStatus: true,
            deletedAt: true,
            deletionError: true,
            retentionUntil: true,
            filePath: true,
          },
        })
      : null;

    const latestRevoked =
      !active && !needsReenroll
        ? await this.prisma.workerFacialReference.findFirst({
            where: {
              organizationId,
              workerId,
              status: WorkerFacialReferenceStatus.REVOKED,
            },
            orderBy: { revokedAt: 'desc' },
            select: {
              id: true,
              status: true,
              uploadedAt: true,
              revokedAt: true,
              deletionStatus: true,
              deletedAt: true,
              deletionError: true,
              retentionUntil: true,
              filePath: true,
            },
          })
        : null;

    const hasDescriptor = Boolean(
      active?.faceDescriptor &&
        isValidFaceDescriptor(active.faceDescriptor),
    );

    const fileExistsOnDisk = Boolean(
      active?.filePath &&
        existsSync(resolveWorkerFaceReferenceAbsolutePath(active.filePath)),
    );

    const status = active
      ? ('ACTIVE' as const)
      : needsReenroll
        ? ('NEEDS_REENROLLMENT' as const)
        : latestRevoked
          ? ('REVOKED' as const)
          : ('MISSING' as const);

    const refRow = active ?? needsReenroll ?? latestRevoked;
    const deletionStatus =
      refRow && 'deletionStatus' in refRow
        ? (refRow.deletionStatus as
            | 'NONE'
            | 'PENDING'
            | 'DELETED'
            | 'FAILED')
        : ('NONE' as const);
    const hasFile = Boolean(
      active
        ? fileExistsOnDisk
        : refRow &&
            'filePath' in refRow &&
            refRow.filePath &&
            deletionStatus !== 'DELETED',
    );

    return {
      workerId: worker.id,
      workerName: worker.name,
      hasActiveReference: Boolean(active) && fileExistsOnDisk,
      hasBiometricTemplate: hasDescriptor && fileExistsOnDisk,
      status:
        active && !fileExistsOnDisk
          ? ('NEEDS_REENROLLMENT' as const)
          : status,
      reference: refRow
        ? {
            id: refRow.id,
            status: refRow.status,
            uploadedAt: refRow.uploadedAt.toISOString(),
            revokedAt:
              'revokedAt' in refRow && refRow.revokedAt
                ? refRow.revokedAt.toISOString()
                : null,
            mimeType: active?.mimeType ?? null,
            byteSize: active?.byteSize ?? null,
            consentAcceptedAt:
              active?.consentAcceptedAt?.toISOString() ?? null,
            hasDescriptor,
            faceEngine: active?.faceEngine ?? null,
            faceEngineVersion: active?.faceEngineVersion ?? null,
            qualityScore: active?.qualityScore ?? null,
            imagePath:
              active && fileExistsOnDisk
                ? `/workers/${worker.id}/facial-reference/image`
                : null,
            deletionStatus,
            deletedAt:
              'deletedAt' in refRow && refRow.deletedAt
                ? refRow.deletedAt.toISOString()
                : null,
            deletionError:
              'deletionError' in refRow ? (refRow.deletionError ?? null) : null,
            retentionUntil:
              'retentionUntil' in refRow && refRow.retentionUntil
                ? refRow.retentionUntil.toISOString()
                : null,
            hasFile,
            canRequestDeletion:
              !fileExistsOnDisk &&
              deletionStatus !== 'PENDING' &&
              deletionStatus !== 'DELETED' &&
              (status === 'REVOKED' ||
                status === 'NEEDS_REENROLLMENT' ||
                Boolean(active)),
          }
        : null,
      notice:
        'Biometria facial de referencia para matching automatico na entrega. Templates nao sao expostos na API.',
    };
  }

  async upload(
    organizationId: string,
    userId: string,
    workerId: string,
    file: { buffer: Buffer; mimeType?: string },
    options: {
      consentAccepted?: boolean;
      faceDescriptor: number[];
      faceEngine?: string;
      faceEngineVersion?: string;
      qualityScore?: number | null;
    },
  ) {
    const worker = await this.requireWorker(organizationId, workerId);

    if (!file?.buffer?.byteLength) {
      throw new BadRequestException('Imagem de referencia facial obrigatoria.');
    }
    const mimeType = file.mimeType?.trim() || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
      throw new BadRequestException(
        'Arquivo de referencia facial deve ser uma imagem.',
      );
    }
    if (file.buffer.byteLength > MAX_BYTES) {
      throw new BadRequestException(
        'Imagem de referencia facial excede o limite de 5 MB.',
      );
    }
    if (!isValidFaceDescriptor(options.faceDescriptor)) {
      throw new BadRequestException(
        'Descritor facial invalido. Detecte exatamente uma face antes de salvar.',
      );
    }

    await this.biometricConsent.assertGranted(organizationId, worker.id);

    const saved = await saveWorkerFaceReferenceFile({
      organizationId,
      workerId: worker.id,
      buffer: file.buffer,
      mimeType,
    });

    const now = new Date();
    const consentAccepted = options.consentAccepted === true;
    const retentionUntil = new Date(now);
    retentionUntil.setFullYear(retentionUntil.getFullYear() + 5);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
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

        return tx.workerFacialReference.create({
          data: {
            organizationId,
            servedClientId: worker.servedClientId,
            workerId: worker.id,
            filePath: saved.relativePath,
            fileHash: saved.fileHash,
            mimeType: saved.mimeType,
            byteSize: saved.byteSize,
            faceDescriptor: options.faceDescriptor as unknown as Prisma.InputJsonValue,
            faceEngine: options.faceEngine?.trim() || FACE_ENGINE,
            faceEngineVersion:
              options.faceEngineVersion?.trim() || FACE_ENGINE_VERSION,
            qualityScore:
              typeof options.qualityScore === 'number' &&
              Number.isFinite(options.qualityScore)
                ? options.qualityScore
                : null,
            status: WorkerFacialReferenceStatus.ACTIVE,
            uploadedAt: now,
            createdByUserId: userId,
            consentText: consentAccepted
              ? WORKER_FACE_REFERENCE_CONSENT_TEXT
              : null,
            consentAcceptedAt: consentAccepted ? now : null,
            retentionUntil,
            deletionStatus: WorkerBiometricDeletionStatus.NONE,
          },
          select: {
            id: true,
            status: true,
            uploadedAt: true,
            mimeType: true,
            byteSize: true,
            consentAcceptedAt: true,
            faceEngine: true,
            faceEngineVersion: true,
            qualityScore: true,
            retentionUntil: true,
          },
        });
      });

      await this.audit.log({
        action: 'worker.facial_reference.uploaded',
        organizationId,
        userId,
        entityType: 'WorkerFacialReference',
        entityId: created.id,
        metadata: {
          workerId: worker.id,
          servedClientId: worker.servedClientId,
          mimeType: created.mimeType,
          byteSize: created.byteSize,
          faceEngine: created.faceEngine,
          hasDescriptor: true,
          // Nao logar imagem, descritor, hash ou path fisico.
        },
      });

      return {
        workerId: worker.id,
        hasActiveReference: true,
        hasBiometricTemplate: true,
        status: 'ACTIVE' as const,
        reference: {
          id: created.id,
          status: created.status,
          uploadedAt: created.uploadedAt.toISOString(),
          revokedAt: null,
          mimeType: created.mimeType,
          byteSize: created.byteSize,
          consentAcceptedAt: created.consentAcceptedAt?.toISOString() ?? null,
          hasDescriptor: true,
          faceEngine: created.faceEngine,
          faceEngineVersion: created.faceEngineVersion,
          qualityScore: created.qualityScore,
          imagePath: `/workers/${worker.id}/facial-reference/image`,
          deletionStatus: 'NONE' as const,
          deletedAt: null,
          deletionError: null,
          retentionUntil: (created.retentionUntil ?? retentionUntil).toISOString(),
          hasFile: true,
          canRequestDeletion: false,
        },
        notice: 'Biometria facial cadastrada. Matching automatico habilitado na entrega.',
      };
    } catch (err) {
      try {
        await unlink(saved.absolutePath);
      } catch {
        // ignora limpeza
      }
      throw err;
    }
  }

  async revoke(organizationId: string, userId: string, workerId: string) {
    const worker = await this.requireWorker(organizationId, workerId);
    const active = await this.prisma.workerFacialReference.findFirst({
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
    });
    if (!active) {
      throw new NotFoundException(
        'Nenhuma referencia facial ativa para este trabalhador.',
      );
    }

    const now = new Date();
    await this.prisma.workerFacialReference.update({
      where: { id: active.id },
      data: {
        status: WorkerFacialReferenceStatus.REVOKED,
        revokedAt: now,
        deletionStatus: WorkerBiometricDeletionStatus.PENDING,
        deletionError: null,
      },
    });

    await this.audit.log({
      action: 'worker.facial_reference.revoked',
      organizationId,
      userId,
      entityType: 'WorkerFacialReference',
      entityId: active.id,
      metadata: {
        workerId: worker.id,
        servedClientId: worker.servedClientId,
        deletionPending: true,
      },
    });

    return {
      workerId: worker.id,
      hasActiveReference: false,
      hasBiometricTemplate: false,
      status: 'REVOKED' as const,
      reference: {
        id: active.id,
        status: WorkerFacialReferenceStatus.REVOKED,
        uploadedAt: active.uploadedAt.toISOString(),
        revokedAt: now.toISOString(),
        mimeType: null,
        byteSize: null,
        consentAcceptedAt: null,
        hasDescriptor: false,
        faceEngine: null,
        faceEngineVersion: null,
        qualityScore: null,
        imagePath: null,
        deletionStatus: 'PENDING' as const,
        deletedAt: null,
        deletionError: null,
        retentionUntil: active.retentionUntil?.toISOString() ?? null,
        hasFile: Boolean(active.filePath),
        canRequestDeletion: false,
      },
      notice:
        'Biometria facial revogada. Exclusao fisica pendente. Entregas ficam bloqueadas ate novo cadastro.',
    };
  }

  async streamImage(
    organizationId: string,
    workerId: string,
    res: Response,
  ) {
    await this.requireWorker(organizationId, workerId);
    const active = await this.prisma.workerFacialReference.findFirst({
      where: {
        organizationId,
        workerId,
        status: WorkerFacialReferenceStatus.ACTIVE,
        deletionStatus: { not: WorkerBiometricDeletionStatus.DELETED },
        filePath: { not: null },
      },
      select: { filePath: true, mimeType: true },
    });
    if (!active?.filePath) {
      throw new NotFoundException(
        'Referencia facial ativa nao encontrada para este trabalhador.',
      );
    }

    const absolutePath = resolveWorkerFaceReferenceAbsolutePath(active.filePath);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException(
        'Arquivo de referencia facial nao encontrado no storage.',
      );
    }

    res.setHeader('Content-Type', active.mimeType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, no-store');
    createReadStream(absolutePath).pipe(res);
  }

  private async requireWorker(organizationId: string, workerId: string) {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, organizationId },
      select: {
        id: true,
        name: true,
        servedClientId: true,
        organizationId: true,
      },
    });
    if (!worker) {
      throw new NotFoundException('Trabalhador nao encontrado.');
    }
    return worker;
  }
}
