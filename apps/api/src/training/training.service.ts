import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TrainingAssetKind,
  TrainingDeliveryKind,
} from '@prisma/client';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { formatCnpj } from '../sst-documents/sst-document-content';
import { TRAINING_DEFAULT_SEEDS } from './training-defaults';
import {
  GenerateTrainingDto,
  UpsertTrainingTemplateDto,
} from './dto/training.dto';
import { TrainingPdfService } from './training-pdf.service';
import { resolveClientLogoAbsolutePath } from '../sst-documents/sst-client-logo.storage';
import {
  deleteTrainingAssetFile,
  resolveTrainingAssetAbsolutePath,
  saveTrainingAssetFile,
} from './training-asset.storage';

const ASSET_KINDS: TrainingAssetKind[] = [
  'HEADER',
  'LEFT_LOGO',
  'RIGHT_LOGO',
  'SEAL',
];

@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pdf: TrainingPdfService,
  ) {}

  async list(organizationId: string) {
    await this.ensureDefaults(organizationId);
    const rows = await this.prisma.trainingTemplate.findMany({
      where: { organizationId },
      include: { assets: true },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return { templates: rows.map((row) => this.toTemplate(row)) };
  }

  async get(organizationId: string, id: string) {
    const row = await this.requireTemplate(organizationId, id);
    return this.toTemplate(row);
  }

  async create(
    organizationId: string,
    userId: string,
    dto: UpsertTrainingTemplateDto,
  ) {
    const row = await this.prisma.trainingTemplate.create({
      data: this.templateData(organizationId, dto),
      include: { assets: true },
    });
    await this.audit.log({
      action: 'training.template.create',
      organizationId,
      userId,
      entityType: 'TrainingTemplate',
      entityId: row.id,
    });
    return this.toTemplate(row);
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpsertTrainingTemplateDto,
  ) {
    await this.requireTemplate(organizationId, id);
    const row = await this.prisma.trainingTemplate.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        courseTitle: dto.courseTitle.trim(),
        nrLabel: dto.nrLabel?.trim() ?? '',
        defaultHours: dto.defaultHours ?? 8,
        defaultLocation: dto.defaultLocation?.trim() || 'Sala de Treinamento',
        certificateCourseClause: dto.certificateCourseClause.trim(),
        topics: (dto.topics ?? []).map((item) => item.trim()).filter(Boolean),
        registerSummary: dto.registerSummary?.trim() ?? '',
        instructorName: dto.instructorName?.trim() ?? '',
        instructorRole:
          dto.instructorRole?.trim() || 'Tecnico em Seguranca do Trabalho',
        instructorRegistry: dto.instructorRegistry?.trim() ?? '',
        includeCertificate: dto.includeCertificate ?? true,
        includeRegister: dto.includeRegister ?? true,
        isActive: dto.isActive ?? true,
      },
      include: { assets: true },
    });
    await this.audit.log({
      action: 'training.template.update',
      organizationId,
      userId,
      entityType: 'TrainingTemplate',
      entityId: id,
    });
    return this.toTemplate(row);
  }

  async seedDefaults(organizationId: string, userId: string) {
    const created = await this.ensureDefaults(organizationId);
    await this.audit.log({
      action: 'training.template.seed',
      organizationId,
      userId,
      entityType: 'TrainingTemplate',
      metadata: { created },
    });
    return this.list(organizationId);
  }

  async generationDefaults(organizationId: string, servedClientId: string) {
    if (!servedClientId?.trim()) {
      throw new BadRequestException('Informe o cliente.');
    }
    const client = await this.requireClient(organizationId, servedClientId);
    const unitWithAddress = await this.prisma.operationalUnit.findFirst({
      where: {
        organizationId,
        servedClientId,
        status: 'ACTIVE',
        addressLine: { not: null },
        NOT: { addressLine: '' },
      },
      orderBy: { createdAt: 'asc' },
    });
    const unit =
      unitWithAddress ??
      (await this.prisma.operationalUnit.findFirst({
        where: { organizationId, servedClientId, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      }));
    const addressParts = [
      unit?.addressLine?.trim(),
      [unit?.city?.trim(), unit?.state?.trim()].filter(Boolean).join(' - '),
    ].filter(Boolean);
    const address = addressParts.join(', ');
    return {
      servedClientId: client.id,
      legalName: client.legalName,
      tradeName: client.tradeName,
      cnpj: client.cnpj,
      cnpjFormatted: formatCnpj(client.cnpj),
      address,
      location: unit?.name ?? 'Sala de Treinamento',
    };
  }

  async saveAsset(
    organizationId: string,
    userId: string,
    templateId: string,
    kind: TrainingAssetKind,
    file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie a imagem do modelo.');
    }
    await this.requireTemplate(organizationId, templateId);
    const saved = await saveTrainingAssetFile({
      organizationId,
      templateId,
      kind,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
    });
    const existing = await this.prisma.trainingTemplateAsset.findUnique({
      where: { templateId_kind: { templateId, kind } },
    });
    if (existing && existing.relativePath !== saved.relativePath) {
      await deleteTrainingAssetFile(existing.relativePath);
    }
    await this.prisma.trainingTemplateAsset.upsert({
      where: { templateId_kind: { templateId, kind } },
      create: {
        organizationId,
        templateId,
        kind,
        relativePath: saved.relativePath,
        mimeType: saved.mimeType,
      },
      update: {
        relativePath: saved.relativePath,
        mimeType: saved.mimeType,
      },
    });
    await this.audit.log({
      action: 'training.template.asset',
      organizationId,
      userId,
      entityType: 'TrainingTemplate',
      entityId: templateId,
      metadata: { kind },
    });
    return this.get(organizationId, templateId);
  }

  streamAsset(
    organizationId: string,
    templateId: string,
    kind: TrainingAssetKind,
    res: Response,
  ) {
    return this.requireTemplate(organizationId, templateId).then((row) => {
      const asset = row.assets.find((item) => item.kind === kind);
      if (!asset) throw new NotFoundException('Imagem nao cadastrada.');
      const absolute = resolveTrainingAssetAbsolutePath(asset.relativePath);
      if (!absolute) throw new NotFoundException('Arquivo da imagem ausente.');
      res.setHeader('Content-Type', asset.mimeType);
      res.setHeader('Cache-Control', 'private, max-age=60');
      createReadStream(absolute).pipe(res);
    });
  }

  async deleteAsset(
    organizationId: string,
    userId: string,
    templateId: string,
    kind: TrainingAssetKind,
  ) {
    await this.requireTemplate(organizationId, templateId);
    const existing = await this.prisma.trainingTemplateAsset.findUnique({
      where: { templateId_kind: { templateId, kind } },
    });
    if (existing) {
      await deleteTrainingAssetFile(existing.relativePath);
      await this.prisma.trainingTemplateAsset.delete({
        where: { id: existing.id },
      });
    }
    await this.audit.log({
      action: 'training.template.asset.delete',
      organizationId,
      userId,
      entityType: 'TrainingTemplate',
      entityId: templateId,
      metadata: { kind },
    });
    return this.get(organizationId, templateId);
  }

  async listIssuances(organizationId: string) {
    const rows = await this.prisma.trainingIssuance.findMany({
      where: { organizationId },
      include: {
        template: { select: { name: true, courseTitle: true } },
        servedClient: { select: { legalName: true, tradeName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    return {
      issuances: rows.map((row) => ({
        id: row.id,
        templateId: row.templateId,
        templateName: row.template.name,
        courseTitle: row.template.courseTitle,
        servedClientId: row.servedClientId,
        clientName:
          row.servedClient.tradeName?.trim() || row.servedClient.legalName,
        heldOn: row.heldOn.toISOString(),
        hours: row.hours,
        controlNumber: row.controlNumber,
        workerCount: Array.isArray(row.workerIds) ? row.workerIds.length : 0,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async generatePdf(
    organizationId: string,
    userId: string,
    templateId: string,
    dto: GenerateTrainingDto,
  ) {
    const template = await this.requireTemplate(organizationId, templateId);
    if (!template.includeCertificate && !template.includeRegister) {
      throw new BadRequestException(
        'Marque certificado e/ou registro neste modelo.',
      );
    }
    const client = await this.requireClient(organizationId, dto.servedClientId);
    const uniqueIds = [...new Set(dto.workerIds.map((id) => id.trim()))];
    const workers = await this.prisma.worker.findMany({
      where: {
        organizationId,
        servedClientId: client.id,
        id: { in: uniqueIds },
      },
      include: {
        clientJobFunction: { select: { name: true } },
      },
    });
    if (workers.length !== uniqueIds.length) {
      throw new BadRequestException(
        'Um ou mais trabalhadores nao pertencem a este cliente.',
      );
    }
    const ordered = uniqueIds
      .map((id) => workers.find((row) => row.id === id))
      .filter((row): row is (typeof workers)[number] => Boolean(row));

    const heldOn = new Date(`${dto.heldOn}T12:00:00.000Z`);
    if (Number.isNaN(heldOn.getTime())) {
      throw new BadRequestException('Data invalida.');
    }
    const year = heldOn.getUTCFullYear();
    const controlNumber =
      dto.controlNumber?.trim() ||
      (await this.nextControlNumber(organizationId, year));
    const defaults = await this.generationDefaults(organizationId, client.id);
    const address = dto.address?.trim() || defaults.address;
    if (!address) {
      throw new BadRequestException(
        'Informe o endereco do curso (verso e registro).',
      );
    }

    const issuance = await this.prisma.trainingIssuance.create({
      data: {
        organizationId,
        templateId: template.id,
        servedClientId: client.id,
        createdByUserId: userId,
        heldOn,
        hours: dto.hours,
        location: dto.location?.trim() || template.defaultLocation,
        address,
        instructorName: dto.instructorName?.trim() || template.instructorName,
        instructorRole: dto.instructorRole?.trim() || template.instructorRole,
        instructorRegistry:
          dto.instructorRegistry?.trim() || template.instructorRegistry,
        legalRepName: dto.legalRepName?.trim() || '',
        deliveryKind: dto.deliveryKind ?? TrainingDeliveryKind.INTERNO,
        controlNumber,
        workerIds: uniqueIds,
      },
    });

    const assets: Record<string, string> = {};
    for (const asset of template.assets) {
      const absolute = resolveTrainingAssetAbsolutePath(asset.relativePath);
      if (absolute) assets[asset.kind] = absolute;
    }
    const clientLogoPath = await this.resolveClientLogo(client.id);

    const buffer = await this.pdf.build({
      includeCertificate: template.includeCertificate,
      includeRegister: template.includeRegister,
      courseTitle: template.courseTitle,
      nrLabel: template.nrLabel,
      certificateCourseClause: template.certificateCourseClause,
      topics: template.topics,
      registerSummary: template.registerSummary,
      companyLegalName: client.legalName,
      companyTradeName: client.tradeName,
      companyCnpj: client.cnpj,
      heldOn,
      hours: dto.hours,
      location: issuance.location,
      address: issuance.address,
      instructorName: issuance.instructorName,
      instructorRole: issuance.instructorRole,
      instructorRegistry: issuance.instructorRegistry,
      legalRepName: issuance.legalRepName,
      deliveryKind: issuance.deliveryKind,
      controlNumber,
      workers: ordered.map((worker) => ({
        name: worker.name,
        cpf: worker.cpf,
        jobFunction: worker.clientJobFunction?.name || worker.role || '—',
      })),
      assets,
      clientLogoPath,
    });

    await this.audit.log({
      action: 'training.generate',
      organizationId,
      userId,
      entityType: 'TrainingIssuance',
      entityId: issuance.id,
      metadata: { workerCount: ordered.length, templateId: template.id },
    });

    const slug = template.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    return {
      buffer,
      fileName: `${slug || 'certificados'}-${controlNumber}.pdf`,
      issuanceId: issuance.id,
    };
  }

  async reprintPdf(organizationId: string, issuanceId: string) {
    const issuance = await this.prisma.trainingIssuance.findFirst({
      where: { id: issuanceId, organizationId },
      include: {
        template: { include: { assets: true } },
        servedClient: true,
      },
    });
    if (!issuance) throw new NotFoundException('Emissao nao encontrada.');
    const workerIds = Array.isArray(issuance.workerIds)
      ? (issuance.workerIds as string[])
      : [];
    const workers = await this.prisma.worker.findMany({
      where: { organizationId, id: { in: workerIds } },
      include: { clientJobFunction: { select: { name: true } } },
    });
    const ordered = workerIds
      .map((id) => workers.find((row) => row.id === id))
      .filter((row): row is (typeof workers)[number] => Boolean(row));
    const assets: Record<string, string> = {};
    for (const asset of issuance.template.assets) {
      const absolute = resolveTrainingAssetAbsolutePath(asset.relativePath);
      if (absolute) assets[asset.kind] = absolute;
    }
    const clientLogoPath = await this.resolveClientLogo(issuance.servedClientId);
    const buffer = await this.pdf.build({
      includeCertificate: issuance.template.includeCertificate,
      includeRegister: issuance.template.includeRegister,
      courseTitle: issuance.template.courseTitle,
      nrLabel: issuance.template.nrLabel,
      certificateCourseClause: issuance.template.certificateCourseClause,
      topics: issuance.template.topics,
      registerSummary: issuance.template.registerSummary,
      companyLegalName: issuance.servedClient.legalName,
      companyTradeName: issuance.servedClient.tradeName,
      companyCnpj: issuance.servedClient.cnpj,
      heldOn: issuance.heldOn,
      hours: issuance.hours,
      location: issuance.location,
      address: issuance.address,
      instructorName: issuance.instructorName,
      instructorRole: issuance.instructorRole,
      instructorRegistry: issuance.instructorRegistry,
      legalRepName: issuance.legalRepName,
      deliveryKind: issuance.deliveryKind,
      controlNumber: issuance.controlNumber || issuance.id.slice(-6),
      workers: ordered.map((worker) => ({
        name: worker.name,
        cpf: worker.cpf,
        jobFunction: worker.clientJobFunction?.name || worker.role || '—',
      })),
      assets,
      clientLogoPath,
    });
    return {
      buffer,
      fileName: `reimpressao-${issuance.controlNumber || issuance.id.slice(-6)}.pdf`,
    };
  }

  parseAssetKind(raw: string): TrainingAssetKind {
    const kind = raw.toUpperCase() as TrainingAssetKind;
    if (!ASSET_KINDS.includes(kind)) {
      throw new BadRequestException('Tipo de imagem invalido.');
    }
    return kind;
  }

  private async nextControlNumber(organizationId: string, year: number) {
    const count = await this.prisma.trainingIssuance.count({
      where: {
        organizationId,
        createdAt: {
          gte: new Date(`${year}-01-01T00:00:00.000Z`),
          lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
        },
      },
    });
    return `TT-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async ensureDefaults(organizationId: string) {
    const existing = await this.prisma.trainingTemplate.count({
      where: { organizationId },
    });
    if (existing === 0) {
      await this.prisma.trainingTemplate.createMany({
        data: TRAINING_DEFAULT_SEEDS.map((seed) => ({
          organizationId,
          name: seed.name,
          courseTitle: seed.courseTitle,
          nrLabel: seed.nrLabel,
          defaultHours: seed.defaultHours,
          defaultLocation: seed.defaultLocation,
          certificateCourseClause: seed.certificateCourseClause,
          topics: seed.topics,
          registerSummary: seed.registerSummary,
          instructorRole: seed.instructorRole,
          instructorName: seed.instructorName,
          instructorRegistry: seed.instructorRegistry,
        })),
      });
      return TRAINING_DEFAULT_SEEDS.length;
    }
    await this.refreshAsciiSeedCopy(organizationId);
    return 0;
  }

  private async refreshAsciiSeedCopy(organizationId: string) {
    const nr01 = TRAINING_DEFAULT_SEEDS[0];
    const nr35 = TRAINING_DEFAULT_SEEDS[1];
    await this.prisma.trainingTemplate.updateMany({
      where: {
        organizationId,
        nrLabel: nr01.nrLabel,
        certificateCourseClause: { contains: 'Integracao de Seguranca' },
      },
      data: {
        name: nr01.name,
        courseTitle: nr01.courseTitle,
        certificateCourseClause: nr01.certificateCourseClause,
        topics: { set: nr01.topics },
        registerSummary: nr01.registerSummary,
        instructorRole: nr01.instructorRole,
        instructorName: nr01.instructorName,
        instructorRegistry: nr01.instructorRegistry,
      },
    });
    await this.prisma.trainingTemplate.updateMany({
      where: {
        organizationId,
        nrLabel: nr35.nrLabel,
        certificateCourseClause: { contains: 'Capacitacao de Trabalho' },
      },
      data: {
        name: nr35.name,
        courseTitle: nr35.courseTitle,
        certificateCourseClause: nr35.certificateCourseClause,
        topics: { set: nr35.topics },
        registerSummary: nr35.registerSummary,
        instructorRole: nr35.instructorRole,
        instructorName: nr35.instructorName,
        instructorRegistry: nr35.instructorRegistry,
      },
    });
    await this.prisma.trainingTemplate.updateMany({
      where: { organizationId, instructorName: '' },
      data: {
        instructorName: nr01.instructorName,
        instructorRegistry: nr01.instructorRegistry,
      },
    });
  }

  private async resolveClientLogo(servedClientId: string) {
    const profile = await this.prisma.sstClientProfile.findUnique({
      where: { servedClientId },
      select: { logoPath: true },
    });
    if (!profile?.logoPath) return null;
    return resolveClientLogoAbsolutePath(profile.logoPath);
  }

  private templateData(
    organizationId: string,
    dto: UpsertTrainingTemplateDto,
  ): Prisma.TrainingTemplateUncheckedCreateInput {
    return {
      organizationId,
      name: dto.name.trim(),
      courseTitle: dto.courseTitle.trim(),
      nrLabel: dto.nrLabel?.trim() ?? '',
      defaultHours: dto.defaultHours ?? 8,
      defaultLocation: dto.defaultLocation?.trim() || 'Sala de Treinamento',
      certificateCourseClause: dto.certificateCourseClause.trim(),
      topics: (dto.topics ?? [])
        .map((item) => item.trim())
        .filter(Boolean),
      registerSummary: dto.registerSummary?.trim() ?? '',
      instructorName: dto.instructorName?.trim() ?? '',
      instructorRole:
        dto.instructorRole?.trim() || 'Tecnico em Seguranca do Trabalho',
      instructorRegistry: dto.instructorRegistry?.trim() ?? '',
      includeCertificate: dto.includeCertificate ?? true,
      includeRegister: dto.includeRegister ?? true,
      isActive: dto.isActive ?? true,
    };
  }

  private async requireTemplate(organizationId: string, id: string) {
    const row = await this.prisma.trainingTemplate.findFirst({
      where: { id, organizationId },
      include: { assets: true },
    });
    if (!row) throw new NotFoundException('Modelo nao encontrado.');
    return row;
  }

  private async requireClient(organizationId: string, servedClientId: string) {
    const client = await this.prisma.servedClient.findFirst({
      where: { id: servedClientId, organizationId },
    });
    if (!client) throw new NotFoundException('Cliente nao encontrado.');
    return client;
  }

  private toTemplate(
    row: Prisma.TrainingTemplateGetPayload<{ include: { assets: true } }>,
  ) {
    const kinds = new Set(row.assets.map((asset) => asset.kind));
    return {
      id: row.id,
      name: row.name,
      courseTitle: row.courseTitle,
      nrLabel: row.nrLabel,
      defaultHours: row.defaultHours,
      defaultLocation: row.defaultLocation,
      certificateCourseClause: row.certificateCourseClause,
      topics: row.topics,
      registerSummary: row.registerSummary,
      instructorName: row.instructorName,
      instructorRole: row.instructorRole,
      instructorRegistry: row.instructorRegistry,
      includeCertificate: row.includeCertificate,
      includeRegister: row.includeRegister,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      assets: ASSET_KINDS.map((kind) => ({
        kind,
        present: kinds.has(kind),
      })),
    };
  }
}
