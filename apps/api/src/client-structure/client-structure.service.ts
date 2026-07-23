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
  CreateJobFunctionEpiRequirementDto,
  CreateOccupationalRiskDto,
  LinkJobFunctionRiskDto,
  UpdateClientJobFunctionDto,
  UpdateClientSectorDto,
  UpdateJobFunctionEpiRequirementDto,
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

const jobEpiRequirementInclude = {
  risk: true,
  epiNeed: {
    include: {
      _count: { select: { itemLinks: true } },
    },
  },
} as const;

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
    const rows = await this.prisma.clientJobFunction.findMany({
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
        epiRequirements: {
          include: jobEpiRequirementInclude,
          orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
        },
        _count: { select: { risks: true, epiRequirements: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return this.mapJobsWithRequirements(organizationId, rows);
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
        epiRequirements: {
          include: jobEpiRequirementInclude,
          orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!job) {
      throw new NotFoundException('Funcao nao encontrada.');
    }
    const [mapped] = await this.mapJobsWithRequirements(organizationId, [job]);
    return mapped;
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

  // ---- EPI requirements ----

  async listEpiRequirements(organizationId: string, jobFunctionId: string) {
    await this.requireJob(organizationId, jobFunctionId);
    const rows = await this.prisma.jobFunctionEpiRequirement.findMany({
      where: { organizationId, jobFunctionId },
      include: jobEpiRequirementInclude,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    return this.mapEpiRequirements(organizationId, rows);
  }

  async createEpiRequirement(
    organizationId: string,
    userId: string,
    jobFunctionId: string,
    dto: CreateJobFunctionEpiRequirementDto,
  ) {
    const job = await this.requireJob(organizationId, jobFunctionId);
    const riskId = dto.riskId?.trim() || null;
    if (riskId) {
      await this.assertRiskLinkedOrTenant(
        organizationId,
        jobFunctionId,
        riskId,
      );
    }
    await this.requireEpiNeed(organizationId, dto.epiNeedId);
    const quantity = dto.quantity ?? 1;
    if (quantity < 1) {
      throw new BadRequestException('Quantidade deve ser maior que zero.');
    }
    if (
      dto.replacementIntervalDays != null &&
      dto.replacementIntervalDays < 1
    ) {
      throw new BadRequestException(
        'Periodicidade deve ser maior que zero quando informada.',
      );
    }
    await this.assertUniqueEpiRequirement(
      organizationId,
      jobFunctionId,
      riskId,
      dto.epiNeedId,
    );

    try {
      const created = await this.prisma.jobFunctionEpiRequirement.create({
        data: {
          organizationId,
          jobFunctionId,
          riskId,
          epiNeedId: dto.epiNeedId,
          isRequired: dto.isRequired ?? true,
          quantity,
          replacementIntervalDays: dto.replacementIntervalDays ?? null,
          notes: this.text(dto.notes),
          source: dto.source ?? 'MANUAL',
        },
        include: jobEpiRequirementInclude,
      });

      await this.audit.log({
        action: 'job_function_epi_requirement.created',
        organizationId,
        userId,
        entityType: 'JobFunctionEpiRequirement',
        entityId: created.id,
        metadata: {
          jobFunctionId,
          epiNeedId: dto.epiNeedId,
          riskId,
          servedClientId: job.servedClientId,
        },
      });

      const [mapped] = await this.mapEpiRequirements(organizationId, [created]);
      return mapped;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ja existe um requisito ativo com esta necessidade (e risco) para a funcao.',
        );
      }
      throw err;
    }
  }

  async updateEpiRequirement(
    organizationId: string,
    userId: string,
    jobFunctionId: string,
    requirementId: string,
    dto: UpdateJobFunctionEpiRequirementDto,
  ) {
    const existing = await this.requireEpiRequirement(
      organizationId,
      jobFunctionId,
      requirementId,
    );
    const nextNeedId = dto.epiNeedId ?? existing.epiNeedId;
    const nextRiskId =
      dto.riskId === undefined
        ? existing.riskId
        : dto.riskId?.trim() || null;
    if (dto.epiNeedId) {
      await this.requireEpiNeed(organizationId, dto.epiNeedId);
    }
    if (nextRiskId) {
      await this.assertRiskLinkedOrTenant(
        organizationId,
        jobFunctionId,
        nextRiskId,
      );
    }
    if (dto.quantity != null && dto.quantity < 1) {
      throw new BadRequestException('Quantidade deve ser maior que zero.');
    }
    if (
      dto.replacementIntervalDays != null &&
      dto.replacementIntervalDays < 1
    ) {
      throw new BadRequestException(
        'Periodicidade deve ser maior que zero quando informada.',
      );
    }
    if (
      nextNeedId !== existing.epiNeedId ||
      nextRiskId !== existing.riskId
    ) {
      await this.assertUniqueEpiRequirement(
        organizationId,
        jobFunctionId,
        nextRiskId,
        nextNeedId,
        requirementId,
      );
    }

    try {
      const updated = await this.prisma.jobFunctionEpiRequirement.update({
        where: { id: requirementId },
        data: {
          epiNeedId: dto.epiNeedId,
          riskId: dto.riskId === undefined ? undefined : nextRiskId,
          isRequired: dto.isRequired,
          quantity: dto.quantity,
          replacementIntervalDays:
            dto.replacementIntervalDays === undefined
              ? undefined
              : dto.replacementIntervalDays,
          notes:
            dto.notes === undefined ? undefined : this.text(dto.notes),
          source: dto.source,
        },
        include: jobEpiRequirementInclude,
      });

      await this.audit.log({
        action: 'job_function_epi_requirement.updated',
        organizationId,
        userId,
        entityType: 'JobFunctionEpiRequirement',
        entityId: requirementId,
        metadata: { jobFunctionId },
      });

      const [mapped] = await this.mapEpiRequirements(organizationId, [updated]);
      return mapped;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ja existe um requisito ativo com esta necessidade (e risco) para a funcao.',
        );
      }
      throw err;
    }
  }

  async updateEpiRequirementStatus(
    organizationId: string,
    userId: string,
    jobFunctionId: string,
    requirementId: string,
    isActive: boolean,
  ) {
    const existing = await this.requireEpiRequirement(
      organizationId,
      jobFunctionId,
      requirementId,
    );
    if (existing.isActive === isActive) {
      const [mapped] = await this.mapEpiRequirements(organizationId, [
        await this.prisma.jobFunctionEpiRequirement.findFirstOrThrow({
          where: { id: requirementId },
          include: jobEpiRequirementInclude,
        }),
      ]);
      return mapped;
    }
    if (isActive) {
      await this.assertUniqueEpiRequirement(
        organizationId,
        jobFunctionId,
        existing.riskId,
        existing.epiNeedId,
        requirementId,
      );
    }
    try {
      const updated = await this.prisma.jobFunctionEpiRequirement.update({
        where: { id: requirementId },
        data: { isActive },
        include: jobEpiRequirementInclude,
      });
      await this.audit.log({
        action: 'job_function_epi_requirement.status_changed',
        organizationId,
        userId,
        entityType: 'JobFunctionEpiRequirement',
        entityId: requirementId,
        metadata: { from: existing.isActive, to: isActive, jobFunctionId },
      });
      const [mapped] = await this.mapEpiRequirements(organizationId, [updated]);
      return mapped;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ja existe um requisito ativo com esta necessidade (e risco) para a funcao.',
        );
      }
      throw err;
    }
  }

  async deleteEpiRequirement(
    organizationId: string,
    userId: string,
    jobFunctionId: string,
    requirementId: string,
  ) {
    await this.requireEpiRequirement(
      organizationId,
      jobFunctionId,
      requirementId,
    );
    await this.prisma.jobFunctionEpiRequirement.delete({
      where: { id: requirementId },
    });
    await this.audit.log({
      action: 'job_function_epi_requirement.deleted',
      organizationId,
      userId,
      entityType: 'JobFunctionEpiRequirement',
      entityId: requirementId,
      metadata: { jobFunctionId },
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

  private async requireEpiNeed(organizationId: string, id: string) {
    const need = await this.prisma.epiNeed.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!need) {
      throw new NotFoundException('Necessidade de EPI nao encontrada.');
    }
    return need;
  }

  private async requireEpiRequirement(
    organizationId: string,
    jobFunctionId: string,
    requirementId: string,
  ) {
    const row = await this.prisma.jobFunctionEpiRequirement.findFirst({
      where: { id: requirementId, organizationId, jobFunctionId },
    });
    if (!row) {
      throw new NotFoundException('Requisito de EPI nao encontrado.');
    }
    return row;
  }

  private async assertRiskLinkedOrTenant(
    organizationId: string,
    jobFunctionId: string,
    riskId: string,
  ) {
    await this.requireRisk(organizationId, riskId);
    const linked = await this.prisma.jobFunctionRisk.findFirst({
      where: { organizationId, jobFunctionId, riskId },
      select: { id: true },
    });
    if (!linked) {
      throw new BadRequestException(
        'O risco precisa estar vinculado a esta funcao antes de associar o EPI.',
      );
    }
  }

  private async assertUniqueEpiRequirement(
    organizationId: string,
    jobFunctionId: string,
    riskId: string | null,
    epiNeedId: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.jobFunctionEpiRequirement.findFirst({
      where: {
        organizationId,
        jobFunctionId,
        epiNeedId,
        isActive: true,
        ...(riskId ? { riskId } : { riskId: null }),
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ja existe um requisito ativo com esta necessidade (e risco) para a funcao.',
      );
    }
  }

  private async sumStockByNeedIds(
    organizationId: string,
    needIds: string[],
  ): Promise<Map<string, { linkedItems: number; totalQuantity: number }>> {
    const result = new Map<
      string,
      { linkedItems: number; totalQuantity: number }
    >();
    if (needIds.length === 0) return result;

    const links = await this.prisma.epiItemNeed.findMany({
      where: { organizationId, epiNeedId: { in: needIds } },
      select: { epiNeedId: true, epiItemId: true },
    });
    const itemIds = [...new Set(links.map((l) => l.epiItemId))];
    const totals =
      itemIds.length === 0
        ? []
        : await this.prisma.epiStockBalance.groupBy({
            by: ['epiItemId'],
            where: { organizationId, epiItemId: { in: itemIds } },
            _sum: { quantity: true },
          });
    const qtyByItem = new Map(
      totals.map((row) => [row.epiItemId, row._sum.quantity ?? 0]),
    );

    for (const needId of needIds) {
      const needLinks = links.filter((l) => l.epiNeedId === needId);
      const totalQuantity = needLinks.reduce(
        (sum, link) => sum + (qtyByItem.get(link.epiItemId) ?? 0),
        0,
      );
      result.set(needId, {
        linkedItems: needLinks.length,
        totalQuantity,
      });
    }
    return result;
  }

  private async mapEpiRequirements(
    organizationId: string,
    rows: Array<{
      id: string;
      organizationId: string;
      jobFunctionId: string;
      riskId: string | null;
      epiNeedId: string;
      isRequired: boolean;
      quantity: number;
      replacementIntervalDays: number | null;
      notes: string | null;
      source: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      risk: {
        id: string;
        organizationId: string;
        name: string;
        category: OccupationalRiskCategory;
        description: string | null;
        aliases: Prisma.JsonValue | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      epiNeed: {
        id: string;
        organizationId: string;
        name: string;
        category: string | null;
        description: string | null;
        aliases: Prisma.JsonValue | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        _count: { itemLinks: number };
      };
    }>,
  ) {
    const needIds = rows.map((row) => row.epiNeedId);
    const stockByNeed = await this.sumStockByNeedIds(organizationId, needIds);

    return rows.map((row) => {
      const stock = stockByNeed.get(row.epiNeedId) ?? {
        linkedItems: row.epiNeed._count.itemLinks,
        totalQuantity: 0,
      };
      const linkedItems = row.epiNeed._count.itemLinks;
      return {
        ...row,
        risk: row.risk
          ? { ...row.risk, aliases: parseAliases(row.risk.aliases) }
          : null,
        epiNeed: {
          ...row.epiNeed,
          aliases: parseAliases(row.epiNeed.aliases),
          linkedItemsCount: linkedItems,
          totalStockQuantity: stock.totalQuantity,
          stockStatus:
            linkedItems === 0
              ? ('UNLINKED' as const)
              : stock.totalQuantity > 0
                ? ('WITH_STOCK' as const)
                : ('NO_STOCK' as const),
        },
      };
    });
  }

  private async mapJobsWithRequirements(
    organizationId: string,
    jobs: Array<{
      risks: Array<{
        risk: {
          aliases: Prisma.JsonValue | null;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      }>;
      epiRequirements?: Array<{
        id: string;
        organizationId: string;
        jobFunctionId: string;
        riskId: string | null;
        epiNeedId: string;
        isRequired: boolean;
        quantity: number;
        replacementIntervalDays: number | null;
        notes: string | null;
        source: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        risk: {
          id: string;
          organizationId: string;
          name: string;
          category: OccupationalRiskCategory;
          description: string | null;
          aliases: Prisma.JsonValue | null;
          isActive: boolean;
          createdAt: Date;
          updatedAt: Date;
        } | null;
        epiNeed: {
          id: string;
          organizationId: string;
          name: string;
          category: string | null;
          description: string | null;
          aliases: Prisma.JsonValue | null;
          isActive: boolean;
          createdAt: Date;
          updatedAt: Date;
          _count: { itemLinks: number };
        };
      }>;
      [key: string]: unknown;
    }>,
  ) {
    return Promise.all(
      jobs.map(async (job) => {
        const epiRequirements = job.epiRequirements
          ? await this.mapEpiRequirements(organizationId, job.epiRequirements)
          : [];
        return {
          ...job,
          risks: job.risks.map((link) => ({
            ...link,
            risk: {
              ...link.risk,
              aliases: parseAliases(link.risk.aliases),
            },
          })),
          epiRequirements,
        };
      }),
    );
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
