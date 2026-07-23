import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OccupationalRiskCategory,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateClientJobFunctionDto,
  CreateClientSectorDto,
  CreateOccupationalRiskDto,
  LinkJobFunctionRiskDto,
  UpdateClientJobFunctionDto,
  UpdateClientSectorDto,
  UpdateOccupationalRiskDto,
} from './dto/client-structure.dto';
import { DEFAULT_OCCUPATIONAL_RISK_SEEDS } from './risk-seeds';

function parseAliases(value: Prisma.JsonValue | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

@Injectable()
export class ClientStructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- Sectors ----

  async listSectors(
    organizationId: string,
    servedClientId: string,
    status: 'all' | 'active' | 'inactive' = 'all',
  ) {
    await this.assertClient(organizationId, servedClientId);
    return this.prisma.clientSector.findMany({
      where: {
        organizationId,
        servedClientId,
        ...(status === 'active' ? { isActive: true } : {}),
        ...(status === 'inactive' ? { isActive: false } : {}),
      },
      include: {
        operationalUnit: { select: { id: true, name: true, status: true } },
        _count: { select: { jobFunctions: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createSector(
    organizationId: string,
    userId: string,
    dto: CreateClientSectorDto,
  ) {
    await this.assertClient(organizationId, dto.servedClientId);
    const unitId = dto.operationalUnitId?.trim() || null;
    if (unitId) {
      await this.assertUnit(organizationId, dto.servedClientId, unitId);
    }
    await this.assertUniqueSectorName(
      organizationId,
      dto.servedClientId,
      dto.name.trim(),
      unitId,
    );

    const sector = await this.prisma.clientSector.create({
      data: {
        organizationId,
        servedClientId: dto.servedClientId,
        operationalUnitId: unitId,
        name: dto.name.trim(),
        description: this.text(dto.description),
      },
      include: {
        operationalUnit: { select: { id: true, name: true, status: true } },
        _count: { select: { jobFunctions: true } },
      },
    });

    await this.audit.log({
      action: 'client_sector.created',
      organizationId,
      userId,
      entityType: 'ClientSector',
      entityId: sector.id,
      metadata: {
        servedClientId: sector.servedClientId,
        name: sector.name,
      },
    });

    return sector;
  }

  async updateSector(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateClientSectorDto,
  ) {
    const existing = await this.requireSector(organizationId, id);
    const unitId =
      dto.operationalUnitId === undefined
        ? existing.operationalUnitId
        : dto.operationalUnitId?.trim() || null;
    if (unitId) {
      await this.assertUnit(organizationId, existing.servedClientId, unitId);
    }
    const nextName = dto.name?.trim() ?? existing.name;
    if (
      nextName.toLowerCase() !== existing.name.toLowerCase() ||
      unitId !== existing.operationalUnitId
    ) {
      await this.assertUniqueSectorName(
        organizationId,
        existing.servedClientId,
        nextName,
        unitId,
        id,
      );
    }

    const sector = await this.prisma.clientSector.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : this.text(dto.description),
        operationalUnitId:
          dto.operationalUnitId === undefined ? undefined : unitId,
      },
      include: {
        operationalUnit: { select: { id: true, name: true, status: true } },
        _count: { select: { jobFunctions: true } },
      },
    });

    await this.audit.log({
      action: 'client_sector.updated',
      organizationId,
      userId,
      entityType: 'ClientSector',
      entityId: sector.id,
      metadata: { name: sector.name },
    });

    return sector;
  }

  async updateSectorStatus(
    organizationId: string,
    userId: string,
    id: string,
    isActive: boolean,
  ) {
    const existing = await this.requireSector(organizationId, id);
    if (existing.isActive === isActive) return existing;
    const sector = await this.prisma.clientSector.update({
      where: { id },
      data: { isActive },
    });
    await this.audit.log({
      action: 'client_sector.status_changed',
      organizationId,
      userId,
      entityType: 'ClientSector',
      entityId: id,
      metadata: { from: existing.isActive, to: isActive },
    });
    return sector;
  }

  // ---- Job functions ----

  async listJobFunctions(
    organizationId: string,
    filters: {
      servedClientId: string;
      sectorId?: string;
      status?: 'all' | 'active' | 'inactive';
    },
  ) {
    await this.assertClient(organizationId, filters.servedClientId);
    const status = filters.status ?? 'all';
    return this.prisma.clientJobFunction.findMany({
      where: {
        organizationId,
        servedClientId: filters.servedClientId,
        ...(filters.sectorId ? { sectorId: filters.sectorId } : {}),
        ...(status === 'active' ? { isActive: true } : {}),
        ...(status === 'inactive' ? { isActive: false } : {}),
      },
      include: {
        sector: { select: { id: true, name: true, isActive: true } },
        risks: {
          include: {
            risk: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { risks: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async getJobFunction(organizationId: string, id: string) {
    const job = await this.prisma.clientJobFunction.findFirst({
      where: { id, organizationId },
      include: {
        sector: true,
        risks: {
          include: { risk: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!job) {
      throw new NotFoundException('Funcao nao encontrada.');
    }
    return {
      ...job,
      risks: job.risks.map((link) => ({
        ...link,
        risk: {
          ...link.risk,
          aliases: parseAliases(link.risk.aliases),
        },
      })),
    };
  }

  async createJobFunction(
    organizationId: string,
    userId: string,
    dto: CreateClientJobFunctionDto,
  ) {
    await this.assertClient(organizationId, dto.servedClientId);
    const sector = await this.requireSector(organizationId, dto.sectorId);
    if (sector.servedClientId !== dto.servedClientId) {
      throw new BadRequestException(
        'O setor nao pertence ao cliente informado.',
      );
    }
    await this.assertUniqueJobName(
      organizationId,
      dto.sectorId,
      dto.name.trim(),
    );

    const job = await this.prisma.clientJobFunction.create({
      data: {
        organizationId,
        servedClientId: dto.servedClientId,
        sectorId: dto.sectorId,
        name: dto.name.trim(),
        description: this.text(dto.description),
        environmentDescription: this.text(dto.environmentDescription),
      },
      include: {
        sector: { select: { id: true, name: true, isActive: true } },
        risks: { include: { risk: true } },
        _count: { select: { risks: true } },
      },
    });

    await this.audit.log({
      action: 'client_job_function.created',
      organizationId,
      userId,
      entityType: 'ClientJobFunction',
      entityId: job.id,
      metadata: {
        servedClientId: job.servedClientId,
        sectorId: job.sectorId,
        name: job.name,
      },
    });

    return job;
  }

  async updateJobFunction(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateClientJobFunctionDto,
  ) {
    const existing = await this.requireJob(organizationId, id);
    const nextSectorId = dto.sectorId ?? existing.sectorId;
    if (dto.sectorId) {
      const sector = await this.requireSector(organizationId, dto.sectorId);
      if (sector.servedClientId !== existing.servedClientId) {
        throw new BadRequestException(
          'O setor nao pertence ao mesmo cliente da funcao.',
        );
      }
    }
    const nextName = dto.name?.trim() ?? existing.name;
    if (
      nextName.toLowerCase() !== existing.name.toLowerCase() ||
      nextSectorId !== existing.sectorId
    ) {
      await this.assertUniqueJobName(
        organizationId,
        nextSectorId,
        nextName,
        id,
      );
    }

    const job = await this.prisma.clientJobFunction.update({
      where: { id },
      data: {
        sectorId: dto.sectorId,
        name: dto.name?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : this.text(dto.description),
        environmentDescription:
          dto.environmentDescription === undefined
            ? undefined
            : this.text(dto.environmentDescription),
      },
      include: {
        sector: { select: { id: true, name: true, isActive: true } },
        risks: { include: { risk: true } },
        _count: { select: { risks: true } },
      },
    });

    await this.audit.log({
      action: 'client_job_function.updated',
      organizationId,
      userId,
      entityType: 'ClientJobFunction',
      entityId: id,
      metadata: { name: job.name },
    });

    return job;
  }

  async updateJobFunctionStatus(
    organizationId: string,
    userId: string,
    id: string,
    isActive: boolean,
  ) {
    const existing = await this.requireJob(organizationId, id);
    if (existing.isActive === isActive) return existing;
    const job = await this.prisma.clientJobFunction.update({
      where: { id },
      data: { isActive },
    });
    await this.audit.log({
      action: 'client_job_function.status_changed',
      organizationId,
      userId,
      entityType: 'ClientJobFunction',
      entityId: id,
      metadata: { from: existing.isActive, to: isActive },
    });
    return job;
  }

  async linkRisk(
    organizationId: string,
    userId: string,
    jobFunctionId: string,
    dto: LinkJobFunctionRiskDto,
  ) {
    const job = await this.requireJob(organizationId, jobFunctionId);
    await this.requireRisk(organizationId, dto.riskId);

    const existing = await this.prisma.jobFunctionRisk.findFirst({
      where: {
        organizationId,
        jobFunctionId,
        riskId: dto.riskId,
      },
    });
    if (existing) {
      throw new ConflictException(
        'Este risco ja esta vinculado a esta funcao.',
      );
    }

    const link = await this.prisma.jobFunctionRisk.create({
      data: {
        organizationId,
        jobFunctionId,
        riskId: dto.riskId,
        exposure: this.text(dto.exposure),
        source: this.text(dto.source),
        possibleDamage: this.text(dto.possibleDamage),
        riskLevel: dto.riskLevel,
        notes: this.text(dto.notes),
      },
      include: { risk: true },
    });

    await this.audit.log({
      action: 'job_function_risk.linked',
      organizationId,
      userId,
      entityType: 'JobFunctionRisk',
      entityId: link.id,
      metadata: {
        jobFunctionId,
        riskId: dto.riskId,
        servedClientId: job.servedClientId,
      },
    });

    return {
      ...link,
      risk: { ...link.risk, aliases: parseAliases(link.risk.aliases) },
    };
  }

  async unlinkRisk(
    organizationId: string,
    userId: string,
    jobFunctionId: string,
    riskId: string,
  ) {
    await this.requireJob(organizationId, jobFunctionId);
    const existing = await this.prisma.jobFunctionRisk.findFirst({
      where: { organizationId, jobFunctionId, riskId },
    });
    if (!existing) {
      throw new NotFoundException('Vinculo de risco nao encontrado.');
    }
    await this.prisma.jobFunctionRisk.delete({ where: { id: existing.id } });
    await this.audit.log({
      action: 'job_function_risk.unlinked',
      organizationId,
      userId,
      entityType: 'JobFunctionRisk',
      entityId: existing.id,
      metadata: { jobFunctionId, riskId },
    });
    return { ok: true };
  }

  // ---- Risks catalog ----

  async listRisks(
    organizationId: string,
    filters: {
      q?: string;
      category?: string;
      status?: 'all' | 'active' | 'inactive';
    },
  ) {
    const status = filters.status ?? 'all';
    const q = filters.q?.trim();
    const risks = await this.prisma.occupationalRisk.findMany({
      where: {
        organizationId,
        ...(status === 'active' ? { isActive: true } : {}),
        ...(status === 'inactive' ? { isActive: false } : {}),
        ...(filters.category
          ? { category: filters.category as OccupationalRiskCategory }
          : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ isActive: 'desc' }, { category: 'asc' }, { name: 'asc' }],
    });
    return risks.map((risk) => ({
      ...risk,
      aliases: parseAliases(risk.aliases),
    }));
  }

  async createRisk(
    organizationId: string,
    userId: string,
    dto: CreateOccupationalRiskDto,
  ) {
    await this.assertUniqueRisk(
      organizationId,
      dto.name.trim(),
      dto.category,
    );
    const risk = await this.prisma.occupationalRisk.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        category: dto.category,
        description: this.text(dto.description),
        aliases: this.aliases(dto.aliases),
      },
    });
    await this.audit.log({
      action: 'occupational_risk.created',
      organizationId,
      userId,
      entityType: 'OccupationalRisk',
      entityId: risk.id,
      metadata: { name: risk.name, category: risk.category },
    });
    return { ...risk, aliases: parseAliases(risk.aliases) };
  }

  async updateRisk(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateOccupationalRiskDto,
  ) {
    const existing = await this.requireRisk(organizationId, id);
    const nextName = dto.name?.trim() ?? existing.name;
    const nextCategory = dto.category ?? existing.category;
    if (
      nextName.toLowerCase() !== existing.name.toLowerCase() ||
      nextCategory !== existing.category
    ) {
      await this.assertUniqueRisk(
        organizationId,
        nextName,
        nextCategory,
        id,
      );
    }
    const risk = await this.prisma.occupationalRisk.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        category: dto.category,
        description:
          dto.description === undefined
            ? undefined
            : this.text(dto.description),
        aliases:
          dto.aliases === undefined ? undefined : this.aliases(dto.aliases),
      },
    });
    await this.audit.log({
      action: 'occupational_risk.updated',
      organizationId,
      userId,
      entityType: 'OccupationalRisk',
      entityId: id,
      metadata: { name: risk.name },
    });
    return { ...risk, aliases: parseAliases(risk.aliases) };
  }

  async updateRiskStatus(
    organizationId: string,
    userId: string,
    id: string,
    isActive: boolean,
  ) {
    const existing = await this.requireRisk(organizationId, id);
    if (existing.isActive === isActive) {
      return { ...existing, aliases: parseAliases(existing.aliases) };
    }
    const risk = await this.prisma.occupationalRisk.update({
      where: { id },
      data: { isActive },
    });
    await this.audit.log({
      action: 'occupational_risk.status_changed',
      organizationId,
      userId,
      entityType: 'OccupationalRisk',
      entityId: id,
      metadata: { from: existing.isActive, to: isActive },
    });
    return { ...risk, aliases: parseAliases(risk.aliases) };
  }

  async suggestDefaultRisks(organizationId: string, userId: string) {
    const existing = await this.prisma.occupationalRisk.findMany({
      where: { organizationId },
      select: { name: true, category: true },
    });
    const keys = new Set(
      existing.map((r) => `${r.category}:${r.name.toLowerCase()}`),
    );
    const created = [];
    for (const seed of DEFAULT_OCCUPATIONAL_RISK_SEEDS) {
      const key = `${seed.category}:${seed.name.toLowerCase()}`;
      if (keys.has(key)) continue;
      const risk = await this.prisma.occupationalRisk.create({
        data: {
          organizationId,
          name: seed.name,
          category: seed.category,
          description: seed.description,
          aliases: seed.aliases,
        },
      });
      created.push({ ...risk, aliases: parseAliases(risk.aliases) });
    }
    await this.audit.log({
      action: 'occupational_risk.defaults_suggested',
      organizationId,
      userId,
      entityType: 'OccupationalRisk',
      entityId: organizationId,
      metadata: { createdCount: created.length },
    });
    return {
      createdCount: created.length,
      skippedCount: DEFAULT_OCCUPATIONAL_RISK_SEEDS.length - created.length,
      created,
    };
  }

  // ---- helpers ----

  private async assertClient(organizationId: string, servedClientId: string) {
    const client = await this.prisma.servedClient.findFirst({
      where: { id: servedClientId, organizationId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente atendido nao encontrado.');
    }
  }

  private async assertUnit(
    organizationId: string,
    servedClientId: string,
    unitId: string,
  ) {
    const unit = await this.prisma.operationalUnit.findFirst({
      where: { id: unitId, organizationId, servedClientId },
      select: { id: true },
    });
    if (!unit) {
      throw new BadRequestException(
        'Unidade operacional nao encontrada neste cliente.',
      );
    }
  }

  private async requireSector(organizationId: string, id: string) {
    const sector = await this.prisma.clientSector.findFirst({
      where: { id, organizationId },
    });
    if (!sector) throw new NotFoundException('Setor nao encontrado.');
    return sector;
  }

  private async requireJob(organizationId: string, id: string) {
    const job = await this.prisma.clientJobFunction.findFirst({
      where: { id, organizationId },
    });
    if (!job) throw new NotFoundException('Funcao nao encontrada.');
    return job;
  }

  private async requireRisk(organizationId: string, id: string) {
    const risk = await this.prisma.occupationalRisk.findFirst({
      where: { id, organizationId },
    });
    if (!risk) throw new NotFoundException('Risco ocupacional nao encontrado.');
    return risk;
  }

  private async assertUniqueSectorName(
    organizationId: string,
    servedClientId: string,
    name: string,
    operationalUnitId: string | null,
    excludeId?: string,
  ) {
    const existing = await this.prisma.clientSector.findFirst({
      where: {
        organizationId,
        servedClientId,
        name: { equals: name, mode: 'insensitive' },
        ...(operationalUnitId
          ? { operationalUnitId }
          : { operationalUnitId: null }),
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ja existe um setor com este nome neste cliente/unidade.',
      );
    }
  }

  private async assertUniqueJobName(
    organizationId: string,
    sectorId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.clientJobFunction.findFirst({
      where: {
        organizationId,
        sectorId,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ja existe uma funcao com este nome neste setor.',
      );
    }
  }

  private async assertUniqueRisk(
    organizationId: string,
    name: string,
    category: OccupationalRiskCategory,
    excludeId?: string,
  ) {
    const existing = await this.prisma.occupationalRisk.findFirst({
      where: {
        organizationId,
        category,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ja existe um risco com este nome e categoria neste tenant.',
      );
    }
  }

  private text(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private aliases(
    value?: string[] | null,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (value === null) return Prisma.JsonNull;
    if (!value) return [];
    return [
      ...new Set(
        value
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 30),
      ),
    ];
  }
}
