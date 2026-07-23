import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EpiStockMovementType, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateStockLocationDto,
  CreateStockMovementDto,
  UpdateStockLocationDto,
} from './dto/stock.dto';

function balanceStatus(
  quantity: number,
  minQuantity: number | null | undefined,
): 'OK' | 'BAIXO' | 'ZERADO' {
  if (quantity <= 0) return 'ZERADO';
  if (minQuantity != null && quantity <= minQuantity) return 'BAIXO';
  return 'OK';
}

const balanceInclude = {
  epiItem: {
    select: {
      id: true,
      name: true,
      category: true,
      caNumber: true,
      unitOfMeasure: true,
      isActive: true,
    },
  },
  epiVariant: {
    select: {
      id: true,
      size: true,
      color: true,
      model: true,
      side: true,
    },
  },
  stockLocation: {
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  },
} satisfies Prisma.EpiStockBalanceInclude;

const movementInclude = {
  epiItem: { select: { id: true, name: true } },
  epiVariant: {
    select: { id: true, size: true, color: true, model: true },
  },
  stockLocation: { select: { id: true, name: true } },
  createdByUser: { select: { id: true, name: true } },
} satisfies Prisma.EpiStockMovementInclude;

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listLocations(organizationId: string) {
    return this.prisma.stockLocation.findMany({
      where: { organizationId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createLocation(
    organizationId: string,
    userId: string,
    dto: CreateStockLocationDto,
  ) {
    const location = await this.prisma.stockLocation.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        description: this.normalizeOptionalText(dto.description),
      },
    });

    await this.audit.log({
      action: 'stock_location.created',
      organizationId,
      userId,
      entityType: 'StockLocation',
      entityId: location.id,
      metadata: { name: location.name },
    });

    return location;
  }

  async updateLocation(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateStockLocationDto,
  ) {
    const existing = await this.getLocation(organizationId, id);
    const location = await this.prisma.stockLocation.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : this.normalizeOptionalText(dto.description),
      },
    });

    await this.audit.log({
      action: 'stock_location.updated',
      organizationId,
      userId,
      entityType: 'StockLocation',
      entityId: location.id,
      metadata: {
        before: { name: existing.name, description: existing.description },
        after: { name: location.name, description: location.description },
      },
    });

    return location;
  }

  async updateLocationStatus(
    organizationId: string,
    userId: string,
    id: string,
    isActive: boolean,
  ) {
    const existing = await this.getLocation(organizationId, id);
    if (existing.isActive === isActive) {
      return existing;
    }

    const location = await this.prisma.stockLocation.update({
      where: { id },
      data: { isActive },
    });

    await this.audit.log({
      action: 'stock_location.status_changed',
      organizationId,
      userId,
      entityType: 'StockLocation',
      entityId: location.id,
      metadata: { from: existing.isActive, to: location.isActive },
    });

    return location;
  }

  async getSummary(organizationId: string) {
    const [locationsActive, locationsTotal, balances] = await Promise.all([
      this.prisma.stockLocation.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.stockLocation.count({ where: { organizationId } }),
      this.prisma.epiStockBalance.findMany({
        where: { organizationId },
        select: { quantity: true, minQuantity: true },
      }),
    ]);

    let totalUnits = 0;
    let lowStockCount = 0;
    let zeroStockCount = 0;
    for (const row of balances) {
      totalUnits += row.quantity;
      const status = balanceStatus(row.quantity, row.minQuantity);
      if (status === 'ZERADO') zeroStockCount += 1;
      if (status === 'BAIXO') lowStockCount += 1;
    }

    return {
      locationsActive,
      locationsTotal,
      balanceLines: balances.length,
      totalUnits,
      lowStockCount,
      zeroStockCount,
    };
  }

  async listBalances(
    organizationId: string,
    filters: {
      epiItemId?: string;
      stockLocationId?: string;
      category?: string;
      lowOnly?: boolean;
    },
  ) {
    const rows = await this.prisma.epiStockBalance.findMany({
      where: {
        organizationId,
        ...(filters.epiItemId ? { epiItemId: filters.epiItemId } : {}),
        ...(filters.stockLocationId
          ? { stockLocationId: filters.stockLocationId }
          : {}),
        ...(filters.category
          ? { epiItem: { category: filters.category as never } }
          : {}),
      },
      include: balanceInclude,
      orderBy: [{ updatedAt: 'desc' }],
    });

    const mapped = rows.map((row) => ({
      ...row,
      status: balanceStatus(row.quantity, row.minQuantity),
    }));

    if (filters.lowOnly) {
      return mapped.filter(
        (row) => row.status === 'BAIXO' || row.status === 'ZERADO',
      );
    }
    return mapped;
  }

  async listTotalsByEpi(organizationId: string) {
    const grouped = await this.prisma.epiStockBalance.groupBy({
      by: ['epiItemId'],
      where: { organizationId },
      _sum: { quantity: true },
    });
    return grouped.map((row) => ({
      epiItemId: row.epiItemId,
      totalQuantity: row._sum.quantity ?? 0,
    }));
  }

  async listMovements(
    organizationId: string,
    filters: {
      epiItemId?: string;
      stockLocationId?: string;
      type?: EpiStockMovementType;
      limit?: number;
    },
  ) {
    const take = Math.min(Math.max(filters.limit ?? 100, 1), 300);
    return this.prisma.epiStockMovement.findMany({
      where: {
        organizationId,
        ...(filters.epiItemId ? { epiItemId: filters.epiItemId } : {}),
        ...(filters.stockLocationId
          ? { stockLocationId: filters.stockLocationId }
          : {}),
        ...(filters.type ? { type: filters.type } : {}),
      },
      include: movementInclude,
      orderBy: [{ createdAt: 'desc' }],
      take,
    });
  }

  async createMovement(
    organizationId: string,
    userId: string,
    dto: CreateStockMovementDto,
  ) {
    const location = await this.getLocation(organizationId, dto.stockLocationId);
    if (!location.isActive) {
      throw new BadRequestException(
        'Nao e possivel movimentar estoque em local inativo.',
      );
    }

    const epi = await this.prisma.epiItem.findFirst({
      where: { id: dto.epiItemId, organizationId },
      select: { id: true, name: true, isActive: true },
    });
    if (!epi) {
      throw new NotFoundException('EPI nao encontrado neste tenant.');
    }

    const epiVariantId = dto.epiVariantId?.trim() || null;
    if (epiVariantId) {
      const variant = await this.prisma.epiVariant.findFirst({
        where: {
          id: epiVariantId,
          organizationId,
          epiItemId: dto.epiItemId,
        },
        select: { id: true },
      });
      if (!variant) {
        throw new BadRequestException(
          'Variacao nao pertence a este EPI neste tenant.',
        );
      }
    }

    if (!Number.isInteger(dto.quantity) || dto.quantity < 0) {
      throw new BadRequestException(
        'Quantidade deve ser um inteiro maior ou igual a zero.',
      );
    }

    if (
      (dto.type === EpiStockMovementType.SAIDA_MANUAL ||
        dto.type === EpiStockMovementType.AJUSTE) &&
      !dto.reason?.trim()
    ) {
      throw new BadRequestException(
        'Informe o motivo para saida manual ou ajuste.',
      );
    }

    if (
      dto.type === EpiStockMovementType.ENTRADA ||
      dto.type === EpiStockMovementType.SAIDA_MANUAL
    ) {
      if (dto.quantity <= 0) {
        throw new BadRequestException(
          'Quantidade do movimento deve ser maior que zero.',
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.epiStockBalance.findFirst({
        where: {
          organizationId,
          epiItemId: dto.epiItemId,
          stockLocationId: dto.stockLocationId,
          ...(epiVariantId
            ? { epiVariantId }
            : { epiVariantId: null }),
        },
      });

      const previousQuantity = existing?.quantity ?? 0;
      let newQuantity = previousQuantity;

      if (dto.type === EpiStockMovementType.ENTRADA) {
        newQuantity = previousQuantity + dto.quantity;
      } else if (dto.type === EpiStockMovementType.SAIDA_MANUAL) {
        newQuantity = previousQuantity - dto.quantity;
        if (newQuantity < 0) {
          throw new BadRequestException(
            `Saldo insuficiente. Disponivel: ${previousQuantity}.`,
          );
        }
      } else {
        newQuantity = dto.quantity;
        if (newQuantity < 0) {
          throw new BadRequestException(
            'Ajuste nao pode resultar em quantidade negativa.',
          );
        }
      }

      const nextMin =
        dto.minQuantity === undefined
          ? existing?.minQuantity ?? null
          : dto.minQuantity;

      const balance = existing
        ? await tx.epiStockBalance.update({
            where: { id: existing.id },
            data: {
              quantity: newQuantity,
              minQuantity: nextMin,
            },
            include: balanceInclude,
          })
        : await tx.epiStockBalance.create({
            data: {
              organizationId,
              epiItemId: dto.epiItemId,
              epiVariantId,
              stockLocationId: dto.stockLocationId,
              quantity: newQuantity,
              minQuantity: nextMin,
            },
            include: balanceInclude,
          });

      const movement = await tx.epiStockMovement.create({
        data: {
          organizationId,
          epiItemId: dto.epiItemId,
          epiVariantId,
          stockLocationId: dto.stockLocationId,
          type: dto.type,
          quantity: dto.quantity,
          previousQuantity,
          newQuantity,
          reason: this.normalizeOptionalText(dto.reason),
          notes: this.normalizeOptionalText(dto.notes),
          createdByUserId: userId,
        },
        include: movementInclude,
      });

      return { balance, movement };
    });

    await this.audit.log({
      action: 'epi_stock.movement_created',
      organizationId,
      userId,
      entityType: 'EpiStockMovement',
      entityId: result.movement.id,
      metadata: {
        type: dto.type,
        epiItemId: dto.epiItemId,
        epiVariantId,
        stockLocationId: dto.stockLocationId,
        quantity: dto.quantity,
        previousQuantity: result.movement.previousQuantity,
        newQuantity: result.movement.newQuantity,
      },
    });

    return {
      movement: result.movement,
      balance: {
        ...result.balance,
        status: balanceStatus(
          result.balance.quantity,
          result.balance.minQuantity,
        ),
      },
    };
  }

  private async getLocation(organizationId: string, id: string) {
    const location = await this.prisma.stockLocation.findFirst({
      where: { id, organizationId },
    });
    if (!location) {
      throw new NotFoundException('Local de estoque nao encontrado.');
    }
    return location;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
