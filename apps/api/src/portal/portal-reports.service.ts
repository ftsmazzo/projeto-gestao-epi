import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DeliveryEvidenceType,
  EpiDeliveryItemStatus,
  EpiDeliveryReturnCondition,
  EpiDeliveryStatus,
  WorkerStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { groupCoverageRequirementsByNeed } from './portal-epi-coverage.utils';
import {
  formatUsefulLifeSnapshot,
  REPLACEMENT_WARN_DAYS,
  REPLACEMENT_CRITICAL_DAYS,
} from './replacement-schedule.utils';

export type PortalReportFilters = {
  from?: string;
  to?: string;
  workerId?: string;
  unitId?: string;
  sectorId?: string;
  jobFunctionId?: string;
  epiNeedId?: string;
  epiItemId?: string;
  status?: string;
  stockLocationId?: string;
  stockStatus?: string;
};


function parseDayStart(value?: string): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(`${value.trim()}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Data "from" invalida. Use YYYY-MM-DD.');
  }
  return d;
}

function parseDayEnd(value?: string): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(`${value.trim()}T23:59:59.999Z`);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Data "to" invalida. Use YYYY-MM-DD.');
  }
  return d;
}

function defaultPeriod() {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 30);
  from.setUTCHours(0, 0, 0, 0);
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
}

function stockRowStatus(quantity: number, minQuantity: number | null) {
  if (quantity <= 0) return 'zerado' as const;
  if (minQuantity != null && quantity <= minQuantity) return 'baixo' as const;
  return 'ok' as const;
}

@Injectable()
export class PortalReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFiltersMeta(organizationId: string, servedClientId: string) {
    await this.requireClient(organizationId, servedClientId);
    const [units, sectors, jobs, workers] = await Promise.all([
      this.prisma.operationalUnit.findMany({
        where: { organizationId, servedClientId, status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.clientSector.findMany({
        where: { organizationId, servedClientId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.clientJobFunction.findMany({
        where: { organizationId, servedClientId, isActive: true },
        select: { id: true, name: true, sectorId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.worker.findMany({
        where: {
          organizationId,
          servedClientId,
          status: WorkerStatus.ACTIVE,
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
    ]);
    return { units, sectors, jobs, workers };
  }

  async getOverview(
    organizationId: string,
    servedClientId: string,
    filters: PortalReportFilters,
  ) {
    await this.requireClient(organizationId, servedClientId);
    const period = this.resolvePeriod(filters);

    const workerWhere = this.workerFilter(filters);

    const [
      deliveriesInPeriod,
      itemsAgg,
      returnsInPeriod,
      cancellationsInPeriod,
      workersActive,
      coverage,
      stockBalances,
    ] = await Promise.all([
      this.prisma.epiDelivery.count({
        where: {
          organizationId,
          servedClientId,
          deliveredAt: { gte: period.from, lte: period.to },
          ...(filters.workerId ? { workerId: filters.workerId } : {}),
          ...(workerWhere ? { worker: workerWhere } : {}),
        },
      }),
      this.prisma.epiDeliveryItem.aggregate({
        where: {
          delivery: {
            organizationId,
            servedClientId,
            deliveredAt: { gte: period.from, lte: period.to },
            ...(filters.workerId ? { workerId: filters.workerId } : {}),
            ...(workerWhere ? { worker: workerWhere } : {}),
          },
        },
        _sum: { quantity: true },
      }),
      this.prisma.epiDeliveryReturn.count({
        where: {
          organizationId,
          servedClientId,
          returnedAt: { gte: period.from, lte: period.to },
        },
      }),
      this.prisma.epiDelivery.count({
        where: {
          organizationId,
          servedClientId,
          status: EpiDeliveryStatus.CANCELLED,
          cancelledAt: { gte: period.from, lte: period.to },
        },
      }),
      this.prisma.worker.count({
        where: {
          organizationId,
          servedClientId,
          status: WorkerStatus.ACTIVE,
        },
      }),
      this.buildCoverageSnapshot(organizationId, servedClientId),
      this.prisma.epiStockBalance.findMany({
        where: {
          organizationId,
          stockLocation: { servedClientId, isActive: true },
        },
        select: { quantity: true, minQuantity: true },
      }),
    ]);

    let stockLow = 0;
    let stockZero = 0;
    for (const row of stockBalances) {
      const st = stockRowStatus(row.quantity, row.minQuantity);
      if (st === 'zerado') stockZero += 1;
      else if (st === 'baixo') stockLow += 1;
    }

    return {
      period: {
        from: period.from.toISOString().slice(0, 10),
        to: period.to.toISOString().slice(0, 10),
      },
      cards: {
        deliveriesInPeriod,
        itemsDelivered: itemsAgg._sum.quantity ?? 0,
        returnsInPeriod,
        cancellationsInPeriod,
        workersActive,
        needsWithoutLinkedEpi: coverage.semEpiReal,
        needsWithoutStock: coverage.semEstoque,
        stockLowOrZero: stockLow + stockZero,
        stockLow,
        stockZero,
      },
      cost: {
        estimatedDeliveredCost: null,
        available: true,
        message:
          'Veja o dashboard de Custos no Painel do Cliente para totais por EPI, setor e funcao.',
      },
    };
  }

  async getDeliveriesReport(
    organizationId: string,
    servedClientId: string,
    filters: PortalReportFilters,
  ) {
    await this.requireClient(organizationId, servedClientId);
    const period = this.resolvePeriod(filters);
    const workerWhere = this.workerFilter(filters);

    const status =
      filters.status &&
      Object.values(EpiDeliveryStatus).includes(
        filters.status as EpiDeliveryStatus,
      )
        ? (filters.status as EpiDeliveryStatus)
        : undefined;

    const rows = await this.prisma.epiDelivery.findMany({
      where: {
        organizationId,
        servedClientId,
        deliveredAt: { gte: period.from, lte: period.to },
        ...(status ? { status } : {}),
        ...(filters.workerId ? { workerId: filters.workerId } : {}),
        ...(workerWhere ? { worker: workerWhere } : {}),
        ...(filters.epiNeedId
          ? { items: { some: { epiNeedId: filters.epiNeedId } } }
          : {}),
        ...(filters.epiItemId
          ? { items: { some: { epiItemId: filters.epiItemId } } }
          : {}),
      },
      orderBy: { deliveredAt: 'desc' },
      take: 200,
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            registration: true,
            operationalUnit: { select: { id: true, name: true } },
            clientSector: { select: { id: true, name: true } },
            clientJobFunction: { select: { id: true, name: true } },
          },
        },
        deliveredByUser: { select: { id: true, name: true } },
        items: {
          include: {
            epiNeed: { select: { name: true } },
            epiItem: { select: { name: true } },
          },
        },
        evidences: {
          where: { type: DeliveryEvidenceType.FACIAL_CAPTURE },
          select: { id: true },
          take: 1,
        },
      },
    });

    return {
      period: {
        from: period.from.toISOString().slice(0, 10),
        to: period.to.toISOString().slice(0, 10),
      },
      rows: rows.map((row) => ({
        id: row.id,
        receiptNumber: row.receiptNumber,
        deliveredAt: row.deliveredAt.toISOString(),
        status: row.status,
        statusLabel: this.deliveryStatusLabel(row.status),
        worker: {
          id: row.worker.id,
          name: row.worker.name,
          registration: row.worker.registration,
          unitName: row.worker.operationalUnit?.name ?? null,
          sectorName: row.worker.clientSector?.name ?? null,
          jobFunctionName: row.worker.clientJobFunction?.name ?? null,
        },
        itemsSummary: row.items
          .map((i) => {
            const need =
              i.isExtra
                ? 'Extra (fora das indicacoes)'
                : (i.epiNeed?.name ?? '—');
            return `${need}→${i.epiItem.name} (${i.quantity})`;
          })
          .join('; '),
        itemCount: row.items.length,
        operatorName: row.deliveredByUser.name,
        hasFacialEvidence: row.evidences.length > 0,
      })),
    };
  }

  async getStockReport(
    organizationId: string,
    servedClientId: string,
    filters: PortalReportFilters,
  ) {
    await this.requireClient(organizationId, servedClientId);

    const balances = await this.prisma.epiStockBalance.findMany({
      where: {
        organizationId,
        stockLocation: {
          servedClientId,
          isActive: true,
          ...(filters.stockLocationId
            ? { id: filters.stockLocationId }
            : {}),
        },
        ...(filters.epiItemId ? { epiItemId: filters.epiItemId } : {}),
      },
      include: {
        epiItem: {
          select: {
            id: true,
            name: true,
            caNumber: true,
            caExpiresAt: true,
            category: true,
            itemNeeds: {
              include: { epiNeed: { select: { id: true, name: true } } },
              take: 5,
            },
          },
        },
        stockLocation: { select: { id: true, name: true } },
      },
      orderBy: [{ quantity: 'asc' }, { updatedAt: 'desc' }],
      take: 500,
    });

    let rows = balances.map((b) => {
      const status = stockRowStatus(b.quantity, b.minQuantity);
      return {
        epiItemId: b.epiItem.id,
        epiName: b.epiItem.name,
        caNumber: b.epiItem.caNumber,
        caExpiresAt: b.epiItem.caExpiresAt?.toISOString() ?? null,
        category: b.epiItem.category,
        needs: b.epiItem.itemNeeds.map((l) => ({
          id: l.epiNeed.id,
          name: l.epiNeed.name,
        })),
        needsLabel:
          b.epiItem.itemNeeds.map((l) => l.epiNeed.name).join(', ') || '—',
        stockLocationId: b.stockLocation.id,
        locationName: b.stockLocation.name,
        quantity: b.quantity,
        minQuantity: b.minQuantity,
        status,
        statusLabel:
          status === 'ok' ? 'OK' : status === 'baixo' ? 'Baixo' : 'Zerado',
      };
    });

    if (filters.stockStatus) {
      const wanted = filters.stockStatus.toLowerCase();
      rows = rows.filter((r) => r.status === wanted);
    }
    if (filters.epiNeedId) {
      rows = rows.filter((r) =>
        r.needs.some((n) => n.id === filters.epiNeedId),
      );
    }

    return {
      summary: {
        total: rows.length,
        ok: rows.filter((r) => r.status === 'ok').length,
        baixo: rows.filter((r) => r.status === 'baixo').length,
        zerado: rows.filter((r) => r.status === 'zerado').length,
      },
      rows,
    };
  }

  async getReturnsReport(
    organizationId: string,
    servedClientId: string,
    filters: PortalReportFilters,
  ) {
    await this.requireClient(organizationId, servedClientId);
    const period = this.resolvePeriod(filters);
    const workerWhere = this.workerFilter(filters);

    const [returns, cancellations] = await Promise.all([
      this.prisma.epiDeliveryReturn.findMany({
        where: {
          organizationId,
          servedClientId,
          returnedAt: { gte: period.from, lte: period.to },
          delivery: {
            ...(filters.workerId ? { workerId: filters.workerId } : {}),
            ...(workerWhere ? { worker: workerWhere } : {}),
          },
        },
        orderBy: { returnedAt: 'desc' },
        take: 200,
        include: {
          returnedByUser: { select: { id: true, name: true } },
          delivery: {
            select: {
              id: true,
              receiptNumber: true,
              worker: {
                select: {
                  id: true,
                  name: true,
                  registration: true,
                },
              },
            },
          },
          items: {
            include: {
              deliveryItem: {
                include: {
                  epiNeed: { select: { name: true } },
                  epiItem: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.epiDelivery.findMany({
        where: {
          organizationId,
          servedClientId,
          status: EpiDeliveryStatus.CANCELLED,
          cancelledAt: { gte: period.from, lte: period.to },
          ...(filters.workerId ? { workerId: filters.workerId } : {}),
          ...(workerWhere ? { worker: workerWhere } : {}),
        },
        orderBy: { cancelledAt: 'desc' },
        take: 200,
        include: {
          cancelledByUser: { select: { id: true, name: true } },
          worker: {
            select: { id: true, name: true, registration: true },
          },
          items: {
            where: { cancelledQuantity: { gt: 0 } },
            include: {
              epiNeed: { select: { name: true } },
              epiItem: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const rows: Array<{
      id: string;
      at: string;
      type: 'DEVOLUCAO' | 'CANCELAMENTO';
      typeLabel: string;
      receiptNumber: string;
      deliveryId: string;
      workerName: string;
      workerRegistration: string | null;
      itemLabel: string;
      quantity: number;
      condition: string | null;
      returnedToStock: boolean | null;
      reason: string | null;
      operatorName: string | null;
    }> = [];

    for (const ret of returns) {
      for (const item of ret.items) {
        rows.push({
          id: `ret-${item.id}`,
          at: ret.returnedAt.toISOString(),
          type: 'DEVOLUCAO',
          typeLabel: 'Devolucao',
          receiptNumber: ret.delivery.receiptNumber,
          deliveryId: ret.delivery.id,
          workerName: ret.delivery.worker.name,
          workerRegistration: ret.delivery.worker.registration,
          itemLabel: `${
            item.deliveryItem.isExtra
              ? 'Extra (fora das indicacoes)'
              : (item.deliveryItem.epiNeed?.name ?? '—')
          } → ${item.deliveryItem.epiItem.name}`,
          quantity: item.quantity,
          condition: item.condition,
          returnedToStock:
            item.condition === EpiDeliveryReturnCondition.REUSABLE,
          reason: ret.reason,
          operatorName: ret.returnedByUser.name,
        });
      }
    }

    for (const cancel of cancellations) {
      for (const item of cancel.items) {
        rows.push({
          id: `can-${cancel.id}-${item.id}`,
          at: (cancel.cancelledAt ?? cancel.updatedAt).toISOString(),
          type: 'CANCELAMENTO',
          typeLabel: 'Cancelamento',
          receiptNumber: cancel.receiptNumber,
          deliveryId: cancel.id,
          workerName: cancel.worker.name,
          workerRegistration: cancel.worker.registration,
          itemLabel: `${
            item.isExtra
              ? 'Extra (fora das indicacoes)'
              : (item.epiNeed?.name ?? '—')
          } → ${item.epiItem.name}`,
          quantity: item.cancelledQuantity,
          condition: null,
          returnedToStock: true,
          reason: cancel.cancelReason,
          operatorName: cancel.cancelledByUser?.name ?? null,
        });
      }
    }

    rows.sort((a, b) => b.at.localeCompare(a.at));

    const typeFilter = filters.status?.toUpperCase();
    const filtered =
      typeFilter === 'DEVOLUCAO' || typeFilter === 'CANCELAMENTO'
        ? rows.filter((r) => r.type === typeFilter)
        : rows;

    return {
      period: {
        from: period.from.toISOString().slice(0, 10),
        to: period.to.toISOString().slice(0, 10),
      },
      rows: filtered.slice(0, 300),
    };
  }

  async getCoverageReport(
    organizationId: string,
    servedClientId: string,
    filters: PortalReportFilters,
  ) {
    await this.requireClient(organizationId, servedClientId);

    const jobs = await this.prisma.clientJobFunction.findMany({
      where: {
        organizationId,
        servedClientId,
        isActive: true,
        ...(filters.jobFunctionId ? { id: filters.jobFunctionId } : {}),
        ...(filters.sectorId ? { sectorId: filters.sectorId } : {}),
      },
      include: {
        sector: { select: { id: true, name: true } },
        epiRequirements: {
          where: { isActive: true },
          include: {
            epiNeed: {
              select: {
                id: true,
                name: true,
                itemLinks: {
                  select: {
                    isPrimary: true,
                    epiItem: {
                      select: {
                        id: true,
                        name: true,
                        isActive: true,
                      },
                    },
                  },
                },
              },
            },
            risk: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const epiItemIds = new Set<string>();
    for (const job of jobs) {
      for (const req of job.epiRequirements) {
        for (const link of req.epiNeed.itemLinks) {
          if (link.epiItem?.isActive) epiItemIds.add(link.epiItem.id);
        }
      }
    }

    const balances =
      epiItemIds.size === 0
        ? []
        : await this.prisma.epiStockBalance.findMany({
            where: {
              organizationId,
              epiItemId: { in: Array.from(epiItemIds) },
              stockLocation: { servedClientId, isActive: true },
            },
            select: { epiItemId: true, quantity: true },
          });

    const qtyByEpi = new Map<string, number>();
    for (const b of balances) {
      qtyByEpi.set(b.epiItemId, (qtyByEpi.get(b.epiItemId) ?? 0) + b.quantity);
    }

    const byJobFunction = jobs.map((job) => {
      const grouped = groupCoverageRequirementsByNeed(
        job.epiRequirements.map((req) => ({
          id: req.id,
          epiNeedId: req.epiNeedId,
          needName: req.epiNeed.name,
          isRequired: req.isRequired,
          quantity: req.quantity,
          replacementIntervalDays: req.replacementIntervalDays,
          riskId: req.riskId,
          riskName: req.risk?.name ?? null,
        })),
      );

      const needs = grouped
        .filter((g) => !filters.epiNeedId || g.epiNeedId === filters.epiNeedId)
        .map((g) => {
          const reqSample = job.epiRequirements.find(
            (r) => r.epiNeedId === g.epiNeedId,
          )!;
          const linked = reqSample.epiNeed.itemLinks.filter(
            (l) => l.epiItem?.isActive,
          );
          const availableStock = linked.reduce(
            (sum, l) => sum + (qtyByEpi.get(l.epiItem!.id) ?? 0),
            0,
          );

          let status: 'DISPONIVEL' | 'SEM_ESTOQUE' | 'SEM_EPI_REAL_VINCULADO';
          if (linked.length === 0) {
            status = 'SEM_EPI_REAL_VINCULADO';
          } else if (availableStock <= 0) {
            status = 'SEM_ESTOQUE';
          } else {
            status = 'DISPONIVEL';
          }

          return {
            epiNeedId: g.epiNeedId,
            needName: g.needName,
            isRequired: g.isRequired,
            quantity: g.quantity,
            replacementIntervalDays: g.replacementIntervalDays,
            risks: g.risks,
            warnings: g.warnings,
            linkedEpiCount: linked.length,
            availableStock,
            status,
            statusLabel:
              status === 'DISPONIVEL'
                ? 'Disponivel'
                : status === 'SEM_ESTOQUE'
                  ? 'Sem estoque'
                  : 'Sem EPI real',
          };
        })
        .filter((n) => !filters.status || n.status === filters.status);

      return {
        jobFunctionId: job.id,
        jobFunctionName: job.name,
        sectorId: job.sectorId,
        sectorName: job.sector?.name ?? null,
        needs,
      };
    });

    const resultJobs = byJobFunction.filter((j) => j.needs.length > 0);

    let disponivel = 0;
    let semEstoque = 0;
    let semEpiReal = 0;
    for (const job of resultJobs) {
      for (const n of job.needs) {
        if (n.status === 'DISPONIVEL') disponivel += 1;
        else if (n.status === 'SEM_ESTOQUE') semEstoque += 1;
        else semEpiReal += 1;
      }
    }

    return {
      summary: {
        totalNeeds: disponivel + semEstoque + semEpiReal,
        disponivel,
        semEstoque,
        semEpiReal,
      },
      byJobFunction: resultJobs,
    };
  }

  async getReplacementsReport(
    organizationId: string,
    servedClientId: string,
    filters: PortalReportFilters,
  ) {
    await this.requireClient(organizationId, servedClientId);
    const now = new Date();
    const warnHorizon = new Date(now);
    warnHorizon.setUTCDate(warnHorizon.getUTCDate() + REPLACEMENT_WARN_DAYS);
    warnHorizon.setUTCHours(23, 59, 59, 999);
    const criticalHorizon = new Date(now);
    criticalHorizon.setUTCDate(
      criticalHorizon.getUTCDate() + REPLACEMENT_CRITICAL_DAYS,
    );
    criticalHorizon.setUTCHours(23, 59, 59, 999);

    const workerWhere = this.workerFilter(filters);
    const items = await this.prisma.epiDeliveryItem.findMany({
      where: {
        status: {
          in: [
            EpiDeliveryItemStatus.DELIVERED,
            EpiDeliveryItemStatus.PARTIALLY_RETURNED,
          ],
        },
        nextReplacementAt: { not: null, lte: warnHorizon },
        delivery: {
          organizationId,
          servedClientId,
          status: {
            in: [
              EpiDeliveryStatus.COMPLETED,
              EpiDeliveryStatus.PARTIALLY_RETURNED,
            ],
          },
          ...(filters.workerId ? { workerId: filters.workerId } : {}),
          ...(workerWhere ? { worker: workerWhere } : {}),
        },
        ...(filters.epiNeedId ? { epiNeedId: filters.epiNeedId } : {}),
        ...(filters.epiItemId ? { epiItemId: filters.epiItemId } : {}),
      },
      include: {
        delivery: {
          select: {
            id: true,
            receiptNumber: true,
            worker: {
              select: {
                id: true,
                name: true,
                registration: true,
                operationalUnit: { select: { name: true } },
                clientSector: { select: { name: true } },
                clientJobFunction: { select: { name: true } },
              },
            },
          },
        },
        epiNeed: { select: { name: true } },
        epiItem: { select: { name: true, caNumber: true } },
      },
      orderBy: { nextReplacementAt: 'asc' },
      take: 500,
    });

    const msPerDay = 24 * 60 * 60 * 1000;
    const rows = items
      .filter((item) => item.nextReplacementAt)
      .map((item) => {
        const at = item.nextReplacementAt!;
        const daysRemaining = Math.ceil(
          (at.getTime() - now.getTime()) / msPerDay,
        );
        const tone: 'overdue' | 'critical' | 'warn' =
          daysRemaining < 0
            ? 'overdue'
            : at.getTime() <= criticalHorizon.getTime()
              ? 'critical'
              : 'warn';
        return {
          id: item.id,
          deliveryId: item.delivery.id,
          receiptNumber: item.delivery.receiptNumber,
          workerId: item.delivery.worker.id,
          workerName: item.delivery.worker.name,
          workerRegistration: item.delivery.worker.registration,
          unitName: item.delivery.worker.operationalUnit?.name ?? null,
          sectorName: item.delivery.worker.clientSector?.name ?? null,
          jobFunctionName:
            item.delivery.worker.clientJobFunction?.name ?? null,
          epiName: item.epiItem.name,
          needName: item.isExtra
            ? 'Extra (fora das indicacoes)'
            : (item.epiNeed?.name ?? '—'),
          caNumber: item.epiItem.caNumber,
          nextReplacementAt: at.toISOString(),
          usefulLifeLabel: formatUsefulLifeSnapshot(
            item.usefulLifeValue,
            item.usefulLifeUnit,
            item.quantity - item.returnedQuantity - item.cancelledQuantity,
          ),
          daysRemaining,
          tone,
          toneLabel:
            tone === 'overdue'
              ? 'Vencido'
              : tone === 'critical'
                ? 'Critico'
                : 'Alerta',
        };
      })
      .filter((row) => !filters.status || row.tone === filters.status);

    return {
      horizon: {
        warnDays: REPLACEMENT_WARN_DAYS,
        criticalDays: REPLACEMENT_CRITICAL_DAYS,
      },
      summary: {
        total: rows.length,
        overdue: rows.filter((r) => r.tone === 'overdue').length,
        critical: rows.filter((r) => r.tone === 'critical').length,
        warn: rows.filter((r) => r.tone === 'warn').length,
      },
      rows,
    };
  }

  async getActivityReport(
    organizationId: string,
    servedClientId: string,
    filters: PortalReportFilters,
  ) {
    await this.requireClient(organizationId, servedClientId);
    const period = this.resolvePeriod(filters);
    const workerWhere = this.workerFilter(filters);

    const deliveries = await this.prisma.epiDelivery.findMany({
      where: {
        organizationId,
        servedClientId,
        deliveredAt: { gte: period.from, lte: period.to },
        status: {
          in: [
            EpiDeliveryStatus.COMPLETED,
            EpiDeliveryStatus.PARTIALLY_RETURNED,
            EpiDeliveryStatus.RETURNED,
          ],
        },
        ...(filters.workerId ? { workerId: filters.workerId } : {}),
        ...(workerWhere ? { worker: workerWhere } : {}),
      },
      select: {
        id: true,
        workerId: true,
        worker: {
          select: {
            id: true,
            name: true,
            registration: true,
            operationalUnit: { select: { name: true } },
            clientSector: { select: { id: true, name: true } },
            clientJobFunction: { select: { name: true } },
          },
        },
        items: { select: { quantity: true } },
        evidences: {
          where: { type: DeliveryEvidenceType.FACIAL_CAPTURE },
          select: { id: true },
          take: 1,
        },
      },
      take: 2000,
    });

    type WorkerAgg = {
      workerId: string;
      workerName: string;
      registration: string | null;
      unitName: string | null;
      sectorName: string | null;
      jobFunctionName: string | null;
      deliveries: number;
      itemsDelivered: number;
      withFacial: number;
    };

    const byWorkerMap = new Map<string, WorkerAgg>();
    const bySectorMap = new Map<
      string,
      { sectorId: string | null; sectorName: string; deliveries: number; itemsDelivered: number }
    >();

    for (const d of deliveries) {
      const qty = d.items.reduce((sum, i) => sum + i.quantity, 0);
      const facial = d.evidences.length > 0 ? 1 : 0;
      const existing = byWorkerMap.get(d.workerId);
      if (existing) {
        existing.deliveries += 1;
        existing.itemsDelivered += qty;
        existing.withFacial += facial;
      } else {
        byWorkerMap.set(d.workerId, {
          workerId: d.worker.id,
          workerName: d.worker.name,
          registration: d.worker.registration,
          unitName: d.worker.operationalUnit?.name ?? null,
          sectorName: d.worker.clientSector?.name ?? null,
          jobFunctionName: d.worker.clientJobFunction?.name ?? null,
          deliveries: 1,
          itemsDelivered: qty,
          withFacial: facial,
        });
      }

      const sectorKey = d.worker.clientSector?.id ?? '__none__';
      const sectorName = d.worker.clientSector?.name ?? 'Sem setor';
      const sector = bySectorMap.get(sectorKey);
      if (sector) {
        sector.deliveries += 1;
        sector.itemsDelivered += qty;
      } else {
        bySectorMap.set(sectorKey, {
          sectorId: d.worker.clientSector?.id ?? null,
          sectorName,
          deliveries: 1,
          itemsDelivered: qty,
        });
      }
    }

    const byWorker = Array.from(byWorkerMap.values())
      .map((w) => ({
        ...w,
        facialRate:
          w.deliveries === 0
            ? 0
            : Math.round((w.withFacial / w.deliveries) * 100),
      }))
      .sort(
        (a, b) =>
          b.deliveries - a.deliveries ||
          b.itemsDelivered - a.itemsDelivered ||
          a.workerName.localeCompare(b.workerName, 'pt-BR'),
      );

    const bySector = Array.from(bySectorMap.values()).sort(
      (a, b) =>
        b.deliveries - a.deliveries ||
        a.sectorName.localeCompare(b.sectorName, 'pt-BR'),
    );

    return {
      period: {
        from: period.from.toISOString().slice(0, 10),
        to: period.to.toISOString().slice(0, 10),
      },
      summary: {
        deliveries: deliveries.length,
        workersWithActivity: byWorker.length,
        sectorsWithActivity: bySector.length,
        itemsDelivered: byWorker.reduce((s, w) => s + w.itemsDelivered, 0),
      },
      byWorker,
      bySector,
    };
  }

  private async buildCoverageSnapshot(
    organizationId: string,
    servedClientId: string,
  ) {
    const snap = await this.getCoverageReport(organizationId, servedClientId, {});
    return snap.summary;
  }

  private resolvePeriod(filters: PortalReportFilters) {
    const from = parseDayStart(filters.from);
    const to = parseDayEnd(filters.to);
    if (!from && !to) return defaultPeriod();
    if (from && to && from > to) {
      throw new BadRequestException('"from" nao pode ser maior que "to".');
    }
    if (from && to) return { from, to };
    if (from && !to) {
      const end = new Date();
      end.setUTCHours(23, 59, 59, 999);
      return { from, to: end };
    }
    const start = new Date(to!);
    start.setUTCDate(start.getUTCDate() - 30);
    start.setUTCHours(0, 0, 0, 0);
    return { from: start, to: to! };
  }

  private workerFilter(filters: PortalReportFilters) {
    const where: {
      operationalUnitId?: string;
      clientSectorId?: string;
      clientJobFunctionId?: string;
    } = {};
    if (filters.unitId) where.operationalUnitId = filters.unitId;
    if (filters.sectorId) where.clientSectorId = filters.sectorId;
    if (filters.jobFunctionId) where.clientJobFunctionId = filters.jobFunctionId;
    return Object.keys(where).length > 0 ? where : undefined;
  }

  private deliveryStatusLabel(status: EpiDeliveryStatus): string {
    switch (status) {
      case EpiDeliveryStatus.CANCELLED:
        return 'Cancelada';
      case EpiDeliveryStatus.PARTIALLY_RETURNED:
        return 'Parcialmente devolvida';
      case EpiDeliveryStatus.RETURNED:
        return 'Devolvida';
      default:
        return 'Concluida';
    }
  }

  private async requireClient(organizationId: string, servedClientId: string) {
    const client = await this.prisma.servedClient.findFirst({
      where: { id: servedClientId, organizationId },
    });
    if (!client) {
      throw new NotFoundException('Cliente nao encontrado.');
    }
    return client;
  }
}
