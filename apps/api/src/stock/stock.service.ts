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
      where: { organizationId, servedClientId: null },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createLocation(
    organizationId: string,
    userId: string,
    dto: CreateStockLocationDto,
  ) {
    void organizationId;
    void userId;
    void dto;
    throw new BadRequestException(
      'Estoque operacional nao e mais gerido na Consultoria. Use o Painel do Cliente (/portal/estoque). Na Consultoria permanecem catalogo de EPIs e base CAEPI.',
    );
  }

  async updateLocation(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateStockLocationDto,
  ) {
    void organizationId;
    void userId;
    void id;
    void dto;
    throw new BadRequestException(
      'Estoque operacional nao e mais gerido na Consultoria. Use o Painel do Cliente.',
    );
  }

  async updateLocationStatus(
    organizationId: string,
    userId: string,
    id: string,
    isActive: boolean,
  ) {
    void organizationId;
    void userId;
    void id;
    void isActive;
    throw new BadRequestException(
      'Estoque operacional nao e mais gerido na Consultoria. Use o Painel do Cliente.',
    );
  }

  async getSummary(organizationId: string) {
    const locationFilter = { organizationId, servedClientId: null as string | null };
    const [locationsActive, locationsTotal, balances] = await Promise.all([
      this.prisma.stockLocation.count({
        where: { ...locationFilter, isActive: true },
      }),
      this.prisma.stockLocation.count({ where: locationFilter }),
      this.prisma.epiStockBalance.findMany({
        where: {
          organizationId,
          stockLocation: { servedClientId: null },
        },
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
        stockLocation: { servedClientId: null },
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
      where: {
        organizationId,
        stockLocation: { servedClientId: null },
      },
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
        stockLocation: { servedClientId: null },
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
    if (!location.servedClientId) {
      throw new BadRequestException(
        'Movimentacao de estoque nao e mais feita na Consultoria. Use o Painel do Cliente (/portal/estoque).',
      );
    }
    if (!location.isActive) {
      throw new BadRequestException(
        'Nao e possivel movimentar estoque em local inativo.',
      );
    }

    if (!Number.isInteger(dto.quantity) || dto.quantity < 0) {
      throw new BadRequestException(
        'Quantidade deve ser um inteiro maior ou igual a zero.',
      );
    }

    if (
      (dto.type === EpiStockMovementType.SAIDA_MANUAL ||
        dto.type === EpiStockMovementType.ENTREGA ||
        dto.type === EpiStockMovementType.AJUSTE) &&
      !dto.reason?.trim()
    ) {
      throw new BadRequestException(
        'Informe o motivo para saida, entrega ou ajuste.',
      );
    }

    if (
      dto.type === EpiStockMovementType.ENTRADA ||
      dto.type === EpiStockMovementType.SAIDA_MANUAL ||
      dto.type === EpiStockMovementType.ENTREGA ||
      dto.type === EpiStockMovementType.DEVOLUCAO ||
      dto.type === EpiStockMovementType.CANCELAMENTO_ENTREGA
    ) {
      if (dto.quantity <= 0) {
        throw new BadRequestException(
          'Quantidade do movimento deve ser maior que zero.',
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      return this.applyMovementInTx(tx, organizationId, userId, dto);
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
        epiVariantId: dto.epiVariantId?.trim() || null,
        stockLocationId: dto.stockLocationId,
        servedClientId: location.servedClientId,
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

  /**
   * Aplica movimento de estoque dentro de uma transacao existente
   * (usado pela entrega portal para atomicidade com evidencias).
   */
  async applyMovementInTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
    dto: CreateStockMovementDto,
  ) {
    const location = await tx.stockLocation.findFirst({
      where: { id: dto.stockLocationId, organizationId },
    });
    if (!location) {
      throw new NotFoundException('Local de estoque nao encontrado.');
    }
    if (!location.isActive) {
      throw new BadRequestException(
        'Nao e possivel movimentar estoque em local inativo.',
      );
    }

    const epi = await tx.epiItem.findFirst({
      where: { id: dto.epiItemId, organizationId },
      select: { id: true, name: true, isActive: true },
    });
    if (!epi) {
      throw new NotFoundException('EPI nao encontrado neste tenant.');
    }

    const epiVariantId = dto.epiVariantId?.trim() || null;
    if (epiVariantId) {
      const variant = await tx.epiVariant.findFirst({
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

    const existing = await tx.epiStockBalance.findFirst({
      where: {
        organizationId,
        epiItemId: dto.epiItemId,
        stockLocationId: dto.stockLocationId,
        ...(epiVariantId ? { epiVariantId } : { epiVariantId: null }),
      },
    });

    const previousQuantity = existing?.quantity ?? 0;
    let newQuantity = previousQuantity;

    if (
      dto.type === EpiStockMovementType.ENTRADA ||
      dto.type === EpiStockMovementType.DEVOLUCAO ||
      dto.type === EpiStockMovementType.CANCELAMENTO_ENTREGA
    ) {
      newQuantity = previousQuantity + dto.quantity;
    } else if (
      dto.type === EpiStockMovementType.SAIDA_MANUAL ||
      dto.type === EpiStockMovementType.ENTREGA
    ) {
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

    const unitCostCents =
      dto.unitCostCents != null && Number.isInteger(dto.unitCostCents)
        ? Math.max(0, dto.unitCostCents)
        : null;
    const totalCostCents =
      unitCostCents != null &&
      (dto.type === EpiStockMovementType.ENTRADA ||
        dto.type === EpiStockMovementType.DEVOLUCAO)
        ? unitCostCents * dto.quantity
        : null;

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
        unitCostCents,
        totalCostCents,
        invoiceDocumentId: dto.invoiceDocumentId?.trim() || null,
        createdByUserId: userId,
      },
      include: movementInclude,
    });

    if (
      unitCostCents != null &&
      dto.type === EpiStockMovementType.ENTRADA
    ) {
      await tx.epiItem.update({
        where: { id: dto.epiItemId },
        data: { defaultUnitPriceCents: unitCostCents },
      });
    }

    return { balance, movement };
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
