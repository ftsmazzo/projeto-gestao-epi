import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServedClientStatus, WorkerStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { validateCnpj } from '../common/cnpj';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateServedClientDto } from './dto/create-served-client.dto';
import type { UpdateServedClientDto } from './dto/update-served-client.dto';

@Injectable()
export class ServedClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.servedClient.findMany({
      where: { organizationId },
      orderBy: [{ status: 'asc' }, { legalName: 'asc' }],
    });
  }

  async getById(organizationId: string, id: string) {
    const client = await this.prisma.servedClient.findFirst({
      where: { id, organizationId },
    });
    if (!client) {
      throw new NotFoundException('Cliente atendido nao encontrado.');
    }
    return client;
  }

  async getQuotaSummary(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { contractedLifeQuota: true },
    });
    if (!organization) {
      throw new NotFoundException('Organizacao nao encontrada.');
    }

    const [aggregate, activeClients, used] = await Promise.all([
      this.prisma.servedClient.aggregate({
        where: { organizationId },
        _sum: { allocatedLifeQuota: true },
        _count: { _all: true },
      }),
      this.prisma.servedClient.count({
        where: { organizationId, status: ServedClientStatus.ACTIVE },
      }),
      this.prisma.worker.count({
        where: { organizationId, status: WorkerStatus.ACTIVE },
      }),
    ]);

    const contracted = organization.contractedLifeQuota;
    const allocated = aggregate._sum.allocatedLifeQuota ?? 0;
    const available = Math.max(0, contracted - allocated);

    return {
      contracted,
      allocated,
      available,
      used,
      activeClients,
      totalClients: aggregate._count._all,
    };
  }

  async create(
    organizationId: string,
    userId: string,
    dto: CreateServedClientDto,
  ) {
    const cnpj = this.normalizeAndValidateCnpj(dto.cnpj);
    await this.assertQuotaFits(organizationId, dto.allocatedLifeQuota);
    await this.assertUniqueCnpj(organizationId, cnpj);

    try {
      const client = await this.prisma.servedClient.create({
        data: {
          organizationId,
          legalName: dto.legalName.trim(),
          tradeName: dto.tradeName?.trim() || null,
          cnpj,
          allocatedLifeQuota: dto.allocatedLifeQuota,
          status: dto.status ?? ServedClientStatus.ACTIVE,
          notes: dto.notes?.trim() || null,
        },
      });

      await this.audit.log({
        action: 'served_client.created',
        organizationId,
        userId,
        entityType: 'ServedClient',
        entityId: client.id,
        metadata: {
          cnpj: client.cnpj,
          allocatedLifeQuota: client.allocatedLifeQuota,
          status: client.status,
        },
      });

      return client;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateServedClientDto,
  ) {
    const existing = await this.getById(organizationId, id);
    const cnpj =
      dto.cnpj !== undefined
        ? this.normalizeAndValidateCnpj(dto.cnpj)
        : existing.cnpj;

    if (cnpj !== existing.cnpj) {
      await this.assertUniqueCnpj(organizationId, cnpj, id);
    }

    if (dto.allocatedLifeQuota !== undefined) {
      await this.assertQuotaFits(
        organizationId,
        dto.allocatedLifeQuota,
        id,
      );
      await this.assertQuotaNotBelowActiveWorkers(
        organizationId,
        id,
        dto.allocatedLifeQuota,
      );
    }

    try {
      const client = await this.prisma.servedClient.update({
        where: { id },
        data: {
          legalName: dto.legalName?.trim(),
          tradeName:
            dto.tradeName === undefined
              ? undefined
              : dto.tradeName?.trim() || null,
          cnpj: dto.cnpj !== undefined ? cnpj : undefined,
          allocatedLifeQuota: dto.allocatedLifeQuota,
          status: dto.status,
          notes:
            dto.notes === undefined ? undefined : dto.notes?.trim() || null,
        },
      });

      await this.audit.log({
        action: 'served_client.updated',
        organizationId,
        userId,
        entityType: 'ServedClient',
        entityId: client.id,
        metadata: {
          before: {
            legalName: existing.legalName,
            cnpj: existing.cnpj,
            allocatedLifeQuota: existing.allocatedLifeQuota,
            status: existing.status,
          },
          after: {
            legalName: client.legalName,
            cnpj: client.cnpj,
            allocatedLifeQuota: client.allocatedLifeQuota,
            status: client.status,
          },
        },
      });

      return client;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async updateStatus(
    organizationId: string,
    userId: string,
    id: string,
    status: ServedClientStatus,
  ) {
    const existing = await this.getById(organizationId, id);
    if (existing.status === status) {
      return existing;
    }

    const client = await this.prisma.servedClient.update({
      where: { id },
      data: { status },
    });

    await this.audit.log({
      action: 'served_client.status_changed',
      organizationId,
      userId,
      entityType: 'ServedClient',
      entityId: client.id,
      metadata: {
        from: existing.status,
        to: client.status,
      },
    });

    return client;
  }

  private normalizeAndValidateCnpj(value: string): string {
    const result = validateCnpj(value);
    if (!result.ok) {
      throw new BadRequestException(result.message);
    }
    return result.normalized;
  }

  private async assertUniqueCnpj(
    organizationId: string,
    cnpj: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.servedClient.findFirst({
      where: {
        organizationId,
        cnpj,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ja existe um cliente atendido com este CNPJ nesta organizacao.',
      );
    }
  }

  private async assertQuotaFits(
    organizationId: string,
    nextQuota: number,
    excludeId?: string,
  ) {
    if (nextQuota < 0) {
      throw new BadRequestException('A cota alocada nao pode ser negativa.');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { contractedLifeQuota: true },
    });
    if (!organization) {
      throw new NotFoundException('Organizacao nao encontrada.');
    }

    const aggregate = await this.prisma.servedClient.aggregate({
      where: {
        organizationId,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      _sum: { allocatedLifeQuota: true },
    });

    const otherAllocated = aggregate._sum.allocatedLifeQuota ?? 0;
    const total = otherAllocated + nextQuota;

    if (total > organization.contractedLifeQuota) {
      const available = Math.max(
        0,
        organization.contractedLifeQuota - otherAllocated,
      );
      throw new BadRequestException(
        `A soma das cotas ultrapassa a franquia contratada (${organization.contractedLifeQuota} vidas). Disponivel para este cliente: ${available}.`,
      );
    }
  }

  private async assertQuotaNotBelowActiveWorkers(
    organizationId: string,
    servedClientId: string,
    nextQuota: number,
  ) {
    const activeWorkers = await this.prisma.worker.count({
      where: {
        organizationId,
        servedClientId,
        status: WorkerStatus.ACTIVE,
      },
    });

    if (nextQuota < activeWorkers) {
      throw new BadRequestException(
        'A nova cota nao pode ser menor que as vidas ativas ja cadastradas neste cliente.',
      );
    }
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ja existe um cliente atendido com este CNPJ nesta organizacao.',
      );
    }
  }
}
