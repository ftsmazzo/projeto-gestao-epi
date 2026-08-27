import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import type { Request, Response } from 'express';
import { createReadStream } from 'fs';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { ClientJwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ClientJwtPayload } from '../auth/types/jwt-payload';
import { CreateWorkerDto } from '../workers/dto/create-worker.dto';
import { UpdateWorkerDto } from '../workers/dto/update-worker.dto';
import { UpdateWorkerStatusDto } from '../workers/dto/update-worker-status.dto';
import {
  ConfirmWorkerImportDto,
  PreviewWorkerImportDto,
} from '../workers/dto/worker-import.dto';
import { PortalCreateDeliveryPayloadDto, PortalCancelDeliveryDto, PortalCreateReturnDto } from './dto/portal-delivery.dto';
import { PortalStockEntradasDto, PortalStockSaidaDto } from './dto/portal-stock.dto';
import { PortalPdfService } from './portal-pdf.service';
import { PortalReportsService } from './portal-reports.service';
import type { PortalReportFilters } from './portal-reports.service';
import { PgroService } from '../pgro/pgro.service';
import { PortalService } from './portal.service';

@Controller('portal')
@UseGuards(ClientJwtAuthGuard)
export class PortalController {
  constructor(
    private readonly portal: PortalService,
    private readonly reports: PortalReportsService,
    private readonly portalPdf: PortalPdfService,
    private readonly pgro: PgroService,
  ) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.getDashboard(user.organizationId, user.servedClientId);
  }

  @Get('reports/overview')
  reportsOverview(
    @CurrentUser() user: ClientJwtPayload,
    @Query() query: Record<string, string | undefined>,
  ) {
    this.assertClient(user);
    return this.reports.getOverview(
      user.organizationId,
      user.servedClientId,
      this.parseReportFilters(query),
    );
  }

  @Get('reports/deliveries')
  reportsDeliveries(
    @CurrentUser() user: ClientJwtPayload,
    @Query() query: Record<string, string | undefined>,
  ) {
    this.assertClient(user);
    return this.reports.getDeliveriesReport(
      user.organizationId,
      user.servedClientId,
      this.parseReportFilters(query),
    );
  }

  @Get('reports/stock')
  reportsStock(
    @CurrentUser() user: ClientJwtPayload,
    @Query() query: Record<string, string | undefined>,
  ) {
    this.assertClient(user);
    return this.reports.getStockReport(
      user.organizationId,
      user.servedClientId,
      this.parseReportFilters(query),
    );
  }

  @Get('reports/returns')
  reportsReturns(
    @CurrentUser() user: ClientJwtPayload,
    @Query() query: Record<string, string | undefined>,
  ) {
    this.assertClient(user);
    return this.reports.getReturnsReport(
      user.organizationId,
      user.servedClientId,
      this.parseReportFilters(query),
    );
  }

  @Get('reports/coverage')
  reportsCoverage(
    @CurrentUser() user: ClientJwtPayload,
    @Query() query: Record<string, string | undefined>,
  ) {
    this.assertClient(user);
    return this.reports.getCoverageReport(
      user.organizationId,
      user.servedClientId,
      this.parseReportFilters(query),
    );
  }

  @Get('reports/replacements')
  reportsReplacements(
    @CurrentUser() user: ClientJwtPayload,
    @Query() query: Record<string, string | undefined>,
  ) {
    this.assertClient(user);
    return this.reports.getReplacementsReport(
      user.organizationId,
      user.servedClientId,
      this.parseReportFilters(query),
    );
  }

  @Get('reports/activity')
  reportsActivity(
    @CurrentUser() user: ClientJwtPayload,
    @Query() query: Record<string, string | undefined>,
  ) {
    this.assertClient(user);
    return this.reports.getActivityReport(
      user.organizationId,
      user.servedClientId,
      this.parseReportFilters(query),
    );
  }

  @Get('reports/filters')
  reportsFilters(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.reports.getFiltersMeta(
      user.organizationId,
      user.servedClientId,
    );
  }

  @Get('validade')
  validade(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.getValidade(user.organizationId, user.servedClientId);
  }

  @Get('estrutura')
  estrutura(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.getEstrutura(user.organizationId, user.servedClientId);
  }

  @Post('estrutura/pgr/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  previewPgrUpdate(
    @CurrentUser() user: ClientJwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    this.assertClient(user);
    this.assertClientManager(user);
    return this.pgro.previewForClient(
      user.organizationId,
      user.sub,
      user.servedClientId,
      file,
    );
  }

  @Post('estrutura/pgr/:id/confirm')
  confirmPgrUpdate(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
  ) {
    this.assertClient(user);
    this.assertClientManager(user);
    return this.pgro.confirmForClient(
      user.organizationId,
      user.sub,
      user.servedClientId,
      id,
    );
  }

  @Get('entregas/preparacao')
  entregasPreparacao(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.getEntregasPreparacao(
      user.organizationId,
      user.servedClientId,
    );
  }

  @Get('entregas')
  listEntregas(
    @CurrentUser() user: ClientJwtPayload,
    @Query('status') status?: string,
  ) {
    this.assertClient(user);
    return this.portal.listDeliveries(
      user.organizationId,
      user.servedClientId,
      status,
    );
  }

  @Get('entregas/:id')
  getEntrega(@CurrentUser() user: ClientJwtPayload, @Param('id') id: string) {
    this.assertClient(user);
    return this.portal.getDelivery(
      user.organizationId,
      user.servedClientId,
      id,
    );
  }

  @Get('entregas/:id/pdf')
  async getEntregaPdf(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    this.assertClient(user);
    const detail = await this.portal.getDelivery(
      user.organizationId,
      user.servedClientId,
      id,
    );
    let evidencePath: string | null = null;
    try {
      const file = await this.portal.getFacialEvidenceAbsolutePath(
        user.organizationId,
        user.servedClientId,
        id,
      );
      evidencePath = file.absolutePath;
    } catch {
      evidencePath = null;
    }
    const pdf = await this.portalPdf.buildDeliveryReceiptPdf(
      detail,
      evidencePath,
    );
    const fileName = `comprovante-${detail.receiptNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  }

  @Post('entregas/:id/cancel')
  cancelEntrega(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
    @Body() dto: PortalCancelDeliveryDto,
  ) {
    this.assertClient(user);
    return this.portal.cancelDelivery(
      user.organizationId,
      user.servedClientId,
      user.sub,
      id,
      dto,
    );
  }

  @Post('entregas/:id/returns')
  returnEntrega(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
    @Body() dto: PortalCreateReturnDto,
  ) {
    this.assertClient(user);
    return this.portal.createDeliveryReturn(
      user.organizationId,
      user.servedClientId,
      user.sub,
      id,
      dto,
    );
  }

  @Get('entregas/:id/evidence/facial')
  async getEntregaFacial(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    this.assertClient(user);
    const file = await this.portal.getFacialEvidenceAbsolutePath(
      user.organizationId,
      user.servedClientId,
      id,
    );
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    createReadStream(file.absolutePath).pipe(res);
  }

  @Post('entregas')
  @UseInterceptors(
    FileInterceptor('facial', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async createEntrega(
    @CurrentUser() user: ClientJwtPayload,
    @UploadedFile() facial: Express.Multer.File | undefined,
    @Body('payload') payloadRaw?: string,
    @Req() req?: Request,
  ) {
    this.assertClient(user);

    if (!facial?.buffer?.length) {
      throw new BadRequestException(
        'Evidencia facial obrigatoria. Envie a captura no campo multipart "facial".',
      );
    }

    if (!payloadRaw?.trim()) {
      throw new BadRequestException(
        'Payload da entrega obrigatorio (campo multipart "payload" em JSON).',
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(payloadRaw) as unknown;
    } catch {
      throw new BadRequestException('Payload JSON invalido.');
    }

    const dto = plainToInstance(PortalCreateDeliveryPayloadDto, parsed);
    try {
      await validateOrReject(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
    } catch (errors) {
      const messages = Array.isArray(errors)
        ? errors
            .flatMap((e: { constraints?: Record<string, string> }) =>
              e.constraints ? Object.values(e.constraints) : [],
            )
            .filter(Boolean)
        : ['Payload invalido'];
      throw new BadRequestException(
        messages.length > 0 ? messages : 'Payload invalido',
      );
    }

    const forwarded = req?.headers?.['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === 'string'
        ? forwarded.split(',')[0]?.trim()
        : undefined;

    return this.portal.createDelivery(
      user.organizationId,
      user.servedClientId,
      user.sub,
      dto,
      {
        buffer: facial.buffer,
        mimeType: facial.mimetype,
        originalName: facial.originalname,
      },
      {
        operatorIp: forwardedIp || req?.ip || null,
        userAgent:
          typeof req?.headers?.['user-agent'] === 'string'
            ? req.headers['user-agent']
            : null,
      },
    );
  }

  @Get('trabalhadores')
  trabalhadores(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.getTrabalhadores(
      user.organizationId,
      user.servedClientId,
    );
  }

  @Post('trabalhadores')
  createTrabalhador(
    @CurrentUser() user: ClientJwtPayload,
    @Body() dto: CreateWorkerDto,
  ) {
    this.assertClient(user);
    return this.portal.createWorker(
      user.organizationId,
      user.sub,
      user.servedClientId,
      dto,
    );
  }

  @Get('trabalhadores/import/csv-template')
  workerCsvTemplate(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.getWorkerCsvTemplate();
  }

  @Post('trabalhadores/import/preview')
  previewWorkerImport(
    @CurrentUser() user: ClientJwtPayload,
    @Body() dto: PreviewWorkerImportDto,
  ) {
    this.assertClient(user);
    return this.portal.previewWorkerImport(
      user.organizationId,
      user.servedClientId,
      { csvText: dto.csvText, csvBase64: dto.csvBase64 },
    );
  }

  @Post('trabalhadores/import/confirm')
  confirmWorkerImport(
    @CurrentUser() user: ClientJwtPayload,
    @Body() dto: ConfirmWorkerImportDto,
  ) {
    this.assertClient(user);
    return this.portal.confirmWorkerImport(
      user.organizationId,
      user.sub,
      user.servedClientId,
      dto,
    );
  }

  @Patch('trabalhadores/:id')
  updateTrabalhador(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWorkerDto,
  ) {
    this.assertClient(user);
    return this.portal.updateWorker(
      user.organizationId,
      user.sub,
      user.servedClientId,
      id,
      dto,
    );
  }

  @Patch('trabalhadores/:id/status')
  updateTrabalhadorStatus(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWorkerStatusDto,
  ) {
    this.assertClient(user);
    return this.portal.updateWorkerStatus(
      user.organizationId,
      user.sub,
      user.servedClientId,
      id,
      dto.status,
    );
  }

  @Get('trabalhadores/:id/facial-enrollment-link')
  getFacialEnrollmentLink(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
  ) {
    this.assertClient(user);
    return this.portal.getWorkerFacialEnrollmentLink(
      user.organizationId,
      user.servedClientId,
      id,
    );
  }

  @Post('trabalhadores/:id/facial-enrollment-link')
  generateFacialEnrollmentLink(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
  ) {
    this.assertClient(user);
    return this.portal.generateWorkerFacialEnrollmentLink(
      user.organizationId,
      user.sub,
      user.servedClientId,
      id,
    );
  }

  @Post('trabalhadores/:id/facial-enrollment-link/whatsapp')
  resendFacialEnrollmentWhatsapp(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
  ) {
    this.assertClient(user);
    return this.portal.resendWorkerFacialEnrollmentWhatsapp(
      user.organizationId,
      user.sub,
      user.servedClientId,
      id,
    );
  }

  @Get('trabalhadores/:id/epi-coverage')
  trabalhadorEpiCoverage(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
  ) {
    this.assertClient(user);
    return this.portal.getWorkerEpiCoverage(
      user.organizationId,
      user.servedClientId,
      id,
    );
  }

  @Get('trabalhadores/:id/ficha-epi')
  trabalhadorFichaEpi(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
    @Query('scope') scope?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertClient(user);
    const normalized =
      scope === 'open' ? ('open' as const) : ('history' as const);
    return this.portal.getWorkerEpiSheet(
      user.organizationId,
      user.servedClientId,
      id,
      normalized,
      { from, to },
    );
  }

  @Get('trabalhadores/:id/ficha-epi/pdf')
  async trabalhadorFichaEpiPdf(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
    @Query('scope') scope?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertClient(user);
    const normalized =
      scope === 'open' ? ('open' as const) : ('history' as const);
    const sheet = await this.portal.getWorkerEpiSheet(
      user.organizationId,
      user.servedClientId,
      id,
      normalized,
      { from, to },
    );
    const pdf = await this.portalPdf.buildWorkerEpiSheetPdf(sheet);
    const safeName = sheet.worker.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const fileName = `ficha-epi-${safeName || sheet.worker.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  }

  @Get('trabalhadores/:id/facial-reference')
  async trabalhadorFacialReference(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    this.assertClient(user);
    const file = await this.portal.getWorkerFacialReferenceAbsolutePath(
      user.organizationId,
      user.servedClientId,
      id,
    );
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    createReadStream(file.absolutePath).pipe(res);
  }

  @Post('trabalhadores/:id/facial-match')
  trabalhadorFacialMatch(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
    @Body()
    body: {
      faceDescriptor?: number[];
    },
  ) {
    this.assertClient(user);
    if (!Array.isArray(body?.faceDescriptor)) {
      throw new BadRequestException('faceDescriptor obrigatorio.');
    }
    return this.portal.previewFacialMatch(
      user.organizationId,
      user.servedClientId,
      id,
      body.faceDescriptor,
    );
  }

  @Get('estoque')
  estoque(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.getEstoqueResumo(
      user.organizationId,
      user.servedClientId,
    );
  }

  @Get('epis/search')
  searchEpis(
    @CurrentUser() user: ClientJwtPayload,
    @Query('q') q = '',
  ) {
    this.assertClient(user);
    return this.portal.searchEpis(user.organizationId, user.servedClientId, q);
  }

  @Get('epis/by-ca')
  lookupEpiByCa(
    @CurrentUser() user: ClientJwtPayload,
    @Query('ca') ca = '',
  ) {
    this.assertClient(user);
    return this.portal.lookupEpiByCa(user.organizationId, ca);
  }

  /** Mesma busca CAEPI do catalogo mestre da Consultoria, no JWT do cliente. */
  @Get('caepi/search')
  searchCaepi(
    @CurrentUser() user: ClientJwtPayload,
    @Query('q') q = '',
    @Query('limit') limitRaw?: string,
    @Query('validOnly') validOnlyRaw?: string,
  ) {
    this.assertClient(user);
    const limit = limitRaw ? Number(limitRaw) : 12;
    const validOnly =
      validOnlyRaw === '1' ||
      validOnlyRaw === 'true' ||
      validOnlyRaw === 'yes';
    return this.portal.searchCaepiBase(q, limit, { validOnly });
  }

  @Get('stock/locations')
  stockLocations(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.listStockLocations(
      user.organizationId,
      user.servedClientId,
    );
  }

  @Get('stock/balances')
  stockBalances(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.listClientBalances(
      user.organizationId,
      user.servedClientId,
    );
  }

  @Post('stock/entradas')
  stockEntradas(
    @CurrentUser() user: ClientJwtPayload,
    @Body() dto: PortalStockEntradasDto,
  ) {
    this.assertClient(user);
    return this.portal.createEntradas(
      user.organizationId,
      user.servedClientId,
      user.sub,
      dto,
    );
  }

  @Post('stock/saidas')
  stockSaidas(
    @CurrentUser() user: ClientJwtPayload,
    @Body() dto: PortalStockSaidaDto,
  ) {
    this.assertClient(user);
    return this.portal.createSaidaManual(
      user.organizationId,
      user.servedClientId,
      user.sub,
      dto,
    );
  }

  @Get('custos')
  custosDashboard(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.getCustosDashboard(
      user.organizationId,
      user.servedClientId,
    );
  }

  @Post('custos/invoices')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  )
  uploadInvoice(
    @CurrentUser() user: ClientJwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body()
    body: { number?: string; supplierName?: string; notes?: string },
  ) {
    this.assertClient(user);
    if (!file) {
      throw new BadRequestException(
        'Envie o arquivo da nota no campo multipart "file".',
      );
    }
    return this.portal.uploadInvoiceDocument(
      user.organizationId,
      user.servedClientId!,
      user.sub,
      file,
      body,
    );
  }

  @Post('custos/invoices/:id/extract')
  extractInvoice(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
  ) {
    this.assertClient(user);
    return this.portal.extractInvoiceDocument(
      user.organizationId,
      user.servedClientId!,
      id,
    );
  }

  private assertClient(user: ClientJwtPayload) {
    if (!user.servedClientId) {
      throw new NotFoundException('Cliente do portal nao identificado.');
    }
  }

  private assertClientManager(user: ClientJwtPayload) {
    if (user.clientRole !== 'CLIENT_MANAGER') {
      throw new ForbiddenException(
        'Apenas o gestor da empresa pode atualizar o PGR.',
      );
    }
  }

  private parseReportFilters(
    query: Record<string, string | undefined>,
  ): PortalReportFilters {
    return {
      from: query.from,
      to: query.to,
      workerId: query.workerId,
      unitId: query.unitId,
      sectorId: query.sectorId,
      jobFunctionId: query.jobFunctionId,
      epiNeedId: query.epiNeedId,
      epiItemId: query.epiItemId,
      status: query.status,
      stockLocationId: query.stockLocationId,
      stockStatus: query.stockStatus,
    };
  }
}
