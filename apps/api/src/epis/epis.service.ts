import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EpiItemStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateEpiItemDto } from './dto/create-epi-item.dto';
import type { UpdateEpiItemDto } from './dto/update-epi-item.dto';

@Injectable()
export class EpisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(organizationId: string) {
    return this.prisma.epiItem.findMany({
      where: { organizationId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async getById(organizationId: string, id: string) {
    const item = await this.prisma.epiItem.findFirst({
      where: { id, organizationId },
    });
    if (!item) {
      throw new NotFoundException('EPI nao encontrado.');
    }
    return item;
  }

  async create(organizationId: string, userId: string, dto: CreateEpiItemDto) {
    const requiresCa = dto.requiresCa ?? true;
    const caNumber = this.normalizeOptionalCaNumber(dto.caNumber);
    this.assertCaRequirement(requiresCa, caNumber);

    const defaultValidityDays = this.normalizeOptionalPositiveInt(
      dto.defaultValidityDays,
    );
    const caExpirationDate = this.parseOptionalDate(dto.caExpirationDate);

    if (caNumber) {
      await this.assertUniqueCaNumber(organizationId, caNumber);
    }

    try {
      const item = await this.prisma.epiItem.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          description: this.normalizeOptionalText(dto.description),
          caNumber,
          caExpirationDate,
          category: this.normalizeOptionalText(dto.category),
          manufacturer: this.normalizeOptionalText(dto.manufacturer),
          defaultValidityDays,
          requiresCa,
          notes: this.normalizeOptionalText(dto.notes),
        },
      });

      await this.audit.log({
        action: 'epi_item.created',
        organizationId,
        userId,
        entityType: 'EpiItem',
        entityId: item.id,
        metadata: {
          name: item.name,
          caNumber: item.caNumber,
          requiresCa: item.requiresCa,
          status: item.status,
          category: item.category,
        },
      });

      return item;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateEpiItemDto,
  ) {
    const existing = await this.getById(organizationId, id);

    const requiresCa = dto.requiresCa ?? existing.requiresCa;
    const nextCaNumber =
      dto.caNumber === undefined
        ? existing.caNumber
        : this.normalizeOptionalCaNumber(dto.caNumber);
    this.assertCaRequirement(requiresCa, nextCaNumber);

    if (nextCaNumber && nextCaNumber !== existing.caNumber) {
      await this.assertUniqueCaNumber(organizationId, nextCaNumber, id);
    }

    try {
      const item = await this.prisma.epiItem.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description:
            dto.description === undefined
              ? undefined
              : this.normalizeOptionalText(dto.description),
          caNumber: dto.caNumber === undefined ? undefined : nextCaNumber,
          caExpirationDate:
            dto.caExpirationDate === undefined
              ? undefined
              : this.parseOptionalDate(dto.caExpirationDate),
          category:
            dto.category === undefined
              ? undefined
              : this.normalizeOptionalText(dto.category),
          manufacturer:
            dto.manufacturer === undefined
              ? undefined
              : this.normalizeOptionalText(dto.manufacturer),
          defaultValidityDays:
            dto.defaultValidityDays === undefined
              ? undefined
              : this.normalizeOptionalPositiveInt(dto.defaultValidityDays),
          requiresCa: dto.requiresCa,
          notes:
            dto.notes === undefined
              ? undefined
              : this.normalizeOptionalText(dto.notes),
        },
      });

      await this.audit.log({
        action: 'epi_item.updated',
        organizationId,
        userId,
        entityType: 'EpiItem',
        entityId: item.id,
        metadata: {
          before: {
            name: existing.name,
            caNumber: existing.caNumber,
            requiresCa: existing.requiresCa,
            category: existing.category,
            status: existing.status,
          },
          after: {
            name: item.name,
            caNumber: item.caNumber,
            requiresCa: item.requiresCa,
            category: item.category,
            status: item.status,
          },
        },
      });

      return item;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async updateStatus(
    organizationId: string,
    userId: string,
    id: string,
    status: EpiItemStatus,
  ) {
    const existing = await this.getById(organizationId, id);
    if (existing.status === status) {
      return existing;
    }

    const item = await this.prisma.epiItem.update({
      where: { id },
      data: { status },
    });

    await this.audit.log({
      action: 'epi_item.status_changed',
      organizationId,
      userId,
      entityType: 'EpiItem',
      entityId: item.id,
      metadata: {
        from: existing.status,
        to: item.status,
        caNumber: item.caNumber,
      },
    });

    return item;
  }

  private assertCaRequirement(
    requiresCa: boolean,
    caNumber: string | null,
  ): void {
    if (requiresCa && !caNumber) {
      throw new BadRequestException(
        'Este EPI exige CA. Informe o numero do Certificado de Aprovacao.',
      );
    }
  }

  private normalizeOptionalCaNumber(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const normalized = value.trim().replace(/\s+/g, '');
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeOptionalPositiveInt(
    value?: number | null,
  ): number | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(
        'Validade padrao de uso deve ser um inteiro positivo (em dias).',
      );
    }
    return value;
  }

  private parseOptionalDate(value?: string | null): Date | null {
    if (value === undefined || value === null || value.trim() === '') {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Data de validade do CA invalida.');
    }
    return date;
  }

  private async assertUniqueCaNumber(
    organizationId: string,
    caNumber: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.epiItem.findFirst({
      where: {
        organizationId,
        caNumber,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ja existe um EPI com este CA nesta organizacao.',
      );
    }
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ja existe um EPI com este CA nesta organizacao.',
      );
    }
  }
}
