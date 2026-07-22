import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CaepiImportRunStatus,
  CaepiImportTriggeredBy,
  MembershipRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertCaepiSourceUrlConfigured,
  readCaepiRuntimeConfig,
} from './caepi-config';
import { CaepiDownloadService } from './caepi-download.service';
import {
  CAEPI_BASE_INCOMPLETE_THRESHOLD,
  CaepiService,
} from './caepi.service';

@Injectable()
export class CaepiSyncService {
  private readonly logger = new Logger(CaepiSyncService.name);
  private inProcessLock = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly download: CaepiDownloadService,
    private readonly caepi: CaepiService,
  ) {}

  assertCanManage(membershipRole: string) {
    if (
      membershipRole !== MembershipRole.OWNER &&
      membershipRole !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Apenas OWNER ou ADMIN podem gerenciar a base CAEPI.',
      );
    }
  }

  getRuntimeConfig() {
    return readCaepiRuntimeConfig();
  }

  async getStatus() {
    const config = this.getRuntimeConfig();
    const [base, lastRun, running] = await Promise.all([
      this.caepi.getBaseCounts(),
      this.prisma.caepiImportRun.findFirst({
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.caepiImportRun.findFirst({
        where: {
          status: {
            in: [CaepiImportRunStatus.PENDING, CaepiImportRunStatus.RUNNING],
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      certificatesTotal: base.certificates,
      normsTotal: base.norms,
      baseIncomplete: base.incomplete,
      incompleteThreshold: CAEPI_BASE_INCOMPLETE_THRESHOLD,
      sourceUrlConfigured: Boolean(config.sourceUrl),
      sourceUrl: config.sourceUrl,
      autoSyncEnabled: config.autoSyncEnabled,
      syncCron: config.syncCron,
      lastImport: lastRun,
      activeRun: running,
      operationalMessage: this.buildOperationalMessage(
        base.certificates,
        base.incomplete,
        config.sourceUrl,
      ),
    };
  }

  private buildOperationalMessage(
    certificates: number,
    incomplete: boolean,
    sourceUrl: string | null,
  ) {
    if (!sourceUrl) {
      return 'CAEPI_SOURCE_URL nao configurada. Defina a URL oficial baixavel no ambiente da API para atualizar a base.';
    }
    if (certificates === 0) {
      return 'Base CAEPI local vazia. Acione "Atualizar base CAEPI agora" para baixar a base oficial.';
    }
    if (incomplete) {
      return `Base CAEPI local incompleta (${certificates} certificado(s)). Atualize pela tela Base CAEPI.`;
    }
    return null;
  }

  async listImportRuns(limitRaw?: number) {
    const limit = Math.min(
      Math.max(Number.isFinite(limitRaw) ? Number(limitRaw) : 20, 1),
      50,
    );
    return this.prisma.caepiImportRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getImportRun(id: string) {
    const run = await this.prisma.caepiImportRun.findUnique({ where: { id } });
    if (!run) {
      throw new NotFoundException('Execucao CAEPI nao encontrada.');
    }
    return run;
  }

  async startManualSync(options: {
    organizationId: string;
    userId: string;
    membershipRole: string;
  }) {
    this.assertCanManage(options.membershipRole);
    const config = this.getRuntimeConfig();
    try {
      assertCaepiSourceUrlConfigured(config.sourceUrl);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'CAEPI_SOURCE_URL invalida.',
      );
    }

    return this.enqueueSync({
      triggeredBy: CaepiImportTriggeredBy.MANUAL,
      sourceUrl: config.sourceUrl!,
      createdByUserId: options.userId,
      organizationId: options.organizationId,
    });
  }

  async startScheduledSync() {
    const config = this.getRuntimeConfig();
    if (!config.autoSyncEnabled) {
      this.logger.debug('CAEPI auto sync desabilitado.');
      return null;
    }
    if (!config.sourceUrl) {
      this.logger.warn(
        'CAEPI_AUTO_SYNC_ENABLED=true, mas CAEPI_SOURCE_URL nao esta configurada.',
      );
      return null;
    }

    try {
      return await this.enqueueSync({
        triggeredBy: CaepiImportTriggeredBy.SCHEDULED,
        sourceUrl: config.sourceUrl,
        createdByUserId: null,
        organizationId: null,
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        this.logger.warn('Sync agendado ignorado: ja ha importacao em andamento.');
        return null;
      }
      throw error;
    }
  }

  async startUploadImport(options: {
    organizationId: string;
    userId: string;
    membershipRole: string;
    buffer: Buffer;
    originalName?: string;
  }) {
    this.assertCanManage(options.membershipRole);
    this.claimProcessLock();
    try {
      await this.assertNoActiveRunInDb();

      const run = await this.createRun({
        triggeredBy: CaepiImportTriggeredBy.UPLOAD,
        sourceUrl: null,
        fileName: options.originalName ?? null,
        createdByUserId: options.userId,
      });

      void this.executeUpload(run.id, options.buffer, {
        organizationId: options.organizationId,
        userId: options.userId,
        membershipRole: options.membershipRole,
        originalName: options.originalName,
        lockAlreadyHeld: true,
      });

      return { runId: run.id, status: run.status };
    } catch (error) {
      this.releaseProcessLock();
      throw error;
    }
  }

  private async enqueueSync(options: {
    triggeredBy: CaepiImportTriggeredBy;
    sourceUrl: string;
    createdByUserId: string | null;
    organizationId: string | null;
  }) {
    this.claimProcessLock();
    try {
      await this.assertNoActiveRunInDb();

      const run = await this.createRun({
        triggeredBy: options.triggeredBy,
        sourceUrl: options.sourceUrl,
        fileName: null,
        createdByUserId: options.createdByUserId,
      });

      void this.executeRemoteSync(run.id, {
        sourceUrl: options.sourceUrl,
        organizationId: options.organizationId,
        userId: options.createdByUserId,
        triggeredBy: options.triggeredBy,
        lockAlreadyHeld: true,
      });

      return { runId: run.id, status: run.status };
    } catch (error) {
      this.releaseProcessLock();
      throw error;
    }
  }

  private claimProcessLock() {
    if (this.inProcessLock) {
      throw new ConflictException(
        'Ja existe uma importacao CAEPI em andamento. Aguarde a conclusao.',
      );
    }
    this.inProcessLock = true;
  }

  private releaseProcessLock() {
    this.inProcessLock = false;
  }

  private async assertNoActiveRunInDb() {
    const active = await this.prisma.caepiImportRun.findFirst({
      where: {
        status: {
          in: [CaepiImportRunStatus.PENDING, CaepiImportRunStatus.RUNNING],
        },
      },
      select: { id: true },
    });
    if (active) {
      throw new ConflictException(
        'Ja existe uma importacao CAEPI em andamento. Aguarde a conclusao.',
      );
    }
  }

  private async createRun(input: {
    triggeredBy: CaepiImportTriggeredBy;
    sourceUrl: string | null;
    fileName: string | null;
    createdByUserId: string | null;
  }) {
    return this.prisma.caepiImportRun.create({
      data: {
        status: CaepiImportRunStatus.PENDING,
        triggeredBy: input.triggeredBy,
        sourceUrl: input.sourceUrl,
        fileName: input.fileName,
        createdByUserId: input.createdByUserId,
      },
    });
  }

  private async executeRemoteSync(
    runId: string,
    options: {
      sourceUrl: string;
      organizationId: string | null;
      userId: string | null;
      triggeredBy: CaepiImportTriggeredBy;
      lockAlreadyHeld?: boolean;
    },
  ) {
    if (!options.lockAlreadyHeld) {
      if (this.inProcessLock) {
        await this.failRun(runId, 'Lock de importacao CAEPI ocupado.');
        return;
      }
      this.inProcessLock = true;
    }

    try {
      await this.prisma.caepiImportRun.update({
        where: { id: runId },
        data: {
          status: CaepiImportRunStatus.RUNNING,
          startedAt: new Date(),
          errorMessage: null,
        },
      });

      const downloaded = await this.download.downloadOfficialBase(
        options.sourceUrl,
      );

      await this.prisma.caepiImportRun.update({
        where: { id: runId },
        data: { fileName: downloaded.fileName },
      });

      const result = await this.caepi.importFromBuffer(downloaded.buffer, {
        organizationId: options.organizationId,
        userId: options.userId,
        membershipRole: MembershipRole.OWNER,
        originalName: downloaded.fileName,
        skipRoleCheck: true,
        runId,
        triggeredBy: options.triggeredBy,
        sourceUrl: options.sourceUrl,
      });

      await this.prisma.caepiImportRun.update({
        where: { id: runId },
        data: {
          status: CaepiImportRunStatus.SUCCESS,
          finishedAt: new Date(),
          fileName: result.fileName,
          rowsRead: result.rowsRead,
          certificatesCreated: result.certificatesCreated,
          certificatesUpdated: result.certificatesUpdated,
          normsCreated: result.normsCreated,
          rowsSkipped: result.rowsSkipped,
          certificatesTotalAfter: result.certificatesTotalAfter,
          normsTotalAfter: result.normsTotalAfter,
          errorMessage: null,
        },
      });

      this.logger.log(
        `Sync CAEPI ${runId} SUCCESS certs=${result.certificatesTotalAfter}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha desconhecida no sync CAEPI.';
      this.logger.error(`Sync CAEPI ${runId} FAILED: ${message}`);
      await this.failRun(runId, message);
    } finally {
      this.releaseProcessLock();
    }
  }

  private async executeUpload(
    runId: string,
    buffer: Buffer,
    options: {
      organizationId: string;
      userId: string;
      membershipRole: string;
      originalName?: string;
      lockAlreadyHeld?: boolean;
    },
  ) {
    if (!options.lockAlreadyHeld) {
      if (this.inProcessLock) {
        await this.failRun(runId, 'Lock de importacao CAEPI ocupado.');
        return;
      }
      this.inProcessLock = true;
    }

    try {
      await this.prisma.caepiImportRun.update({
        where: { id: runId },
        data: {
          status: CaepiImportRunStatus.RUNNING,
          startedAt: new Date(),
        },
      });

      const prepared = this.download.prepareLocalFile(
        buffer,
        options.originalName,
      );

      await this.prisma.caepiImportRun.update({
        where: { id: runId },
        data: { fileName: prepared.fileName },
      });

      const result = await this.caepi.importFromBuffer(prepared.buffer, {
        organizationId: options.organizationId,
        userId: options.userId,
        membershipRole: options.membershipRole,
        originalName: prepared.fileName,
        runId,
        triggeredBy: CaepiImportTriggeredBy.UPLOAD,
        sourceUrl: null,
      });

      await this.prisma.caepiImportRun.update({
        where: { id: runId },
        data: {
          status: CaepiImportRunStatus.SUCCESS,
          finishedAt: new Date(),
          fileName: result.fileName,
          rowsRead: result.rowsRead,
          certificatesCreated: result.certificatesCreated,
          certificatesUpdated: result.certificatesUpdated,
          normsCreated: result.normsCreated,
          rowsSkipped: result.rowsSkipped,
          certificatesTotalAfter: result.certificatesTotalAfter,
          normsTotalAfter: result.normsTotalAfter,
          errorMessage: null,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Falha desconhecida no upload CAEPI.';
      await this.failRun(runId, message);
    } finally {
      this.releaseProcessLock();
    }
  }

  private async failRun(runId: string, errorMessage: string) {
    await this.prisma.caepiImportRun.update({
      where: { id: runId },
      data: {
        status: CaepiImportRunStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: errorMessage.slice(0, 2000),
      },
    });
  }
}
