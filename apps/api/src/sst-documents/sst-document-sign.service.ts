import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  SstDocumentStatus,
  WorkerFacialReferenceStatus,
} from '@prisma/client';
import { createHash } from 'crypto';
import {
  decideFaceMatch,
  FACE_ENGINE,
  isLivenessChallengeType,
  isValidFaceDescriptor,
  resolveFaceMatchThreshold,
} from '@gestao-epi/shared';
import { CommunicationsService } from '../communications/communications.service';
import { stripCpf } from '../common/cpf';
import { PrismaService } from '../prisma/prisma.service';
import {
  uniqueStrings,
  type SstDocumentPayload,
} from './sst-document-content';
import { resolveOrgLogoAbsolutePath } from '../organization/org-logo.storage';
import { resolveClientLogoAbsolutePath } from './sst-client-logo.storage';
import {
  saveSstEvidenceFile,
  tryResolveSstPdfFacePath,
} from './sst-document-evidence.storage';
import { SstDocumentPdfService } from './sst-document-pdf.service';

const MAX_FAILED_ATTEMPTS = 5;

function hashToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

@Injectable()
export class SstDocumentSignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communications: CommunicationsService,
    private readonly pdf: SstDocumentPdfService,
  ) {}

  async unlock(token: string, cpfLast4Raw: string) {
    const link = await this.findValidLinkOrThrow(token);
    await this.assertCpfLast4(link, cpfLast4Raw);
    const firstName =
      link.worker.name.trim().split(/\s+/)[0] || link.worker.name;
    const payload = link.document.payload as SstDocumentPayload;
    if (payload.os?.epis) {
      payload.os.epis = uniqueStrings(payload.os.epis);
    }
    return {
      workerFirstName: firstName,
      documentTitle: link.document.title,
      documentType: link.document.type,
      expiresAt: link.expiresAt.toISOString(),
      payload,
    };
  }

  async complete(
    token: string,
    input: {
      cpfLast4: string;
      file: { buffer: Buffer; mimeType?: string };
      faceDescriptor: number[];
      faceEngine?: string | null;
      livenessPassed: boolean;
      livenessChallenge?: string | null;
    },
  ) {
    const link = await this.findValidLinkOrThrow(token);
    await this.assertCpfLast4(link, input.cpfLast4);

    if (!isValidFaceDescriptor(input.faceDescriptor)) {
      throw new BadRequestException('Descritor facial invalido.');
    }
    if (!input.livenessPassed) {
      throw new BadRequestException('Validacao de presenca nao concluida.');
    }

    const reference = await this.prisma.workerFacialReference.findFirst({
      where: {
        organizationId: link.organizationId,
        workerId: link.workerId,
        status: WorkerFacialReferenceStatus.ACTIVE,
      },
      select: { faceDescriptor: true },
    });
    const referenceDescriptor = reference?.faceDescriptor;
    if (!isValidFaceDescriptor(referenceDescriptor)) {
      throw new BadRequestException(
        'Biometria de referencia indisponivel. Procure o gestor.',
      );
    }

    const threshold = resolveFaceMatchThreshold();
    const match = decideFaceMatch(
      referenceDescriptor,
      input.faceDescriptor,
      threshold,
    );
    if (!match.matched) {
      await this.prisma.sstDocumentLink.update({
        where: { id: link.id },
        data: { failedAttempts: { increment: 1 } },
      });
      throw new UnauthorizedException(
        'Face nao corresponde ao trabalhador. Tente novamente.',
      );
    }

    const saved = await saveSstEvidenceFile({
      organizationId: link.organizationId,
      documentId: link.documentId,
      buffer: input.file.buffer,
      mimeType: input.file.mimeType,
    });

    const signedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.sstDocumentEvidence.upsert({
        where: { documentId: link.documentId },
        create: {
          documentId: link.documentId,
          capturedAt: signedAt,
          filePath: saved.relativePath,
          fileHash: saved.fileHash,
          mimeType: saved.mimeType,
          byteSize: saved.byteSize,
          matchDistance: match.distance,
          matchThreshold: match.threshold,
          faceEngine: input.faceEngine?.trim() || FACE_ENGINE,
          livenessPassed: true,
          livenessChallenge: isLivenessChallengeType(input.livenessChallenge)
            ? input.livenessChallenge
            : null,
        },
        update: {
          capturedAt: signedAt,
          filePath: saved.relativePath,
          fileHash: saved.fileHash,
          mimeType: saved.mimeType,
          byteSize: saved.byteSize,
          matchDistance: match.distance,
          matchThreshold: match.threshold,
        },
      });
      await tx.sstDocument.update({
        where: { id: link.documentId },
        data: { status: SstDocumentStatus.SIGNED, signedAt },
      });
      await tx.sstDocumentLink.update({
        where: { id: link.id },
        data: { consumedAt: signedAt },
      });
    });

    await this.communications.enqueueSstDocumentSignedWhatsapp({
      organizationId: link.organizationId,
      workerId: link.workerId,
      phone: link.worker.phone,
      documentTitle: link.document.title,
    });

    return {
      ok: true as const,
      signedAt: signedAt.toISOString(),
      documentTitle: link.document.title,
    };
  }

  async publicPdf(token: string, cpfLast4Raw: string) {
    const hash = hashToken(token);
    const link = await this.prisma.sstDocumentLink.findUnique({
      where: { tokenHash: hash },
      include: {
        document: { include: { evidence: true } },
        worker: {
          select: {
            cpf: true,
            role: true,
            clientSector: { select: { name: true } },
            clientJobFunction: {
              select: {
                name: true,
                description: true,
                environmentDescription: true,
              },
            },
            facialReferences: {
              where: { status: WorkerFacialReferenceStatus.ACTIVE },
              select: { filePath: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!link) throw new NotFoundException('Link invalido.');
    await this.assertCpfLast4(link, cpfLast4Raw);
    if (link.document.status !== SstDocumentStatus.SIGNED) {
      throw new BadRequestException('Documento ainda nao assinado.');
    }
    const buffer = await this.pdf.build(
      link.document.payload as SstDocumentPayload,
      {
        signedAt: link.document.signedAt?.toISOString() ?? null,
        evidenceAbsolutePath: tryResolveSstPdfFacePath({
          evidenceRelativePath: link.document.evidence?.filePath,
          referenceRelativePath: link.worker.facialReferences[0]?.filePath,
        }),
        liveJob: {
          jobName:
            link.worker.clientJobFunction?.name ?? link.worker.role,
          sectorName: link.worker.clientSector?.name ?? null,
          description: link.worker.clientJobFunction?.description ?? null,
          environment:
            link.worker.clientJobFunction?.environmentDescription ?? null,
        },
        ...(await this.resolvePdfLogos(
          link.organizationId,
          link.servedClientId,
        )),
      },
    );
    return {
      buffer,
      fileName: `sst-${link.documentId.slice(-6)}.pdf`,
    };
  }

  private async findValidLinkOrThrow(token: string) {
    const link = await this.prisma.sstDocumentLink.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        document: true,
        worker: { select: { name: true, cpf: true, phone: true } },
      },
    });
    if (!link) throw new NotFoundException('Link invalido.');
    if (link.revokedAt) {
      throw new BadRequestException('Este link foi substituido. Peca um novo.');
    }
    if (link.consumedAt || link.document.status === SstDocumentStatus.SIGNED) {
      throw new BadRequestException('Este documento ja foi assinado.');
    }
    if (link.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Link expirado. Peca um novo ao gestor.');
    }
    if (link.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      throw new BadRequestException(
        'Muitas tentativas. Peca um novo link ao gestor.',
      );
    }
    return link;
  }

  private async resolvePdfLogos(
    organizationId: string,
    servedClientId: string,
  ) {
    const [org, profile] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { logoPath: true },
      }),
      this.prisma.sstClientProfile.findUnique({
        where: { servedClientId },
        select: { logoPath: true },
      }),
    ]);
    return {
      consultoriaLogoPath: org?.logoPath
        ? resolveOrgLogoAbsolutePath(org.logoPath)
        : null,
      companyLogoPath: profile?.logoPath
        ? resolveClientLogoAbsolutePath(profile.logoPath)
        : null,
    };
  }

  private async assertCpfLast4(
    link: { worker: { cpf: string | null }; id: string },
    cpfLast4Raw: string,
  ) {
    const expected = stripCpf(link.worker.cpf ?? '').slice(-4);
    const given = stripCpf(cpfLast4Raw).slice(-4);
    if (expected.length < 4 || given !== expected) {
      await this.prisma.sstDocumentLink.update({
        where: { id: link.id },
        data: { failedAttempts: { increment: 1 } },
      });
      throw new UnauthorizedException('CPF nao confere.');
    }
  }
}
