import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkerFacialReferenceStatus } from '@prisma/client';
import { createReadStream, existsSync } from 'fs';
import { unlink } from 'fs/promises';
import type { Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  resolveWorkerFaceReferenceAbsolutePath,
  saveWorkerFaceReferenceFile,
} from './worker-face-reference.storage';

export const WORKER_FACE_REFERENCE_CONSENT_VERSION = 'v1-2026-07';

export const WORKER_FACE_REFERENCE_CONSENT_TEXT =
  'Esta imagem sera usada como referencia visual na entrega de EPI. Nao constitui reconhecimento facial automatico.';

const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class WorkerFacialReferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
      },
    });

    const latestRevoked = active
      ? null
      : await this.prisma.workerFacialReference.findFirst({
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
          },
        });

    return {
      workerId: worker.id,
      workerName: worker.name,
      hasActiveReference: Boolean(active),
      status: active
        ? ('ACTIVE' as const)
        : latestRevoked
          ? ('REVOKED' as const)
          : ('MISSING' as const),
      reference: active
        ? {
            id: active.id,
            status: active.status,
            uploadedAt: active.uploadedAt.toISOString(),
            revokedAt: null,
            mimeType: active.mimeType,
            byteSize: active.byteSize,
            consentAcceptedAt: active.consentAcceptedAt?.toISOString() ?? null,
            // URL relativa protegida (nao path fisico)
            imagePath: `/workers/${worker.id}/facial-reference/image`,
          }
        : latestRevoked
          ? {
              id: latestRevoked.id,
              status: latestRevoked.status,
              uploadedAt: latestRevoked.uploadedAt.toISOString(),
              revokedAt: latestRevoked.revokedAt?.toISOString() ?? null,
              mimeType: null,
              byteSize: null,
              consentAcceptedAt: null,
              imagePath: null,
            }
          : null,
      notice:
        'Referencia visual para conferencia humana na entrega. Nao e reconhecimento facial automatico.',
    };
  }

  async upload(
    organizationId: string,
    userId: string,
    workerId: string,
    file: { buffer: Buffer; mimeType?: string },
    options?: { consentAccepted?: boolean },
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

    const saved = await saveWorkerFaceReferenceFile({
      organizationId,
      workerId: worker.id,
      buffer: file.buffer,
      mimeType,
    });

    const now = new Date();
    const consentAccepted = options?.consentAccepted === true;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await tx.workerFacialReference.updateMany({
          where: {
            organizationId,
            workerId: worker.id,
            status: WorkerFacialReferenceStatus.ACTIVE,
          },
          data: {
            status: WorkerFacialReferenceStatus.REVOKED,
            revokedAt: now,
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
            status: WorkerFacialReferenceStatus.ACTIVE,
            uploadedAt: now,
            createdByUserId: userId,
            consentText: consentAccepted
              ? WORKER_FACE_REFERENCE_CONSENT_TEXT
              : null,
            consentAcceptedAt: consentAccepted ? now : null,
          },
          select: {
            id: true,
            status: true,
            uploadedAt: true,
            mimeType: true,
            byteSize: true,
            consentAcceptedAt: true,
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
          // Nao logar imagem, hash ou path fisico.
        },
      });

      return {
        workerId: worker.id,
        hasActiveReference: true,
        status: 'ACTIVE' as const,
        reference: {
          id: created.id,
          status: created.status,
          uploadedAt: created.uploadedAt.toISOString(),
          revokedAt: null,
          mimeType: created.mimeType,
          byteSize: created.byteSize,
          consentAcceptedAt: created.consentAcceptedAt?.toISOString() ?? null,
          imagePath: `/workers/${worker.id}/facial-reference/image`,
        },
        notice:
          'Referencia visual cadastrada. Nao e reconhecimento facial automatico.',
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
        status: WorkerFacialReferenceStatus.ACTIVE,
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
      },
    });

    return {
      workerId: worker.id,
      hasActiveReference: false,
      status: 'REVOKED' as const,
      reference: {
        id: active.id,
        status: WorkerFacialReferenceStatus.REVOKED,
        uploadedAt: active.uploadedAt.toISOString(),
        revokedAt: now.toISOString(),
        mimeType: null,
        byteSize: null,
        consentAcceptedAt: null,
        imagePath: null,
      },
      notice: 'Referencia facial revogada. Entregas com facial ficam bloqueadas ate novo cadastro.',
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
      },
      select: { filePath: true, mimeType: true },
    });
    if (!active) {
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
