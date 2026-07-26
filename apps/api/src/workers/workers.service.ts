import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkerFacialReferenceStatus, WorkerStatus } from '@prisma/client';
import { isValidFaceDescriptor } from '@gestao-epi/shared';
import { AuditService } from '../audit/audit.service';
import { isValidCpf, stripCpf, cpfAuditMeta } from '../common/cpf';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateWorkerDto } from './dto/create-worker.dto';
import type { UpdateWorkerDto } from './dto/update-worker.dto';

@Injectable()
export class WorkersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listByServedClient(organizationId: string, servedClientId: string) {
    await this.assertServedClient(organizationId, servedClientId);

    const workers = await this.prisma.worker.findMany({
      where: { organizationId, servedClientId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        operationalUnit: { select: { id: true, name: true } },
        clientSector: { select: { id: true, name: true } },
        clientJobFunction: {
          select: {
            id: true,
            name: true,
            epiRequirements: {
              where: { isActive: true },
              select: {
                epiNeed: { select: { id: true, name: true } },
              },
            },
          },
        },
        facialReferences: {
          where: { status: WorkerFacialReferenceStatus.ACTIVE },
          orderBy: { uploadedAt: 'desc' },
          take: 1,
          select: { faceDescriptor: true },
        },
      },
    });

    return workers.map((worker) => {
      const needMap = new Map<string, string>();
      for (const req of worker.clientJobFunction?.epiRequirements ?? []) {
        needMap.set(req.epiNeed.id, req.epiNeed.name);
      }
      const requiredEpiNeeds = Array.from(needMap.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      const activeFace = worker.facialReferences[0] ?? null;
      const hasValidBiometrics = Boolean(
        activeFace && isValidFaceDescriptor(activeFace.faceDescriptor),
      );

      return {
        id: worker.id,
        organizationId: worker.organizationId,
        servedClientId: worker.servedClientId,
        operationalUnitId: worker.operationalUnitId,
        clientSectorId: worker.clientSectorId,
        clientJobFunctionId: worker.clientJobFunctionId,
        name: worker.name,
        cpf: worker.cpf,
        registration: worker.registration,
        email: worker.email,
        phone: worker.phone,
        role: worker.role,
        department: worker.department,
        status: worker.status,
        admissionDate: worker.admissionDate?.toISOString() ?? null,
        notes: worker.notes,
        createdAt: worker.createdAt.toISOString(),
        updatedAt: worker.updatedAt.toISOString(),
        unitName: worker.operationalUnit?.name ?? null,
        sectorName: worker.clientSector?.name ?? worker.department ?? null,
        jobFunctionName:
          worker.clientJobFunction?.name ?? worker.role ?? null,
        requiredEpiCount: requiredEpiNeeds.length,
        requiredEpiNeeds,
        hasValidBiometrics,
      };
    });
  }

  async getById(organizationId: string, id: string) {
    const worker = await this.prisma.worker.findFirst({
      where: { id, organizationId },
    });
    if (!worker) {
      throw new NotFoundException('Trabalhador nao encontrado.');
    }
    return worker;
  }

  async getClientLifeSummary(organizationId: string, servedClientId: string) {
    const client = await this.assertServedClient(organizationId, servedClientId);

    const [used, totalWorkers] = await Promise.all([
      this.prisma.worker.count({
        where: {
          organizationId,
          servedClientId,
          status: WorkerStatus.ACTIVE,
        },
      }),
      this.prisma.worker.count({
        where: { organizationId, servedClientId },
      }),
    ]);

    const allocated = client.allocatedLifeQuota;
    const available = Math.max(0, allocated - used);

    return {
      allocated,
      used,
      available,
      activeWorkers: used,
      totalWorkers,
    };
  }

  async create(
    organizationId: string,
    userId: string,
    servedClientId: string,
    dto: CreateWorkerDto,
  ) {
    await this.assertServedClient(organizationId, servedClientId);

    const status = dto.status ?? WorkerStatus.ACTIVE;
    const cpf = this.normalizeOptionalCpf(dto.cpf);
    const registration = this.normalizeOptionalText(dto.registration);
    const operationalUnitId = await this.resolveOperationalUnitId(
      organizationId,
      servedClientId,
      dto.operationalUnitId,
    );
    const structure = await this.resolveStructureIds(
      organizationId,
      servedClientId,
      dto.clientSectorId,
      dto.clientJobFunctionId,
      operationalUnitId,
    );

    if (cpf) {
      await this.assertUniqueCpf(organizationId, cpf);
    }
    if (registration) {
      await this.assertUniqueRegistration(servedClientId, registration);
    }
    if (status === WorkerStatus.ACTIVE) {
      await this.assertLifeSlotAvailable(organizationId, servedClientId);
    }

    try {
      const worker = await this.prisma.worker.create({
        data: {
          organizationId,
          servedClientId,
          operationalUnitId,
          clientSectorId: structure.clientSectorId,
          clientJobFunctionId: structure.clientJobFunctionId,
          name: dto.name.trim(),
          cpf,
          registration,
          email: this.normalizeOptionalText(dto.email),
          phone: this.normalizeOptionalText(dto.phone),
          role:
            structure.jobFunctionName ??
            this.normalizeOptionalText(dto.role),
          department:
            structure.sectorName ??
            this.normalizeOptionalText(dto.department),
          status,
          admissionDate: this.parseAdmissionDate(dto.admissionDate),
          notes: this.normalizeOptionalText(dto.notes),
        },
      });

      await this.audit.log({
        action: 'worker.created',
        organizationId,
        userId,
        entityType: 'Worker',
        entityId: worker.id,
        metadata: {
          servedClientId,
          status: worker.status,
          registration: worker.registration,
          ...cpfAuditMeta(worker.cpf),
        },
      });

      return worker;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateWorkerDto,
  ) {
    const existing = await this.getById(organizationId, id);

    const nextCpf =
      dto.cpf === undefined
        ? existing.cpf
        : this.normalizeOptionalCpf(dto.cpf);
    const nextRegistration =
      dto.registration === undefined
        ? existing.registration
        : this.normalizeOptionalText(dto.registration);
    const nextStatus = dto.status ?? existing.status;

    const nextUnitId =
      dto.operationalUnitId === undefined
        ? existing.operationalUnitId
        : await this.resolveOperationalUnitId(
            organizationId,
            existing.servedClientId,
            dto.operationalUnitId,
          );

    const nextSectorId =
      dto.clientSectorId === undefined
        ? existing.clientSectorId
        : dto.clientSectorId;
    const nextJobId =
      dto.clientJobFunctionId === undefined
        ? existing.clientJobFunctionId
        : dto.clientJobFunctionId;

    const structure = await this.resolveStructureIds(
      organizationId,
      existing.servedClientId,
      nextSectorId,
      nextJobId,
      nextUnitId,
    );

    if (nextCpf && nextCpf !== existing.cpf) {
      await this.assertUniqueCpf(organizationId, nextCpf, id);
    }
    if (nextRegistration && nextRegistration !== existing.registration) {
      await this.assertUniqueRegistration(
        existing.servedClientId,
        nextRegistration,
        id,
      );
    }

    const becomingActive =
      nextStatus === WorkerStatus.ACTIVE &&
      existing.status !== WorkerStatus.ACTIVE;
    if (becomingActive) {
      await this.assertLifeSlotAvailable(
        organizationId,
        existing.servedClientId,
      );
    }

    try {
      const worker = await this.prisma.worker.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          cpf: dto.cpf === undefined ? undefined : nextCpf,
          registration:
            dto.registration === undefined ? undefined : nextRegistration,
          email:
            dto.email === undefined
              ? undefined
              : this.normalizeOptionalText(dto.email),
          phone:
            dto.phone === undefined
              ? undefined
              : this.normalizeOptionalText(dto.phone),
          role:
            dto.role === undefined && dto.clientJobFunctionId === undefined
              ? undefined
              : structure.jobFunctionName ??
                (dto.role === undefined
                  ? undefined
                  : this.normalizeOptionalText(dto.role)),
          department:
            dto.department === undefined && dto.clientSectorId === undefined
              ? undefined
              : structure.sectorName ??
                (dto.department === undefined
                  ? undefined
                  : this.normalizeOptionalText(dto.department)),
          operationalUnitId:
            dto.operationalUnitId === undefined ? undefined : nextUnitId,
          clientSectorId:
            dto.clientSectorId === undefined
              ? undefined
              : structure.clientSectorId,
          clientJobFunctionId:
            dto.clientJobFunctionId === undefined
              ? undefined
              : structure.clientJobFunctionId,
          status: dto.status,
          admissionDate:
            dto.admissionDate === undefined
              ? undefined
              : this.parseAdmissionDate(dto.admissionDate),
          notes:
            dto.notes === undefined
              ? undefined
              : this.normalizeOptionalText(dto.notes),
        },
      });

      await this.audit.log({
        action: 'worker.updated',
        organizationId,
        userId,
        entityType: 'Worker',
        entityId: worker.id,
        metadata: {
          before: {
            name: existing.name,
            status: existing.status,
            registration: existing.registration,
            ...cpfAuditMeta(existing.cpf),
          },
          after: {
            name: worker.name,
            status: worker.status,
            registration: worker.registration,
            ...cpfAuditMeta(worker.cpf),
          },
        },
      });

      return worker;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async updateStatus(
    organizationId: string,
    userId: string,
    id: string,
    status: WorkerStatus,
  ) {
    const existing = await this.getById(organizationId, id);
    if (existing.status === status) {
      return existing;
    }

    if (status === WorkerStatus.ACTIVE) {
      await this.assertLifeSlotAvailable(
        organizationId,
        existing.servedClientId,
      );
    }

    const worker = await this.prisma.worker.update({
      where: { id },
      data: { status },
    });

    await this.audit.log({
      action: 'worker.status_changed',
      organizationId,
      userId,
      entityType: 'Worker',
      entityId: worker.id,
      metadata: {
        from: existing.status,
        to: worker.status,
      },
    });

    return worker;
  }

  private async assertServedClient(
    organizationId: string,
    servedClientId: string,
  ) {
    const client = await this.prisma.servedClient.findFirst({
      where: { id: servedClientId, organizationId },
      select: { id: true, allocatedLifeQuota: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente atendido nao encontrado.');
    }
    return client;
  }

  private async assertLifeSlotAvailable(
    organizationId: string,
    servedClientId: string,
  ) {
    const client = await this.assertServedClient(
      organizationId,
      servedClientId,
    );
    const used = await this.prisma.worker.count({
      where: {
        organizationId,
        servedClientId,
        status: WorkerStatus.ACTIVE,
      },
    });

    if (used >= client.allocatedLifeQuota) {
      throw new BadRequestException(
        `A cota de vidas deste cliente foi atingida (${client.allocatedLifeQuota}). Inative um trabalhador ou aumente a cota alocada.`,
      );
    }
  }

  private async resolveStructureIds(
    organizationId: string,
    servedClientId: string,
    clientSectorId?: string | null,
    clientJobFunctionId?: string | null,
    operationalUnitId?: string | null,
  ): Promise<{
    clientSectorId: string | null;
    clientJobFunctionId: string | null;
    sectorName: string | null;
    jobFunctionName: string | null;
  }> {
    let sectorId =
      clientSectorId === undefined || clientSectorId === null
        ? null
        : clientSectorId.trim() || null;
    let jobId =
      clientJobFunctionId === undefined || clientJobFunctionId === null
        ? null
        : clientJobFunctionId.trim() || null;

    let sectorName: string | null = null;
    let jobFunctionName: string | null = null;

    if (sectorId) {
      const sector = await this.prisma.clientSector.findFirst({
        where: { id: sectorId, organizationId, servedClientId },
        select: { id: true, name: true, operationalUnitId: true },
      });
      if (!sector) {
        throw new BadRequestException(
          'Setor invalido para este cliente atendido.',
        );
      }
      if (
        operationalUnitId &&
        sector.operationalUnitId &&
        sector.operationalUnitId !== operationalUnitId
      ) {
        // aviso suave: ainda aceita; estrutura pode ter setor global
      }
      sectorName = sector.name;
      sectorId = sector.id;
    }

    if (jobId) {
      const job = await this.prisma.clientJobFunction.findFirst({
        where: {
          id: jobId,
          organizationId,
          servedClientId,
          ...(sectorId ? { sectorId } : {}),
        },
        select: {
          id: true,
          name: true,
          sectorId: true,
          sector: { select: { name: true } },
        },
      });
      if (!job) {
        throw new BadRequestException(
          'Funcao invalida para este cliente/setor.',
        );
      }
      jobFunctionName = job.name;
      jobId = job.id;
      if (!sectorId) {
        sectorId = job.sectorId;
        sectorName = job.sector.name;
      }
    }

    return {
      clientSectorId: sectorId,
      clientJobFunctionId: jobId,
      sectorName,
      jobFunctionName,
    };
  }

  private async resolveOperationalUnitId(
    organizationId: string,
    servedClientId: string,
    operationalUnitId?: string | null,
  ): Promise<string | null> {
    if (operationalUnitId === undefined || operationalUnitId === null) {
      return null;
    }
    const trimmed = operationalUnitId.trim();
    if (!trimmed) {
      return null;
    }

    const unit = await this.prisma.operationalUnit.findFirst({
      where: {
        id: trimmed,
        organizationId,
        servedClientId,
      },
      select: { id: true },
    });
    if (!unit) {
      throw new BadRequestException(
        'Unidade operacional invalida para este cliente atendido.',
      );
    }
    return unit.id;
  }

  private normalizeOptionalCpf(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const cpf = stripCpf(trimmed);
    if (!isValidCpf(cpf)) {
      throw new BadRequestException(
        'CPF invalido. Verifique os digitos e tente novamente.',
      );
    }
    return cpf;
  }

  private async assertUniqueCpf(
    organizationId: string,
    cpf: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.worker.findFirst({
      where: {
        organizationId,
        cpf,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ja existe um trabalhador com este CPF nesta organizacao.',
      );
    }
  }

  private async assertUniqueRegistration(
    servedClientId: string,
    registration: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.worker.findFirst({
      where: {
        servedClientId,
        registration,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ja existe um trabalhador com esta matricula neste cliente atendido.',
      );
    }
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private parseAdmissionDate(value?: string | null): Date | null {
    if (value === undefined || value === null || value.trim() === '') {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Data de admissao invalida.');
    }
    return date;
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(',')
        : String(error.meta?.target ?? '');
      if (target.includes('cpf')) {
        throw new ConflictException(
          'Ja existe um trabalhador com este CPF nesta organizacao.',
        );
      }
      if (target.includes('registration')) {
        throw new ConflictException(
          'Ja existe um trabalhador com esta matricula neste cliente atendido.',
        );
      }
      throw new ConflictException(
        'Registro duplicado. Verifique CPF e matricula.',
      );
    }
  }
}
