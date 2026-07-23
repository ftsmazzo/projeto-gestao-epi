import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EpiCategory,
  EpiUnitOfMeasure,
  EpiUsefulLifeUnit,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateEpiItemDto,
  EpiVariantInputDto,
} from './dto/create-epi-item.dto';
import type { UpdateEpiItemDto } from './dto/update-epi-item.dto';

const itemInclude = {
  variants: {
    orderBy: [{ isActive: 'desc' as const }, { size: 'asc' as const }],
  },
};

@Injectable()
export class EpisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(organizationId: string) {
    return this.prisma.epiItem.findMany({
      where: { organizationId },
      include: itemInclude,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async getById(organizationId: string, id: string) {
    const item = await this.prisma.epiItem.findFirst({
      where: { id, organizationId },
      include: itemInclude,
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

    const usefulLifeValue = this.normalizeOptionalNonNegativeInt(
      dto.usefulLifeValue,
      'Vida util',
    );
    const usefulLifeUnit = this.resolveUsefulLifeUnit(
      usefulLifeValue,
      dto.usefulLifeUnit,
    );
    const caExpiresAt = this.parseOptionalDate(dto.caExpiresAt);
    const category = dto.category ?? null;
    const nrr =
      category === EpiCategory.AUDITIVA
        ? this.normalizeOptionalFloat(dto.nrr, 'NRR')
        : null;
    const nrrsf =
      category === EpiCategory.AUDITIVA
        ? this.normalizeOptionalFloat(dto.nrrsf, 'NRRsf')
        : null;

    if (caNumber) {
      await this.assertUniqueCaNumber(organizationId, caNumber);
    }

    const variants = this.normalizeVariants(dto.variants);

    try {
      const item = await this.prisma.epiItem.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          description: this.normalizeOptionalText(dto.description),
          requiresCa,
          caNumber,
          caExpiresAt,
          unitOfMeasure: dto.unitOfMeasure ?? EpiUnitOfMeasure.UNIDADE,
          usefulLifeValue,
          usefulLifeUnit,
          category,
          externalCode: this.normalizeOptionalText(dto.externalCode),
          manufacturerName: this.normalizeOptionalText(dto.manufacturerName),
          reference: this.normalizeOptionalText(dto.reference),
          color: this.normalizeOptionalText(dto.color, 80),
          approvedFor: this.normalizeOptionalText(dto.approvedFor, 500),
          restriction: this.normalizeOptionalText(dto.restriction, 500),
          technicalNotes: this.normalizeOptionalText(dto.technicalNotes, 2000),
          nrr,
          nrrsf,
          variants: {
            create: variants.map((variant) => ({
              organizationId,
              size: variant.size,
              color: variant.color,
              model: variant.model,
              side: variant.side,
              notes: variant.notes,
              isActive: variant.isActive ?? true,
            })),
          },
        },
        include: itemInclude,
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
          isActive: item.isActive,
          category: item.category,
          unitOfMeasure: item.unitOfMeasure,
          variantCount: item.variants.length,
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

    const nextCategory =
      dto.category === undefined ? existing.category : dto.category;
    const rawNrr =
      dto.nrr === undefined
        ? existing.nrr
        : this.normalizeOptionalFloat(dto.nrr, 'NRR');
    const rawNrrsf =
      dto.nrrsf === undefined
        ? existing.nrrsf
        : this.normalizeOptionalFloat(dto.nrrsf, 'NRRsf');
    const nextNrr =
      nextCategory === EpiCategory.AUDITIVA ? rawNrr : null;
    const nextNrrsf =
      nextCategory === EpiCategory.AUDITIVA ? rawNrrsf : null;

    const usefulLifeValue =
      dto.usefulLifeValue === undefined
        ? undefined
        : this.normalizeOptionalNonNegativeInt(dto.usefulLifeValue, 'Vida util');

    try {
      const item = await this.prisma.$transaction(async (tx) => {
        if (dto.variants !== undefined) {
          await this.syncVariants(tx, organizationId, id, dto.variants);
        }

        return tx.epiItem.update({
          where: { id },
          data: {
            name: dto.name?.trim(),
            description:
              dto.description === undefined
                ? undefined
                : this.normalizeOptionalText(dto.description),
            requiresCa: dto.requiresCa,
            caNumber: dto.caNumber === undefined ? undefined : nextCaNumber,
            caExpiresAt:
              dto.caExpiresAt === undefined
                ? undefined
                : this.parseOptionalDate(dto.caExpiresAt),
            unitOfMeasure: dto.unitOfMeasure,
            usefulLifeValue,
            usefulLifeUnit:
              dto.usefulLifeUnit === undefined
                ? usefulLifeValue === null
                  ? null
                  : undefined
                : dto.usefulLifeUnit,
            category: dto.category === undefined ? undefined : dto.category,
            externalCode:
              dto.externalCode === undefined
                ? undefined
                : this.normalizeOptionalText(dto.externalCode),
            manufacturerName:
              dto.manufacturerName === undefined
                ? undefined
                : this.normalizeOptionalText(dto.manufacturerName),
            reference:
              dto.reference === undefined
                ? undefined
                : this.normalizeOptionalText(dto.reference),
            color:
              dto.color === undefined
                ? undefined
                : this.normalizeOptionalText(dto.color, 80),
            approvedFor:
              dto.approvedFor === undefined
                ? undefined
                : this.normalizeOptionalText(dto.approvedFor, 500),
            restriction:
              dto.restriction === undefined
                ? undefined
                : this.normalizeOptionalText(dto.restriction, 500),
            technicalNotes:
              dto.technicalNotes === undefined
                ? undefined
                : this.normalizeOptionalText(dto.technicalNotes, 2000),
            nrr: nextNrr,
            nrrsf: nextNrrsf,
          },
          include: itemInclude,
        });
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
            isActive: existing.isActive,
            variantCount: existing.variants.length,
          },
          after: {
            name: item.name,
            caNumber: item.caNumber,
            requiresCa: item.requiresCa,
            category: item.category,
            isActive: item.isActive,
            variantCount: item.variants.length,
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
    isActive: boolean,
  ) {
    const existing = await this.getById(organizationId, id);
    if (existing.isActive === isActive) {
      return existing;
    }

    const item = await this.prisma.epiItem.update({
      where: { id },
      data: { isActive },
      include: itemInclude,
    });

    await this.audit.log({
      action: 'epi_item.status_changed',
      organizationId,
      userId,
      entityType: 'EpiItem',
      entityId: item.id,
      metadata: {
        from: existing.isActive,
        to: item.isActive,
        caNumber: item.caNumber,
      },
    });

    return item;
  }

  private async syncVariants(
    tx: Prisma.TransactionClient,
    organizationId: string,
    epiItemId: string,
    inputs: EpiVariantInputDto[],
  ) {
    const normalized = this.normalizeVariants(inputs);
    const existing = await tx.epiVariant.findMany({
      where: { organizationId, epiItemId },
      select: { id: true },
    });
    const keepIds = new Set(
      normalized.map((v) => v.id).filter((id): id is string => Boolean(id)),
    );

    const toDelete = existing.filter((row) => !keepIds.has(row.id));
    if (toDelete.length > 0) {
      await tx.epiVariant.deleteMany({
        where: {
          organizationId,
          epiItemId,
          id: { in: toDelete.map((row) => row.id) },
        },
      });
    }

    for (const variant of normalized) {
      if (variant.id) {
        const owned = existing.some((row) => row.id === variant.id);
        if (!owned) {
          throw new BadRequestException(
            'Variacao invalida para este EPI neste tenant.',
          );
        }
        await tx.epiVariant.update({
          where: { id: variant.id },
          data: {
            size: variant.size,
            color: variant.color,
            model: variant.model,
            side: variant.side,
            notes: variant.notes,
            isActive: variant.isActive ?? true,
          },
        });
      } else {
        await tx.epiVariant.create({
          data: {
            organizationId,
            epiItemId,
            size: variant.size,
            color: variant.color,
            model: variant.model,
            side: variant.side,
            notes: variant.notes,
            isActive: variant.isActive ?? true,
          },
        });
      }
    }
  }

  private normalizeVariants(inputs?: EpiVariantInputDto[]) {
    if (!inputs || inputs.length === 0) {
      return [];
    }

    return inputs.map((input) => {
      const size = this.normalizeOptionalText(input.size, 80);
      const color = this.normalizeOptionalText(input.color, 80);
      const model = this.normalizeOptionalText(input.model, 120);
      const side = this.normalizeOptionalText(input.side, 40);
      const notes = this.normalizeOptionalText(input.notes, 500);

      if (!size && !color && !model && !side && !notes) {
        throw new BadRequestException(
          'Cada variacao precisa de ao menos tamanho, cor, modelo, lado ou observacao.',
        );
      }

      return {
        id: input.id?.trim() || undefined,
        size,
        color,
        model,
        side,
        notes,
        isActive: input.isActive ?? true,
      };
    });
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

  private resolveUsefulLifeUnit(
    value: number | null,
    unit?: EpiUsefulLifeUnit | null,
  ): EpiUsefulLifeUnit | null {
    if (value == null) {
      return null;
    }
    return unit ?? EpiUsefulLifeUnit.DIAS;
  }

  private normalizeOptionalCaNumber(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const normalized = value.trim().replace(/\s+/g, '');
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeOptionalText(
    value?: string | null,
    maxLength?: number,
  ): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (maxLength != null && trimmed.length > maxLength) {
      return trimmed.slice(0, maxLength).trimEnd();
    }
    return trimmed;
  }

  private normalizeOptionalNonNegativeInt(
    value?: number | null,
    label = 'Valor',
  ): number | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException(
        `${label} deve ser um inteiro maior ou igual a zero.`,
      );
    }
    return value;
  }

  private normalizeOptionalFloat(
    value?: number | null,
    label = 'Valor',
  ): number | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new BadRequestException(`${label} invalido.`);
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
