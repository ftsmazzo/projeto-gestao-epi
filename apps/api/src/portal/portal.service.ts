import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EpiStockMovementType, WorkerStatus } from '@prisma/client';
import { normalizeCaNumber } from '../caepi/caepi-import.utils';
import { CaepiService } from '../caepi/caepi.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import type { PortalStockEntradasDto } from './dto/portal-stock.dto';

const VALIDITY_SOON_DAYS = 90;
const DEFAULT_LOCATION_NAME = 'Estoque principal';

type ValidityBucket = 'expired' | 'soon' | 'ok' | 'missing';

type EpiCatalogSelect = {
  id: string;
  name: string;
  caNumber: string | null;
  caExpiresAt: Date | null;
  usefulLifeValue: number | null;
  usefulLifeUnit: string | null;
  unitOfMeasure: string;
  category: string | null;
};

function stripDiacritics(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatUsefulLife(
  value: number | null | undefined,
  unit: string | null | undefined,
): string | null {
  if (value == null || !unit) return null;
  const label =
    unit === 'DIAS' ? 'dia(s)' : unit === 'MESES' ? 'mes(es)' : 'ano(s)';
  return `${value} ${label}`;
}

function mapEpiSearchItem(item: EpiCatalogSelect) {
  return {
    id: item.id,
    name: item.name,
    caNumber: item.caNumber,
    caExpiresAt: item.caExpiresAt?.toISOString() ?? null,
    usefulLifeValue: item.usefulLifeValue,
    usefulLifeUnit: item.usefulLifeUnit,
    usefulLifeLabel: formatUsefulLife(
      item.usefulLifeValue,
      item.usefulLifeUnit,
    ),
    unitOfMeasure: item.unitOfMeasure,
    category: item.category,
  };
}

const epiCatalogSelect = {
  id: true,
  name: true,
  caNumber: true,
  caExpiresAt: true,
  usefulLifeValue: true,
  usefulLifeUnit: true,
  unitOfMeasure: true,
  category: true,
} as const;

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly caepi: CaepiService,
  ) {}

  async getDashboard(organizationId: string, servedClientId: string) {
    const client = await this.requireClient(organizationId, servedClientId);

    const [
      unitsActive,
      workersActive,
      sectorsActive,
      jobsActive,
      requirementsActive,
      validity,
    ] = await Promise.all([
      this.prisma.operationalUnit.count({
        where: { organizationId, servedClientId, status: 'ACTIVE' },
      }),
      this.prisma.worker.count({
        where: {
          organizationId,
          servedClientId,
          status: WorkerStatus.ACTIVE,
        },
      }),
      this.prisma.clientSector.count({
        where: { organizationId, servedClientId, isActive: true },
      }),
      this.prisma.clientJobFunction.count({
        where: { organizationId, servedClientId, isActive: true },
      }),
      this.prisma.jobFunctionEpiRequirement.count({
        where: {
          organizationId,
          isActive: true,
          jobFunction: { servedClientId, isActive: true },
        },
      }),
      this.buildValidityItems(organizationId, servedClientId),
    ]);

    const uniqueNeeds = await this.countUniqueNeeds(
      organizationId,
      servedClientId,
    );

    const stockAgg = await this.prisma.epiStockBalance.aggregate({
      where: {
        organizationId,
        stockLocation: { servedClientId },
      },
      _sum: { quantity: true },
      _count: { _all: true },
    });

    const expired = validity.filter((v) => v.bucket === 'expired').length;
    const soon = validity.filter((v) => v.bucket === 'soon').length;
    const missingCa = validity.filter((v) => v.bucket === 'missing').length;

    return {
      client: {
        id: client.id,
        legalName: client.legalName,
        tradeName: client.tradeName,
        cnpj: client.cnpj,
        status: client.status,
        allocatedLifeQuota: client.allocatedLifeQuota,
      },
      lives: {
        allocated: client.allocatedLifeQuota,
        used: workersActive,
        available: Math.max(0, client.allocatedLifeQuota - workersActive),
      },
      counts: {
        unitsActive,
        workersActive,
        sectorsActive,
        jobsActive,
        requirementsActive,
        uniqueNeeds,
      },
      metrics: {
        entregas: null as number | null,
        validade: expired + soon + missingCa,
        custos: null as number | null,
        estoque: stockAgg._sum.quantity ?? 0,
      },
      validitySummary: {
        expired,
        soon,
        missingCa,
        tracked: validity.length,
      },
      modules: {
        entregas: { ready: false, reason: 'Fluxo de entrega ainda nao liberado.' },
        validade: { ready: true },
        custos: { ready: false, reason: 'Sem precificacao/consumo valorizado.' },
        estoque: {
          ready: true,
          mode: 'stock' as const,
          reason: 'Entrada e saldos desta empresa no Painel do Cliente.',
        },
      },
    };
  }

  async getValidade(organizationId: string, servedClientId: string) {
    await this.requireClient(organizationId, servedClientId);
    const items = await this.buildValidityItems(organizationId, servedClientId);
    const summary = {
      expired: items.filter((i) => i.bucket === 'expired').length,
      soon: items.filter((i) => i.bucket === 'soon').length,
      ok: items.filter((i) => i.bucket === 'ok').length,
      missing: items.filter((i) => i.bucket === 'missing').length,
      total: items.length,
      horizonDays: VALIDITY_SOON_DAYS,
    };
    return { summary, items };
  }

  async getEstrutura(organizationId: string, servedClientId: string) {
    await this.requireClient(organizationId, servedClientId);

    const sectors = await this.prisma.clientSector.findMany({
      where: { organizationId, servedClientId, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        operationalUnit: { select: { id: true, name: true } },
        jobFunctions: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          include: {
            risks: {
              include: { risk: { select: { id: true, name: true } } },
            },
            epiRequirements: {
              where: { isActive: true },
              include: {
                epiNeed: { select: { id: true, name: true } },
                risk: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    return {
      sectors: sectors.map((sector) => ({
        id: sector.id,
        name: sector.name,
        unitName: sector.operationalUnit?.name ?? null,
        jobs: sector.jobFunctions.map((job) => {
          const needMap = new Map<
            string,
            { id: string; name: string; riskNames: string[] }
          >();
          for (const req of job.epiRequirements) {
            const key = req.epiNeed.id;
            const existing = needMap.get(key);
            const riskName = req.risk?.name?.trim();
            if (existing) {
              if (riskName && !existing.riskNames.includes(riskName)) {
                existing.riskNames.push(riskName);
              }
            } else {
              needMap.set(key, {
                id: req.epiNeed.id,
                name: req.epiNeed.name,
                riskNames: riskName ? [riskName] : [],
              });
            }
          }
          return {
            id: job.id,
            name: job.name,
            risks: job.risks.map((link) => link.risk.name),
            needs: Array.from(needMap.values()).sort((a, b) =>
              a.name.localeCompare(b.name, 'pt-BR'),
            ),
          };
        }),
      })),
    };
  }

  async getTrabalhadores(organizationId: string, servedClientId: string) {
    const client = await this.requireClient(organizationId, servedClientId);
    const workers = await this.prisma.worker.findMany({
      where: { organizationId, servedClientId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        operationalUnit: { select: { id: true, name: true } },
      },
    });

    const active = workers.filter((w) => w.status === WorkerStatus.ACTIVE).length;

    return {
      lives: {
        allocated: client.allocatedLifeQuota,
        used: active,
        available: Math.max(0, client.allocatedLifeQuota - active),
      },
      workers: workers.map((w) => ({
        id: w.id,
        name: w.name,
        registration: w.registration,
        role: w.role,
        department: w.department,
        status: w.status,
        unitName: w.operationalUnit?.name ?? null,
        admissionDate: w.admissionDate?.toISOString() ?? null,
      })),
    };
  }

  async getEstoqueResumo(organizationId: string, servedClientId: string) {
    await this.requireClient(organizationId, servedClientId);
    const location = await this.ensureDefaultLocation(
      organizationId,
      servedClientId,
    );
    const [balances, needs] = await Promise.all([
      this.listClientBalances(organizationId, servedClientId),
      this.buildNeedsWithItems(organizationId, servedClientId),
    ]);

    return {
      mode: 'stock' as const,
      note: 'Estoque fisico desta empresa. Use entrada livre ou gere a lista pelas necessidades.',
      location: {
        id: location.id,
        name: location.name,
      },
      summary: {
        needs: needs.length,
        withLinkedEpi: needs.filter((n) => n.hasLinkedEpi).length,
        withoutLinkedEpi: needs.filter((n) => !n.hasLinkedEpi).length,
        balanceLines: balances.length,
        totalUnits: balances.reduce((sum, row) => sum + row.quantity, 0),
      },
      balances,
      needs,
    };
  }

  async searchEpis(organizationId: string, q: string) {
    const query = q.trim();
    if (query.length < 3) {
      throw new BadRequestException(
        'Informe ao menos 3 caracteres para buscar EPI.',
      );
    }

    const needle = stripDiacritics(query);
    const caNeedle = normalizeCaNumber(query);
    const catalog = await this.prisma.epiItem.findMany({
      where: { organizationId, isActive: true },
      select: {
        ...epiCatalogSelect,
        externalCode: true,
        manufacturerName: true,
      },
      orderBy: { name: 'asc' },
      take: 500,
    });

    const byId = new Map<string, ReturnType<typeof mapEpiSearchItem>>();

    for (const item of catalog) {
      const nameKey = stripDiacritics(item.name);
      const caKey = stripDiacritics(item.caNumber ?? '');
      const codeKey = stripDiacritics(item.externalCode ?? '');
      const mfrKey = stripDiacritics(item.manufacturerName ?? '');
      if (
        nameKey.includes(needle) ||
        caKey.includes(stripDiacritics(caNeedle)) ||
        codeKey.includes(needle) ||
        mfrKey.includes(needle)
      ) {
        byId.set(item.id, mapEpiSearchItem(item));
      }
    }

    // Necessidades do catalogo cujo nome bate → EPIs vinculados
    const needs = await this.prisma.epiNeed.findMany({
      where: { organizationId, isActive: true },
      select: {
        name: true,
        itemLinks: {
          select: {
            epiItem: { select: epiCatalogSelect },
          },
        },
      },
      take: 200,
    });
    for (const need of needs) {
      if (!stripDiacritics(need.name).includes(needle)) continue;
      for (const link of need.itemLinks) {
        if (!link.epiItem) continue;
        byId.set(
          link.epiItem.id,
          mapEpiSearchItem(link.epiItem as EpiCatalogSelect),
        );
      }
    }

    // CAEPI por nome/CA → cruza com itens do catalogo que tenham o mesmo CA
    if (byId.size < 20) {
      try {
        const caepi = await this.caepi.searchCertificates(query, 15);
        const caNumbers = caepi.items
          .map((item) => normalizeCaNumber(item.caNumber))
          .filter(Boolean);
        if (caNumbers.length > 0) {
          const byCa = await this.prisma.epiItem.findMany({
            where: {
              organizationId,
              isActive: true,
              caNumber: { in: caNumbers },
            },
            select: epiCatalogSelect,
          });
          for (const item of byCa) {
            byId.set(item.id, mapEpiSearchItem(item as EpiCatalogSelect));
          }
        }
      } catch {
        // Base CAEPI pode estar vazia; busca do catalogo segue.
      }
    }

    return Array.from(byId.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 20);
  }

  async lookupEpiByCa(organizationId: string, caRaw: string) {
    const caNumber = normalizeCaNumber(caRaw);
    if (caNumber.length < 3) {
      throw new BadRequestException('Informe um CA com ao menos 3 digitos.');
    }

    const exact = await this.prisma.epiItem.findFirst({
      where: {
        organizationId,
        isActive: true,
        caNumber: { equals: caNumber, mode: 'insensitive' },
      },
      select: epiCatalogSelect,
    });
    if (exact) {
      return {
        found: true as const,
        item: mapEpiSearchItem(exact as EpiCatalogSelect),
        message: null as string | null,
      };
    }

    const partial = await this.prisma.epiItem.findMany({
      where: {
        organizationId,
        isActive: true,
        caNumber: { contains: caNumber, mode: 'insensitive' },
      },
      select: epiCatalogSelect,
      take: 10,
      orderBy: { name: 'asc' },
    });
    if (partial.length > 0) {
      return {
        found: true as const,
        item: mapEpiSearchItem(partial[0] as EpiCatalogSelect),
        items: partial.map((item) => mapEpiSearchItem(item as EpiCatalogSelect)),
        message:
          partial.length > 1
            ? `Encontrados ${partial.length} EPIs com CA semelhante.`
            : null,
      };
    }

    return {
      found: false as const,
      item: null,
      message:
        'Nenhum EPI do catalogo da Consultoria com este CA. Peca o cadastro/vinculo do item antes de entrar no estoque.',
    };
  }

  async listStockLocations(organizationId: string, servedClientId: string) {
    await this.requireClient(organizationId, servedClientId);
    const location = await this.ensureDefaultLocation(
      organizationId,
      servedClientId,
    );
    const locations = await this.prisma.stockLocation.findMany({
      where: { organizationId, servedClientId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return {
      defaultLocationId: location.id,
      locations,
    };
  }

  async listClientBalances(organizationId: string, servedClientId: string) {
    await this.requireClient(organizationId, servedClientId);
    const rows = await this.prisma.epiStockBalance.findMany({
      where: {
        organizationId,
        stockLocation: { servedClientId },
      },
      include: {
        epiItem: {
          select: {
            id: true,
            name: true,
            caNumber: true,
            caExpiresAt: true,
            usefulLifeValue: true,
            usefulLifeUnit: true,
            unitOfMeasure: true,
            category: true,
            isActive: true,
          },
        },
        stockLocation: {
          select: { id: true, name: true, isActive: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      epiItemId: row.epiItemId,
      stockLocationId: row.stockLocationId,
      quantity: row.quantity,
      minQuantity: row.minQuantity,
      locationName: row.stockLocation.name,
      epiName: row.epiItem.name,
      caNumber: row.epiItem.caNumber,
      caExpiresAt: row.epiItem.caExpiresAt?.toISOString() ?? null,
      usefulLifeValue: row.epiItem.usefulLifeValue,
      usefulLifeUnit: row.epiItem.usefulLifeUnit,
      usefulLifeLabel: formatUsefulLife(
        row.epiItem.usefulLifeValue,
        row.epiItem.usefulLifeUnit,
      ),
      unitOfMeasure: row.epiItem.unitOfMeasure,
      category: row.epiItem.category,
    }));
  }

  async createEntradas(
    organizationId: string,
    servedClientId: string,
    userId: string,
    dto: PortalStockEntradasDto,
  ) {
    await this.requireClient(organizationId, servedClientId);
    if (!userId) {
      throw new BadRequestException(
        'Usuario do portal sem vinculo para registrar movimentacao.',
      );
    }

    const location = await this.ensureDefaultLocation(
      organizationId,
      servedClientId,
    );

    const results = [];
    for (const item of dto.items) {
      const result = await this.stock.createMovement(organizationId, userId, {
        type: EpiStockMovementType.ENTRADA,
        stockLocationId: location.id,
        epiItemId: item.epiItemId,
        quantity: item.quantity,
        notes: 'Entrada pelo Painel do Cliente',
      });
      results.push({
        epiItemId: item.epiItemId,
        quantity: item.quantity,
        newQuantity: result.movement.newQuantity,
        movementId: result.movement.id,
      });
    }

    return {
      locationId: location.id,
      created: results.length,
      items: results,
    };
  }

  private async ensureDefaultLocation(
    organizationId: string,
    servedClientId: string,
  ) {
    const existing = await this.prisma.stockLocation.findFirst({
      where: { organizationId, servedClientId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    return this.prisma.stockLocation.create({
      data: {
        organizationId,
        servedClientId,
        name: DEFAULT_LOCATION_NAME,
        description: 'Local padrao do estoque operacional da empresa.',
      },
    });
  }

  private async buildNeedsWithItems(
    organizationId: string,
    servedClientId: string,
  ) {
    const requirements = await this.prisma.jobFunctionEpiRequirement.findMany({
      where: {
        organizationId,
        isActive: true,
        jobFunction: { servedClientId, isActive: true },
      },
      include: {
        epiNeed: {
          include: {
            itemLinks: {
              include: {
                epiItem: {
                  select: {
                    id: true,
                    name: true,
                    caNumber: true,
                    caExpiresAt: true,
                    usefulLifeValue: true,
                    usefulLifeUnit: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
        jobFunction: { select: { id: true, name: true } },
      },
    });

    const byNeed = new Map<
      string,
      {
        needId: string;
        needName: string;
        jobNames: string[];
        suggestedQuantity: number;
        items: Array<{
          id: string;
          name: string;
          caNumber: string | null;
          caExpiresAt: string | null;
          usefulLifeValue: number | null;
          usefulLifeUnit: string | null;
          usefulLifeLabel: string | null;
        }>;
      }
    >();

    for (const req of requirements) {
      const need = req.epiNeed;
      let entry = byNeed.get(need.id);
      if (!entry) {
        entry = {
          needId: need.id,
          needName: need.name,
          jobNames: [],
          suggestedQuantity: 0,
          items: [],
        };
        byNeed.set(need.id, entry);
      }
      if (!entry.jobNames.includes(req.jobFunction.name)) {
        entry.jobNames.push(req.jobFunction.name);
      }
      entry.suggestedQuantity = Math.max(
        entry.suggestedQuantity,
        Math.max(1, req.quantity || 1),
      );
      for (const link of need.itemLinks) {
        if (!link.epiItem.isActive) continue;
        if (entry.items.some((i) => i.id === link.epiItem.id)) continue;
        entry.items.push({
          id: link.epiItem.id,
          name: link.epiItem.name,
          caNumber: link.epiItem.caNumber,
          caExpiresAt: link.epiItem.caExpiresAt?.toISOString() ?? null,
          usefulLifeValue: link.epiItem.usefulLifeValue,
          usefulLifeUnit: link.epiItem.usefulLifeUnit,
          usefulLifeLabel: formatUsefulLife(
            link.epiItem.usefulLifeValue,
            link.epiItem.usefulLifeUnit,
          ),
        });
      }
    }

    const catalog = await this.prisma.epiItem.findMany({
      where: { organizationId, isActive: true },
      select: epiCatalogSelect,
      take: 500,
    });

    return Array.from(byNeed.values())
      .map((n) => {
        const items = n.items.sort((a, b) =>
          a.name.localeCompare(b.name, 'pt-BR'),
        );
        let suggestedItems: typeof items = [];
        if (items.length === 0) {
          const needKey = stripDiacritics(n.needName);
          const tokens = needKey
            .split(/\s+/)
            .filter((t) => t.length >= 3)
            .flatMap((t) => (t.endsWith('s') && t.length > 3 ? [t, t.slice(0, -1)] : [t]));
          suggestedItems = catalog
            .filter((item) => {
              const nameKey = stripDiacritics(item.name);
              if (nameKey.includes(needKey) || needKey.includes(nameKey)) {
                return true;
              }
              return tokens.some(
                (token) =>
                  nameKey.includes(token) ||
                  (token.length >= 4 && nameKey.includes(token.slice(0, 4))),
              );
            })
            .slice(0, 5)
            .map((item) => ({
              id: item.id,
              name: item.name,
              caNumber: item.caNumber,
              caExpiresAt: item.caExpiresAt?.toISOString() ?? null,
              usefulLifeValue: item.usefulLifeValue,
              usefulLifeUnit: item.usefulLifeUnit,
              usefulLifeLabel: formatUsefulLife(
                item.usefulLifeValue,
                item.usefulLifeUnit,
              ),
            }));
        }
        return {
          ...n,
          jobNames: n.jobNames.sort((a, b) => a.localeCompare(b, 'pt-BR')),
          items,
          suggestedItems,
          hasLinkedEpi: items.length > 0,
          hasCatalogSuggestions: suggestedItems.length > 0,
        };
      })
      .sort((a, b) => a.needName.localeCompare(b.needName, 'pt-BR'));
  }

  private async countUniqueNeeds(
    organizationId: string,
    servedClientId: string,
  ) {
    const rows = await this.prisma.jobFunctionEpiRequirement.findMany({
      where: {
        organizationId,
        isActive: true,
        jobFunction: { servedClientId, isActive: true },
      },
      select: { epiNeedId: true },
      distinct: ['epiNeedId'],
    });
    return rows.length;
  }

  private async buildValidityItems(
    organizationId: string,
    servedClientId: string,
  ) {
    const requirements = await this.prisma.jobFunctionEpiRequirement.findMany({
      where: {
        organizationId,
        isActive: true,
        jobFunction: { servedClientId, isActive: true },
      },
      include: {
        jobFunction: { select: { id: true, name: true } },
        epiNeed: {
          include: {
            itemLinks: {
              include: {
                epiItem: {
                  select: {
                    id: true,
                    name: true,
                    caNumber: true,
                    caExpiresAt: true,
                    requiresCa: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    type Row = {
      epiItemId: string;
      epiName: string;
      caNumber: string | null;
      caExpiresAt: string | null;
      requiresCa: boolean;
      bucket: ValidityBucket;
      daysRemaining: number | null;
      needNames: string[];
      jobNames: string[];
    };

    const map = new Map<string, Row>();
    const now = Date.now();
    const soonMs = VALIDITY_SOON_DAYS * 24 * 60 * 60 * 1000;

    for (const req of requirements) {
      const links = req.epiNeed.itemLinks.filter((l) => l.epiItem.isActive);
      if (links.length === 0) {
        const key = `need:${req.epiNeedId}`;
        const existing = map.get(key);
        if (existing) {
          if (!existing.needNames.includes(req.epiNeed.name)) {
            existing.needNames.push(req.epiNeed.name);
          }
          if (!existing.jobNames.includes(req.jobFunction.name)) {
            existing.jobNames.push(req.jobFunction.name);
          }
        } else {
          map.set(key, {
            epiItemId: key,
            epiName: req.epiNeed.name,
            caNumber: null,
            caExpiresAt: null,
            requiresCa: true,
            bucket: 'missing',
            daysRemaining: null,
            needNames: [req.epiNeed.name],
            jobNames: [req.jobFunction.name],
          });
        }
        continue;
      }

      for (const link of links) {
        const item = link.epiItem;
        const existing = map.get(item.id);
        if (existing) {
          if (!existing.needNames.includes(req.epiNeed.name)) {
            existing.needNames.push(req.epiNeed.name);
          }
          if (!existing.jobNames.includes(req.jobFunction.name)) {
            existing.jobNames.push(req.jobFunction.name);
          }
          continue;
        }

        let bucket: ValidityBucket = 'ok';
        let daysRemaining: number | null = null;
        if (item.requiresCa && !item.caNumber) {
          bucket = 'missing';
        } else if (item.caExpiresAt) {
          const expires = item.caExpiresAt.getTime();
          daysRemaining = Math.ceil((expires - now) / (24 * 60 * 60 * 1000));
          if (expires < now) bucket = 'expired';
          else if (expires - now <= soonMs) bucket = 'soon';
          else bucket = 'ok';
        } else if (item.requiresCa) {
          bucket = 'missing';
        }

        map.set(item.id, {
          epiItemId: item.id,
          epiName: item.name,
          caNumber: item.caNumber,
          caExpiresAt: item.caExpiresAt?.toISOString() ?? null,
          requiresCa: item.requiresCa,
          bucket,
          daysRemaining,
          needNames: [req.epiNeed.name],
          jobNames: [req.jobFunction.name],
        });
      }
    }

    const order: Record<ValidityBucket, number> = {
      expired: 0,
      soon: 1,
      missing: 2,
      ok: 3,
    };

    return Array.from(map.values()).sort((a, b) => {
      const byBucket = order[a.bucket] - order[b.bucket];
      if (byBucket !== 0) return byBucket;
      return a.epiName.localeCompare(b.epiName, 'pt-BR');
    });
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
