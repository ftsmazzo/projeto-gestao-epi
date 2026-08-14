import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { UpdateWorkerStatusDto } from './dto/update-worker-status.dto';
import {
  ConfirmWorkerImportDto,
  PreviewWorkerImportDto,
} from './dto/worker-import.dto';
import { WORKER_CSV_TEMPLATE } from './worker-import.utils';
import { WorkerImportService } from './worker-import.service';
import { WorkerFacialReferenceService } from './worker-facial-reference.service';
import { WorkerBiometricConsentService } from './worker-biometric-consent.service';
import { BiometricRetentionService } from './biometric-retention.service';
import { WorkerFacialEnrollmentService } from './worker-facial-enrollment.service';
import { WorkersService } from './workers.service';
import {
  GrantWorkerBiometricConsentDto,
  RevokeWorkerBiometricConsentDto,
} from './dto/biometric-consent.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class WorkersController {
  constructor(
    private readonly workers: WorkersService,
    private readonly workerImport: WorkerImportService,
    private readonly facialReference: WorkerFacialReferenceService,
    private readonly biometricConsent: WorkerBiometricConsentService,
    private readonly biometricRetention: BiometricRetentionService,
    private readonly facialEnrollment: WorkerFacialEnrollmentService,
  ) {}

  @Get('biometrics/retention/pending')
  listBiometricRetentionPending(@CurrentUser() user: JwtPayload) {
    this.biometricRetention.assertAdmin(user.membershipRole);
    return this.biometricRetention.listPending(user.organizationId);
  }

  @Post('biometrics/retention/run')
  runBiometricRetention(@CurrentUser() user: JwtPayload) {
    this.biometricRetention.assertAdmin(user.membershipRole);
    return this.biometricRetention.run({
      triggeredBy: 'MANUAL',
      organizationId: user.organizationId,
      userId: user.sub,
    });
  }

  @Get('served-clients/:servedClientId/workers')
  listByServedClient(
    @CurrentUser() user: JwtPayload,
    @Param('servedClientId') servedClientId: string,
  ) {
    return this.workers.listByServedClient(user.organizationId, servedClientId);
  }

  @Get('served-clients/:servedClientId/life-summary')
  lifeSummary(
    @CurrentUser() user: JwtPayload,
    @Param('servedClientId') servedClientId: string,
  ) {
    return this.workers.getClientLifeSummary(
      user.organizationId,
      servedClientId,
    );
  }

  @Get('served-clients/:servedClientId/workers/import/csv-template')
  csvTemplate() {
    return {
      fileName: 'modelo-importacao-trabalhadores.csv',
      contentType: 'text/csv; charset=utf-8',
      csvText: WORKER_CSV_TEMPLATE,
    };
  }

  @Post('served-clients/:servedClientId/workers/import/preview')
  previewImport(
    @CurrentUser() user: JwtPayload,
    @Param('servedClientId') servedClientId: string,
    @Body() dto: PreviewWorkerImportDto,
  ) {
    return this.workerImport.preview(
      user.organizationId,
      servedClientId,
      { csvText: dto.csvText, csvBase64: dto.csvBase64 },
    );
  }

  @Post('served-clients/:servedClientId/workers/import/confirm')
  confirmImport(
    @CurrentUser() user: JwtPayload,
    @Param('servedClientId') servedClientId: string,
    @Body() dto: ConfirmWorkerImportDto,
  ) {
    return this.workerImport.confirm(
      user.organizationId,
      user.sub,
      servedClientId,
      dto.rows.map((row) => ({
        rowNumber: row.rowNumber,
        payload: {
          name: row.payload.name,
          cpf: row.payload.cpf ?? null,
          registration: row.payload.registration ?? null,
          email: row.payload.email ?? null,
          phone: row.payload.phone ?? null,
          admissionDate: row.payload.admissionDate ?? null,
          status: row.payload.status,
          operationalUnitId: row.payload.operationalUnitId ?? null,
          clientSectorId: row.payload.clientSectorId ?? null,
          clientJobFunctionId: row.payload.clientJobFunctionId ?? null,
          department: row.payload.department ?? null,
          role: row.payload.role ?? null,
        },
      })),
    );
  }

  @Post('served-clients/:servedClientId/workers')
  async create(
    @CurrentUser() user: JwtPayload,
    @Param('servedClientId') servedClientId: string,
    @Body() dto: CreateWorkerDto,
  ) {
    const worker = await this.workers.create(
      user.organizationId,
      user.sub,
      servedClientId,
      dto,
    );
    let facialEnrollmentLink: Awaited<
      ReturnType<WorkerFacialEnrollmentService['generate']>
    > | null = null;
    try {
      facialEnrollmentLink = await this.facialEnrollment.generate(
        user.organizationId,
        user.sub,
        worker.id,
      );
    } catch {
      // Sem CPF ou outro bloqueio — cadastro segue; link pode ser gerado depois.
      facialEnrollmentLink = null;
    }
    return { ...worker, facialEnrollmentLink };
  }

  @Get('workers/:id')
  getById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.workers.getById(user.organizationId, id);
  }

  @Patch('workers/:id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWorkerDto,
  ) {
    return this.workers.update(user.organizationId, user.sub, id, dto);
  }

  @Patch('workers/:id/status')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWorkerStatusDto,
  ) {
    return this.workers.updateStatus(
      user.organizationId,
      user.sub,
      id,
      dto.status,
    );
  }

  @Get('workers/:id/facial-reference')
  getFacialReference(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.facialReference.getMeta(user.organizationId, id);
  }

  @Get('workers/:id/biometric-consent')
  getBiometricConsent(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.biometricConsent.getLatest(user.organizationId, id);
  }

  @Post('workers/:id/biometric-consent')
  grantBiometricConsent(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: GrantWorkerBiometricConsentDto,
  ) {
    return this.biometricConsent.grant(user.organizationId, user.sub, id, dto);
  }

  @Post('workers/:id/biometric-consent/revoke')
  revokeBiometricConsent(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RevokeWorkerBiometricConsentDto,
  ) {
    return this.biometricConsent.revoke(user.organizationId, user.sub, id, dto);
  }

  @Get('workers/:id/facial-reference/image')
  streamFacialReference(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return this.facialReference.streamImage(user.organizationId, id, res);
  }

  @Post('workers/:id/facial-reference')
  @UseInterceptors(
    FileInterceptor('facial', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadFacialReference(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() facial: Express.Multer.File | undefined,
    @Body('consentAccepted') consentAcceptedRaw?: string,
    @Body('faceDescriptor') faceDescriptorRaw?: string,
    @Body('faceEngine') faceEngine?: string,
    @Body('faceEngineVersion') faceEngineVersion?: string,
    @Body('qualityScore') qualityScoreRaw?: string,
  ) {
    if (!facial?.buffer?.length) {
      throw new BadRequestException(
        'Envie a imagem no campo multipart "facial".',
      );
    }
    if (!faceDescriptorRaw?.trim()) {
      throw new BadRequestException(
        'Descritor facial obrigatorio (campo "faceDescriptor" em JSON).',
      );
    }
    let faceDescriptor: unknown;
    try {
      faceDescriptor = JSON.parse(faceDescriptorRaw) as unknown;
    } catch {
      throw new BadRequestException('faceDescriptor JSON invalido.');
    }
    const consentAccepted =
      consentAcceptedRaw === 'true' || consentAcceptedRaw === '1';
    const qualityScore = qualityScoreRaw
      ? Number.parseFloat(qualityScoreRaw)
      : null;
    return this.facialReference.upload(
      user.organizationId,
      user.sub,
      id,
      {
        buffer: facial.buffer,
        mimeType: facial.mimetype,
      },
      {
        consentAccepted,
        faceDescriptor: faceDescriptor as number[],
        faceEngine,
        faceEngineVersion,
        qualityScore: Number.isFinite(qualityScore) ? qualityScore : null,
      },
    );
  }

  @Patch('workers/:id/facial-reference/revoke')
  revokeFacialReference(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.facialReference.revoke(user.organizationId, user.sub, id);
  }

  @Post('workers/:id/facial-reference/:referenceId/request-deletion')
  requestFacialReferenceDeletion(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('referenceId') referenceId: string,
  ) {
    return this.biometricRetention.requestReferenceDeletion(
      user.organizationId,
      user.sub,
      id,
      referenceId,
    );
  }

  @Get('workers/:id/facial-enrollment-link')
  getFacialEnrollmentLink(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.facialEnrollment.getLatestStatus(user.organizationId, id);
  }

  @Post('workers/:id/facial-enrollment-link')
  generateFacialEnrollmentLink(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.facialEnrollment.generate(
      user.organizationId,
      user.sub,
      id,
    );
  }

  @Post('workers/:id/facial-enrollment-link/whatsapp')
  resendFacialEnrollmentWhatsapp(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.facialEnrollment.resendWhatsapp(
      user.organizationId,
      user.sub,
      id,
    );
  }
}
