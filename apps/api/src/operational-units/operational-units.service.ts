import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OperationalUnitStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { cnpjAuditMeta, validateCnpj } from '../common/cnpj';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateOperationalUnitDto } from './dto/create-operational-unit.dto';
import type { UpdateOperationalUnitDto } from './dto/update-operational-unit.dto';

@Injectable()
export class OperationalUnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listByServedClient(organizationId: string, servedClientId: string) {
    await this.assertServedClient(organizationId, servedClientId);

    return this.prisma.operationalUnit.findMany({
      where: { organizationId, servedClientId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async getById(organizationId: string, id: string) {
    const unit = await this.prisma.operationalUnit.findFirst({
      where: { id, organizationId },
    });
    if (!unit) {
      throw new NotFoundException('Unidade operacional nao encontrada.');
    }
    return unit;
  }

  async create(
    organizationId: string,
    userId: string,
    servedClientId: string,
    dto: CreateOperationalUnitDto,
  ) {
    await this.assertServedClient(organizationId, servedClientId);

    const code = this.normalizeOptionalCode(dto.code);
    const cnpj = this.normalizeOptionalCnpj(dto.cnpj);
    if (code) {
      await this.assertUniqueCode(servedClientId, code);
    }
    if (cnpj) {
      await this.assertUniqueCnpj(organizationId, cnpj);
    }

    try {
      const unit = await this.prisma.operationalUnit.create({
        data: {
          organizationId,
          servedClientId,
          name: dto.name.trim(),
          code,
          cnpj,
          addressLine: this.normalizeOptionalText(dto.addressLine),
          city: this.normalizeOptionalText(dto.city),
          state: this.normalizeState(dto.state),
          notes: this.normalizeOptionalText(dto.notes),
          status: OperationalUnitStatus.ACTIVE,
        },
      });

      await this.audit.log({
        action: 'operational_unit.created',
        organizationId,
        userId,
        entityType: 'OperationalUnit',
        entityId: unit.id,
        metadata: {
          servedClientId,
          name: unit.name,
          code: unit.code,
          status: unit.status,
          ...cnpjAuditMeta(unit.cnpj),
        },
      });

      return unit;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateOperationalUnitDto,
  ) {
    const existing = await this.getById(organizationId, id);

    const nextCode =
      dto.code === undefined
        ? existing.code
        : this.normalizeOptionalCode(dto.code);
    const nextCnpj =
      dto.cnpj === undefined
        ? existing.cnpj
        : this.normalizeOptionalCnpj(dto.cnpj);

    if (nextCode && nextCode !== existing.code) {
      await this.assertUniqueCode(existing.servedClientId, nextCode, id);
    }
    if (nextCnpj && nextCnpj !== existing.cnpj) {
      await this.assertUniqueCnpj(organizationId, nextCnpj, id);
    }

    try {
      const unit = await this.prisma.operationalUnit.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          code: dto.code === undefined ? undefined : nextCode,
          cnpj: dto.cnpj === undefined ? undefined : nextCnpj,
          addressLine:
            dto.addressLine === undefined
              ? undefined
              : this.normalizeOptionalText(dto.addressLine),
          city:
            dto.city === undefined
              ? undefined
              : this.normalizeOptionalText(dto.city),
          state:
            dto.state === undefined
              ? undefined
              : this.normalizeState(dto.state),
          notes:
            dto.notes === undefined
              ? undefined
              : this.normalizeOptionalText(dto.notes),
        },
      });

      await this.audit.log({
        action: 'operational_unit.updated',
        organizationId,
        userId,
        entityType: 'OperationalUnit',
        entityId: unit.id,
        metadata: {
          before: {
            name: existing.name,
            code: existing.code,
            city: existing.city,
            state: existing.state,
            ...cnpjAuditMeta(existing.cnpj),
          },
          after: {
            name: unit.name,
            code: unit.code,
            city: unit.city,
            state: unit.state,
            ...cnpjAuditMeta(unit.cnpj),
          },
        },
      });

      return unit;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async updateStatus(
    organizationId: string,
    userId: string,
    id: string,
    status: OperationalUnitStatus,
  ) {
    const existing = await this.getById(organizationId, id);
    if (existing.status === status) {
      return existing;
    }

    const unit = await this.prisma.operationalUnit.update({
      where: { id },
      data: { status },
    });

    await this.audit.log({
      action: 'operational_unit.status_changed',
      organizationId,
      userId,
      entityType: 'OperationalUnit',
      entityId: unit.id,
      metadata: {
        from: existing.status,
        to: unit.status,
      },
    });

    return unit;
  }

  private async assertServedClient(
    organizationId: string,
    servedClientId: string,
  ) {
    const client = await this.prisma.servedClient.findFirst({
      where: { id: servedClientId, organizationId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente atendido nao encontrado.');
    }
  }

  private async assertUniqueCode(
    servedClientId: string,
    code: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.operationalUnit.findFirst({
      where: {
        servedClientId,
        code,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ja existe uma unidade com este codigo neste cliente atendido.',
      );
    }
  }

  private async assertUniqueCnpj(
    organizationId: string,
    cnpj: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.operationalUnit.findFirst({
      where: {
        organizationId,
        cnpj,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ja existe uma unidade operacional com este CNPJ nesta organizacao.',
      );
    }
  }

  private normalizeOptionalCnpj(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const result = validateCnpj(trimmed);
    if (!result.ok) {
      throw new BadRequestException(result.message);
    }
    return result.normalized;
  }

  private normalizeOptionalCode(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeState(value?: string | null): string | null {
    const text = this.normalizeOptionalText(value);
    return text ? text.toUpperCase() : null;
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(',')
        : String(error.meta?.target ?? '');
      if (target.includes('cnpj')) {
        throw new ConflictException(
          'Ja existe uma unidade operacional com este CNPJ nesta organizacao.',
        );
      }
      throw new ConflictException(
        'Ja existe uma unidade com este codigo neste cliente atendido.',
      );
    }
  }
}
