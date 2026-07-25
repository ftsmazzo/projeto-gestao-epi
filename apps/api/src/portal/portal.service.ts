import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryEvidenceType,
  DeliveryEvidenceVerificationStatus,
  EpiDeliveryItemStatus,
  EpiDeliveryReturnCondition,
  EpiDeliveryStatus,
  EpiStockMovementType,
  EpiUsefulLifeUnit,
  Prisma,
  WorkerStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import { AuditService } from '../audit/audit.service';
import { normalizeCaNumber } from '../caepi/caepi-import.utils';
import { CaepiService } from '../caepi/caepi.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import {
  FACIAL_EVIDENCE_CONSENT_TEXT,
  FACIAL_EVIDENCE_CONSENT_VERSION,
  type PortalCancelDeliveryDto,
  type PortalCreateDeliveryPayloadDto,
  type PortalCreateReturnDto,
} from './dto/portal-delivery.dto';
import type { PortalStockEntradasDto } from './dto/portal-stock.dto';
import {
  resolveEvidenceAbsolutePath,
  saveFacialEvidenceFile,
} from './facial-evidence.storage';
import {
  groupCoverageRequirementsByNeed,
  resolveRestrictiveReplacementDays,
} from './portal-epi-coverage.utils';

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
    private readonly audit: AuditService,
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
      note: 'As necessidades desta empresa (PGRO/estrutura) sao a base. Informe o CA de cada uma para entrar no estoque — o sistema vincula ao catalogo automaticamente.',
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
        'Informe ao menos 3 caracteres para buscar.',
      );
    }

    const needle = stripDiacritics(query);
    const caNeedle = normalizeCaNumber(query);
    const byId = new Map<
      string,
      ReturnType<typeof mapEpiSearchItem> & {
        epiNeedId?: string;
        needName?: string;
        requiresCa?: boolean;
      }
    >();

    // 1) Necessidades do catalogo tecnico (o que o PGRO/Consultoria alimenta)
    const needs = await this.prisma.epiNeed.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        itemLinks: {
          select: {
            epiItem: { select: { ...epiCatalogSelect, isActive: true } },
          },
        },
      },
      take: 300,
    });

    for (const need of needs) {
      if (!stripDiacritics(need.name).includes(needle)) continue;
      const activeLinks = need.itemLinks.filter((l) => l.epiItem?.isActive);
      if (activeLinks.length > 0) {
        for (const link of activeLinks) {
          const mapped = mapEpiSearchItem(link.epiItem as EpiCatalogSelect);
          byId.set(mapped.id, {
            ...mapped,
            epiNeedId: need.id,
            needName: need.name,
          });
        }
      } else {
        // Necessidade sem EPI real ainda — usuario informa o CA na entrada
        byId.set(`need:${need.id}`, {
          id: `need:${need.id}`,
          name: need.name,
          caNumber: null,
          caExpiresAt: null,
          usefulLifeValue: null,
          usefulLifeUnit: null,
          usefulLifeLabel: null,
          unitOfMeasure: 'UNIDADE',
          category: null,
          epiNeedId: need.id,
          needName: need.name,
          requiresCa: true,
        });
      }
    }

    // 2) EPIs reais do catalogo
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
        if (!byId.has(item.id)) {
          byId.set(item.id, mapEpiSearchItem(item));
        }
      }
    }

    // 3) CAEPI → cruza com itens existentes pelo CA
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
            if (!byId.has(item.id)) {
              byId.set(item.id, mapEpiSearchItem(item as EpiCatalogSelect));
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return Array.from(byId.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 25);
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

  /** Busca na base CAEPI local — mesmo comportamento do catalogo mestre. */
  async searchCaepiBase(q: string, limit = 12) {
    const result = await this.caepi.searchCertificates(q, limit);
    return {
      query: result.query,
      baseCertificateCount: result.baseCertificateCount,
      baseIncomplete: result.baseIncomplete,
      message: result.message,
      items: result.items.map((item) => ({
        caNumber: item.caNumber,
        status: item.status,
        expiresAt:
          item.expiresAt instanceof Date
            ? item.expiresAt.toISOString()
            : item.expiresAt
              ? String(item.expiresAt)
              : null,
        equipmentName: item.equipmentName,
        manufacturerName: item.manufacturerName,
        reference: item.reference,
        color: item.color,
        sourceImportedAt:
          item.sourceImportedAt instanceof Date
            ? item.sourceImportedAt.toISOString()
            : item.sourceImportedAt
              ? String(item.sourceImportedAt)
              : null,
      })),
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
      const resolved = await this.resolveEpiItemForEntrada(
        organizationId,
        item,
      );
      const result = await this.stock.createMovement(organizationId, userId, {
        type: EpiStockMovementType.ENTRADA,
        stockLocationId: location.id,
        epiItemId: resolved.epiItemId,
        quantity: item.quantity,
        notes: item.epiNeedId
          ? `Entrada portal (necessidade ${item.epiNeedId})`
          : 'Entrada pelo Painel do Cliente',
      });
      results.push({
        epiItemId: resolved.epiItemId,
        epiNeedId: item.epiNeedId ?? null,
        quantity: item.quantity,
        newQuantity: result.movement.newQuantity,
        movementId: result.movement.id,
        createdEpiItem: resolved.created,
      });
    }

    return {
      locationId: location.id,
      created: results.length,
      items: results,
    };
  }

  /**
   * Resolve EPI real a partir de itemId, CA e/ou necessidade.
   * PGRO cria necessidades (EpiNeed); o estoque precisa de EpiItem (CA).
   * Se so houver necessidade + CA, cria/vincula o item automaticamente.
   */
  private async resolveEpiItemForEntrada(
    organizationId: string,
    input: {
      epiItemId?: string;
      epiNeedId?: string;
      caNumber?: string;
    },
  ): Promise<{ epiItemId: string; created: boolean }> {
    const caNumber = input.caNumber
      ? normalizeCaNumber(input.caNumber)
      : null;

    if (input.epiItemId) {
      const existing = await this.prisma.epiItem.findFirst({
        where: { id: input.epiItemId, organizationId, isActive: true },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundException('EPI informado nao existe no catalogo.');
      }
      if (input.epiNeedId) {
        await this.ensureNeedItemLink(
          organizationId,
          input.epiNeedId,
          existing.id,
        );
      }
      return { epiItemId: existing.id, created: false };
    }

    if (input.epiNeedId && !caNumber) {
      const links = await this.prisma.epiItemNeed.findMany({
        where: {
          organizationId,
          epiNeedId: input.epiNeedId,
          epiItem: { isActive: true },
        },
        select: { epiItemId: true },
        take: 2,
      });
      if (links.length === 1) {
        return { epiItemId: links[0].epiItemId, created: false };
      }
      if (links.length > 1) {
        throw new BadRequestException(
          'Necessidade com varios EPIs vinculados. Informe o CA ou o item.',
        );
      }
      throw new BadRequestException(
        'Necessidade sem EPI com CA. Informe o numero do CA para incluir no estoque.',
      );
    }

    if (!caNumber) {
      throw new BadRequestException(
        'Informe o EPI, a necessidade com CA, ou o numero do CA.',
      );
    }

    const byCa = await this.prisma.epiItem.findFirst({
      where: {
        organizationId,
        isActive: true,
        caNumber: { equals: caNumber, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (byCa) {
      if (input.epiNeedId) {
        await this.ensureNeedItemLink(
          organizationId,
          input.epiNeedId,
          byCa.id,
        );
      }
      return { epiItemId: byCa.id, created: false };
    }

    const caepi = await this.caepi.findByCaNumber(caNumber);
    if (!caepi.found || !caepi.certificate) {
      throw new BadRequestException(
        caepi.message ??
          `CA ${caNumber} nao encontrado na base CAEPI. Atualize a base na Consultoria.`,
      );
    }

    const cert = caepi.certificate;
    const name =
      cert.equipmentName?.trim() ||
      (input.epiNeedId
        ? (
            await this.prisma.epiNeed.findFirst({
              where: { id: input.epiNeedId, organizationId },
              select: { name: true },
            })
          )?.name
        : null) ||
      `EPI CA ${caNumber}`;

    const created = await this.prisma.epiItem.create({
      data: {
        organizationId,
        name,
        caNumber,
        caExpiresAt: cert.expiresAt,
        requiresCa: true,
        manufacturerName: cert.manufacturerName,
        reference: cert.reference,
        color: cert.color,
        approvedFor: cert.approvedFor,
        restriction: cert.restriction,
        technicalNotes: cert.analysisNotes,
        description: cert.equipmentDescription,
      },
      select: { id: true },
    });

    if (input.epiNeedId) {
      await this.ensureNeedItemLink(
        organizationId,
        input.epiNeedId,
        created.id,
      );
    }

    return { epiItemId: created.id, created: true };
  }

  private async ensureNeedItemLink(
    organizationId: string,
    epiNeedId: string,
    epiItemId: string,
  ) {
    const need = await this.prisma.epiNeed.findFirst({
      where: { id: epiNeedId, organizationId },
      select: { id: true },
    });
    if (!need) {
      throw new NotFoundException('Necessidade nao encontrada.');
    }
    const existing = await this.prisma.epiItemNeed.findFirst({
      where: { organizationId, epiNeedId, epiItemId },
    });
    if (existing) return existing;
    return this.prisma.epiItemNeed.create({
      data: {
        organizationId,
        epiNeedId,
        epiItemId,
        isPrimary: true,
      },
    });
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

  private maskCpf(cpf: string | null | undefined): string | null {
    if (!cpf) return null;
    const digits = cpf.replace(/\D/g, '');
    if (digits.length < 2) return '***.***.***-**';
    return `***.***.***-${digits.slice(-2)}`;
  }

  private formatReplacementInterval(days: number | null | undefined) {
    if (days == null || days <= 0) return null;
    if (days % 365 === 0) {
      const years = days / 365;
      return years === 1 ? '1 ano' : `${years} anos`;
    }
    if (days % 30 === 0) {
      const months = days / 30;
      return months === 1 ? '1 mes' : `${months} meses`;
    }
    return days === 1 ? '1 dia' : `${days} dias`;
  }

  /** Lista trabalhadores ativos para preparacao de entrega (somente leitura). */
  async getEntregasPreparacao(
    organizationId: string,
    servedClientId: string,
  ) {
    await this.requireClient(organizationId, servedClientId);

    const [workers, units, sectors, jobs] = await Promise.all([
      this.prisma.worker.findMany({
        where: {
          organizationId,
          servedClientId,
          status: WorkerStatus.ACTIVE,
        },
        orderBy: { name: 'asc' },
        include: {
          operationalUnit: { select: { id: true, name: true } },
          clientSector: { select: { id: true, name: true } },
          clientJobFunction: {
            select: {
              id: true,
              name: true,
              epiRequirements: {
                where: { isActive: true },
                select: { epiNeedId: true },
              },
            },
          },
        },
      }),
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
    ]);

    const mapped = workers.map((w) => {
      const needIds = new Set(
        (w.clientJobFunction?.epiRequirements ?? []).map((r) => r.epiNeedId),
      );
      return {
        id: w.id,
        name: w.name,
        registration: w.registration,
        cpfMasked: this.maskCpf(w.cpf),
        unitId: w.operationalUnitId,
        unitName: w.operationalUnit?.name ?? null,
        sectorId: w.clientSectorId,
        sectorName: w.clientSector?.name ?? w.department ?? null,
        jobFunctionId: w.clientJobFunctionId,
        jobFunctionName: w.clientJobFunction?.name ?? w.role ?? null,
        hasJobFunction: Boolean(w.clientJobFunctionId),
        requiredEpiCount: needIds.size,
      };
    });

    return {
      workers: mapped,
      filters: {
        units,
        sectors,
        jobs,
      },
      summary: {
        activeWorkers: mapped.length,
        withJobFunction: mapped.filter((w) => w.hasJobFunction).length,
        withoutJobFunction: mapped.filter((w) => !w.hasJobFunction).length,
      },
    };
  }

  /** Cobertura de EPIs necessarios do trabalhador (sem criar entrega). */
  async getWorkerEpiCoverage(
    organizationId: string,
    servedClientId: string,
    workerId: string,
  ) {
    await this.requireClient(organizationId, servedClientId);

    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, organizationId, servedClientId },
      include: {
        operationalUnit: { select: { id: true, name: true } },
        clientSector: { select: { id: true, name: true } },
        clientJobFunction: { select: { id: true, name: true } },
      },
    });
    if (!worker) {
      throw new NotFoundException('Trabalhador nao encontrado neste cliente.');
    }

    const workerDto = {
      id: worker.id,
      name: worker.name,
      registration: worker.registration,
      cpfMasked: this.maskCpf(worker.cpf),
      unitId: worker.operationalUnitId,
      unitName: worker.operationalUnit?.name ?? null,
      sectorId: worker.clientSectorId,
      sectorName: worker.clientSector?.name ?? worker.department ?? null,
      jobFunctionId: worker.clientJobFunctionId,
      jobFunctionName: worker.clientJobFunction?.name ?? worker.role ?? null,
    };

    if (!worker.clientJobFunctionId) {
      return {
        worker: workerDto,
        summary: {
          totalNeeds: 0,
          disponivel: 0,
          semEstoque: 0,
          semEpiReal: 0,
          status: 'SEM_REQUISITO' as const,
          message:
            'Trabalhador sem funcao estruturada. A Consultoria precisa ajustar o cadastro.',
        },
        needs: [],
      };
    }

    const requirements = await this.prisma.jobFunctionEpiRequirement.findMany({
      where: {
        organizationId,
        jobFunctionId: worker.clientJobFunctionId,
        isActive: true,
      },
      include: {
        epiNeed: {
          select: {
            id: true,
            name: true,
            isActive: true,
            itemLinks: {
              select: {
                isPrimary: true,
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
        risk: { select: { id: true, name: true } },
      },
      orderBy: [{ isRequired: 'desc' }, { createdAt: 'asc' }],
    });

    if (requirements.length === 0) {
      return {
        worker: workerDto,
        summary: {
          totalNeeds: 0,
          disponivel: 0,
          semEstoque: 0,
          semEpiReal: 0,
          status: 'SEM_REQUISITO' as const,
          message: 'Nenhum EPI necessario configurado para esta funcao.',
        },
        needs: [],
      };
    }

    const epiItemIds = new Set<string>();
    for (const req of requirements) {
      for (const link of req.epiNeed.itemLinks) {
        if (link.epiItem?.isActive) epiItemIds.add(link.epiItem.id);
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
            include: {
              stockLocation: { select: { id: true, name: true } },
            },
          });

    const balancesByEpi = new Map<
      string,
      Array<{
        stockLocationId: string;
        locationName: string;
        quantity: number;
      }>
    >();
    for (const row of balances) {
      const list = balancesByEpi.get(row.epiItemId) ?? [];
      list.push({
        stockLocationId: row.stockLocationId,
        locationName: row.stockLocation.name,
        quantity: row.quantity,
      });
      balancesByEpi.set(row.epiItemId, list);
    }

    const grouped = groupCoverageRequirementsByNeed(
      requirements.map((req) => ({
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

    // Links de EPI real: uma vez por necessidade (nao por requisito/risco).
    const linksByNeed = new Map<string, (typeof requirements)[0]['epiNeed']>();
    for (const req of requirements) {
      if (!linksByNeed.has(req.epiNeedId)) {
        linksByNeed.set(req.epiNeedId, req.epiNeed);
      }
    }

    const needs = grouped.map((group) => {
      const epiNeed = linksByNeed.get(group.epiNeedId)!;
      const linkedEpis = epiNeed.itemLinks
        .filter((link) => link.epiItem?.isActive)
        .map((link) => {
          const item = link.epiItem!;
          const itemBalances = balancesByEpi.get(item.id) ?? [];
          const totalQuantity = itemBalances.reduce(
            (sum, b) => sum + b.quantity,
            0,
          );
          return {
            epiItemId: item.id,
            name: item.name,
            caNumber: item.caNumber,
            caExpiresAt: item.caExpiresAt?.toISOString() ?? null,
            usefulLifeLabel: formatUsefulLife(
              item.usefulLifeValue,
              item.usefulLifeUnit,
            ),
            totalQuantity,
            balances: itemBalances,
            isPrimary: link.isPrimary,
          };
        })
        .sort((a, b) => {
          if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
          return b.totalQuantity - a.totalQuantity;
        });

      let status: 'DISPONIVEL' | 'SEM_ESTOQUE' | 'SEM_EPI_REAL_VINCULADO';
      let guidance: string | null = null;
      if (linkedEpis.length === 0) {
        status = 'SEM_EPI_REAL_VINCULADO';
        guidance =
          'Vincule um EPI real a esta necessidade no cadastro de EPIs/estoque.';
      } else if (linkedEpis.every((item) => item.totalQuantity <= 0)) {
        status = 'SEM_ESTOQUE';
        guidance = 'Registre entrada no estoque antes da entrega.';
      } else {
        status = 'DISPONIVEL';
        guidance = null;
      }

      const suggested =
        linkedEpis.find((item) => item.totalQuantity > 0) ??
        linkedEpis[0] ??
        null;

      const availableStock = linkedEpis.reduce(
        (sum, item) => sum + item.totalQuantity,
        0,
      );

      return {
        requirementId: group.requirementId,
        requirementIds: group.requirementIds,
        epiNeedId: group.epiNeedId,
        needName: group.needName,
        epiNeedName: group.needName,
        riskId: group.riskId,
        riskName: group.riskName,
        risks: group.risks,
        isRequired: group.isRequired,
        quantity: group.quantity,
        replacementIntervalDays: group.replacementIntervalDays,
        replacementLabel: this.formatReplacementInterval(
          group.replacementIntervalDays,
        ),
        status,
        guidance,
        warnings: group.warnings,
        availableStock,
        linkedEpis: linkedEpis.map((item) => ({
          epiItemId: item.epiItemId,
          name: item.name,
          caNumber: item.caNumber,
          caExpiresAt: item.caExpiresAt,
          usefulLifeLabel: item.usefulLifeLabel,
          totalQuantity: item.totalQuantity,
          balances: item.balances,
        })),
        suggestedEpiItemId: suggested?.epiItemId ?? null,
      };
    });

    const disponivel = needs.filter((n) => n.status === 'DISPONIVEL').length;
    const semEstoque = needs.filter((n) => n.status === 'SEM_ESTOQUE').length;
    const semEpiReal = needs.filter(
      (n) => n.status === 'SEM_EPI_REAL_VINCULADO',
    ).length;

    let summaryStatus: 'OK' | 'ATENCAO' | 'BLOQUEADO' = 'OK';
    let message: string | null = null;
    if (semEpiReal > 0) {
      summaryStatus = 'BLOQUEADO';
      message = `${semEpiReal} necessidade(s) sem EPI real vinculado.`;
    } else if (semEstoque > 0) {
      summaryStatus = 'ATENCAO';
      message = `${semEstoque} necessidade(s) sem estoque disponivel.`;
    } else {
      message = 'Todas as necessidades tem EPI real com estoque.';
    }

    return {
      worker: workerDto,
      summary: {
        totalNeeds: needs.length,
        disponivel,
        semEstoque,
        semEpiReal,
        status: summaryStatus,
        message,
      },
      needs,
    };
  }

  /** Historico de entregas do cliente (sem imagem facial). */
  async listDeliveries(
    organizationId: string,
    servedClientId: string,
    statusFilter?: string,
  ) {
    await this.requireClient(organizationId, servedClientId);

    const status =
      statusFilter &&
      Object.values(EpiDeliveryStatus).includes(
        statusFilter as EpiDeliveryStatus,
      )
        ? (statusFilter as EpiDeliveryStatus)
        : undefined;

    const rows = await this.prisma.epiDelivery.findMany({
      where: {
        organizationId,
        servedClientId,
        ...(status ? { status } : {}),
      },
      orderBy: { deliveredAt: 'desc' },
      take: 50,
      include: {
        worker: {
          select: { id: true, name: true, registration: true },
        },
        deliveredByUser: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            epiNeed: { select: { id: true, name: true } },
            epiItem: {
              select: { id: true, name: true, caNumber: true },
            },
            stockLocation: { select: { id: true, name: true } },
          },
        },
        evidences: {
          where: { type: DeliveryEvidenceType.FACIAL_CAPTURE },
          select: {
            id: true,
            type: true,
            capturedAt: true,
            verificationStatus: true,
          },
          take: 1,
        },
      },
    });

    return {
      deliveries: rows.map((row) => this.mapDeliverySummary(row)),
    };
  }

  async getDelivery(
    organizationId: string,
    servedClientId: string,
    deliveryId: string,
  ) {
    await this.requireClient(organizationId, servedClientId);

    const row = await this.prisma.epiDelivery.findFirst({
      where: {
        organizationId,
        servedClientId,
        OR: [{ id: deliveryId }, { receiptNumber: deliveryId }],
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            registration: true,
            cpf: true,
            operationalUnit: { select: { id: true, name: true } },
            clientSector: { select: { id: true, name: true } },
            clientJobFunction: { select: { id: true, name: true } },
            department: true,
            role: true,
          },
        },
        deliveredByUser: { select: { id: true, name: true, email: true } },
        cancelledByUser: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            epiNeed: { select: { id: true, name: true } },
            epiItem: {
              select: {
                id: true,
                name: true,
                caNumber: true,
                caExpiresAt: true,
              },
            },
            epiVariant: {
              select: {
                id: true,
                size: true,
                color: true,
                model: true,
              },
            },
            stockLocation: { select: { id: true, name: true } },
            stockMovement: {
              select: {
                id: true,
                type: true,
                quantity: true,
                previousQuantity: true,
                newQuantity: true,
              },
            },
          },
        },
        evidences: {
          where: { type: DeliveryEvidenceType.FACIAL_CAPTURE },
          select: {
            id: true,
            type: true,
            capturedAt: true,
            verificationStatus: true,
            mimeType: true,
            byteSize: true,
          },
        },
        returns: {
          orderBy: { returnedAt: 'desc' },
          include: {
            returnedByUser: { select: { id: true, name: true, email: true } },
            items: {
              include: {
                deliveryItem: {
                  select: {
                    id: true,
                    epiNeed: { select: { name: true } },
                    epiItem: { select: { name: true } },
                  },
                },
                stockMovement: {
                  select: {
                    id: true,
                    type: true,
                    quantity: true,
                    newQuantity: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundException('Entrega nao encontrada.');
    }

    const facial = row.evidences[0] ?? null;

    return {
      id: row.id,
      receiptNumber: row.receiptNumber,
      status: row.status,
      statusLabel: this.deliveryStatusLabel(row.status),
      deliveredAt: row.deliveredAt.toISOString(),
      notes: row.notes,
      worker: {
        id: row.worker.id,
        name: row.worker.name,
        registration: row.worker.registration,
        cpfMasked: this.maskCpf(row.worker.cpf),
        unitId: row.worker.operationalUnit?.id ?? null,
        unitName: row.worker.operationalUnit?.name ?? null,
        sectorId: row.worker.clientSector?.id ?? null,
        sectorName:
          row.worker.clientSector?.name ?? row.worker.department ?? null,
        jobFunctionId: row.worker.clientJobFunction?.id ?? null,
        jobFunctionName:
          row.worker.clientJobFunction?.name ?? row.worker.role ?? null,
      },
      deliveredBy: {
        id: row.deliveredByUser.id,
        name: row.deliveredByUser.name,
        email: row.deliveredByUser.email,
      },
      cancellation: row.cancelledAt
        ? {
            cancelledAt: row.cancelledAt.toISOString(),
            reason: row.cancelReason,
            cancelledBy: row.cancelledByUser
              ? {
                  id: row.cancelledByUser.id,
                  name: row.cancelledByUser.name,
                  email: row.cancelledByUser.email,
                }
              : null,
          }
        : null,
      items: row.items.map((item) => {
        const availableQuantity = Math.max(
          0,
          item.quantity - item.returnedQuantity - item.cancelledQuantity,
        );
        return {
          id: item.id,
          epiNeedId: item.epiNeedId,
          needName: item.epiNeed.name,
          epiItemId: item.epiItemId,
          epiName: item.epiItem.name,
          caNumber: item.epiItem.caNumber,
          caExpiresAt: item.epiItem.caExpiresAt?.toISOString() ?? null,
          epiVariantId: item.epiVariantId,
          variantName: item.epiVariant
            ? [item.epiVariant.size, item.epiVariant.color, item.epiVariant.model]
                .filter(Boolean)
                .join(' / ') || null
            : null,
          stockLocationId: item.stockLocationId,
          locationName: item.stockLocation.name,
          quantity: item.quantity,
          returnedQuantity: item.returnedQuantity,
          cancelledQuantity: item.cancelledQuantity,
          availableQuantity,
          status: item.status,
          statusLabel: this.itemStatusLabel(item.status),
          nextReplacementAt: item.nextReplacementAt?.toISOString() ?? null,
          stockMovement: {
            id: item.stockMovement.id,
            type: item.stockMovement.type,
            quantity: item.stockMovement.quantity,
            previousQuantity: item.stockMovement.previousQuantity,
            newQuantity: item.stockMovement.newQuantity,
          },
        };
      }),
      returns: row.returns.map((ret) => ({
        id: ret.id,
        returnedAt: ret.returnedAt.toISOString(),
        reason: ret.reason,
        notes: ret.notes,
        returnedBy: {
          id: ret.returnedByUser.id,
          name: ret.returnedByUser.name,
          email: ret.returnedByUser.email,
        },
        items: ret.items.map((ri) => ({
          id: ri.id,
          deliveryItemId: ri.deliveryItemId,
          needName: ri.deliveryItem.epiNeed.name,
          epiName: ri.deliveryItem.epiItem.name,
          quantity: ri.quantity,
          condition: ri.condition,
          returnsToStock: ri.condition === EpiDeliveryReturnCondition.REUSABLE,
          stockMovementId: ri.stockMovementId,
          stockMovement: ri.stockMovement
            ? {
                id: ri.stockMovement.id,
                type: ri.stockMovement.type,
                quantity: ri.stockMovement.quantity,
                newQuantity: ri.stockMovement.newQuantity,
              }
            : null,
        })),
      })),
      actions: {
        canCancel:
          row.status === EpiDeliveryStatus.COMPLETED ||
          row.status === EpiDeliveryStatus.PARTIALLY_RETURNED,
        canReturn:
          row.status === EpiDeliveryStatus.COMPLETED ||
          row.status === EpiDeliveryStatus.PARTIALLY_RETURNED,
      },
      evidence: facial
        ? {
            id: facial.id,
            type: facial.type,
            method: 'Facial capturada' as const,
            statusLabel: this.mapEvidenceStatusLabel(
              facial.verificationStatus,
            ),
            capturedAt: facial.capturedAt.toISOString(),
            verificationStatus: facial.verificationStatus,
            hasFile: true,
          }
        : null,
      consent: {
        accepted: Boolean(row.evidenceConsentAcceptedAt),
        acceptedAt: row.evidenceConsentAcceptedAt?.toISOString() ?? null,
        version: row.evidenceConsentVersion,
        text: row.evidenceConsentText,
      },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Cria entrega com baixa de estoque (ENTREGA) e evidencia facial obrigatoria.
   * Sem reconhecimento biometrico automatico nesta etapa.
   */
  async createDelivery(
    organizationId: string,
    servedClientId: string,
    userId: string,
    payload: PortalCreateDeliveryPayloadDto,
    facial: { buffer: Buffer; mimeType?: string; originalName?: string },
    requestMeta?: { operatorIp?: string | null; userAgent?: string | null },
  ) {
    const client = await this.requireClient(organizationId, servedClientId);
    if (client.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Cliente inativo. Nao e possivel registrar entregas.',
      );
    }

    if (payload.facialEvidenceConsentAccepted !== true) {
      throw new BadRequestException(
        'E necessario aceitar o aviso de registro da imagem facial como evidencia.',
      );
    }

    if (!facial?.buffer?.byteLength) {
      throw new BadRequestException(
        'Evidencia facial obrigatoria. Capture a foto antes de confirmar.',
      );
    }

    const mimeType = facial.mimeType?.trim() || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
      throw new BadRequestException(
        'Arquivo de evidencia facial deve ser uma imagem.',
      );
    }
    if (facial.buffer.byteLength > 5 * 1024 * 1024) {
      throw new BadRequestException(
        'Imagem facial excede o limite de 5 MB.',
      );
    }

    const worker = await this.prisma.worker.findFirst({
      where: {
        id: payload.workerId,
        organizationId,
        servedClientId,
      },
      select: {
        id: true,
        name: true,
        status: true,
        clientJobFunctionId: true,
      },
    });
    if (!worker) {
      throw new NotFoundException('Trabalhador nao encontrado neste cliente.');
    }
    if (worker.status !== WorkerStatus.ACTIVE) {
      throw new BadRequestException(
        'Somente trabalhadores ativos podem receber EPI.',
      );
    }
    if (!worker.clientJobFunctionId) {
      throw new BadRequestException(
        'Trabalhador sem funcao estruturada. Ajuste o cadastro na Consultoria.',
      );
    }

    const needIds = payload.items.map((item) => item.epiNeedId);
    if (new Set(needIds).size !== needIds.length) {
      throw new BadRequestException(
        'Nao e permitido repetir a mesma necessidade na entrega.',
      );
    }

    for (const item of payload.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException(
          'Quantidade de cada item deve ser um inteiro maior que zero.',
        );
      }
    }

    const requirements = await this.prisma.jobFunctionEpiRequirement.findMany({
      where: {
        organizationId,
        jobFunctionId: worker.clientJobFunctionId,
        isActive: true,
        epiNeedId: { in: needIds },
      },
      include: {
        epiNeed: {
          select: {
            id: true,
            name: true,
            itemLinks: {
              where: {
                epiItemId: { in: payload.items.map((i) => i.epiItemId) },
              },
              select: { epiItemId: true },
            },
          },
        },
      },
    });

    const reqByNeed = new Map(
      requirements.map((req) => [req.epiNeedId, req] as const),
    );
    const intervalsByNeed = new Map<string, Array<number | null>>();
    for (const req of requirements) {
      const list = intervalsByNeed.get(req.epiNeedId) ?? [];
      list.push(req.replacementIntervalDays);
      intervalsByNeed.set(req.epiNeedId, list);
    }

    const locationIds = [
      ...new Set(payload.items.map((i) => i.stockLocationId)),
    ];
    const locations = await this.prisma.stockLocation.findMany({
      where: {
        id: { in: locationIds },
        organizationId,
        servedClientId,
        isActive: true,
      },
      select: { id: true, name: true },
    });
    const locationSet = new Set(locations.map((l) => l.id));

    const epiIds = [...new Set(payload.items.map((i) => i.epiItemId))];
    const epis = await this.prisma.epiItem.findMany({
      where: { id: { in: epiIds }, organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        usefulLifeValue: true,
        usefulLifeUnit: true,
      },
    });
    const epiById = new Map(epis.map((e) => [e.id, e] as const));

    for (const item of payload.items) {
      const req = reqByNeed.get(item.epiNeedId);
      if (!req) {
        throw new BadRequestException(
          'Necessidade nao pertence a funcao do trabalhador (entrega avulsa nao permitida nesta etapa).',
        );
      }
      if (!locationSet.has(item.stockLocationId)) {
        throw new BadRequestException(
          'Local de estoque invalido ou nao pertence a este cliente.',
        );
      }
      const epi = epiById.get(item.epiItemId);
      if (!epi) {
        throw new BadRequestException('EPI real invalido ou inativo.');
      }
      const linked = req.epiNeed.itemLinks.some(
        (link) => link.epiItemId === item.epiItemId,
      );
      if (!linked) {
        const anyLink = await this.prisma.epiItemNeed.findFirst({
          where: {
            organizationId,
            epiNeedId: item.epiNeedId,
            epiItemId: item.epiItemId,
          },
          select: { id: true },
        });
        if (!anyLink) {
          throw new BadRequestException(
            `EPI "${epi.name}" nao esta vinculado a necessidade "${req.epiNeed.name}".`,
          );
        }
      }
    }

    const deliveredAt = new Date();
    const deliveryId = randomUUID().replace(/-/g, '').slice(0, 24);
    const operator = await this.prisma.user.findFirst({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (!operator) {
      throw new BadRequestException('Operador do portal nao encontrado.');
    }

    const consentAcceptedAt = new Date();
    const operatorIp = this.normalizeMetaText(requestMeta?.operatorIp, 64);
    const userAgent = this.normalizeMetaText(requestMeta?.userAgent, 400);

    let savedFile: Awaited<ReturnType<typeof saveFacialEvidenceFile>> | null =
      null;

    try {
      savedFile = await saveFacialEvidenceFile({
        organizationId,
        deliveryId,
        buffer: facial.buffer,
        mimeType,
      });

      const created = await this.prisma.$transaction(async (tx) => {
        const receiptNumber = await this.nextReceiptNumber(
          tx,
          servedClientId,
          deliveredAt,
        );

        const delivery = await tx.epiDelivery.create({
          data: {
            id: deliveryId,
            organizationId,
            servedClientId,
            workerId: worker.id,
            deliveredByUserId: userId,
            receiptNumber,
            status: EpiDeliveryStatus.COMPLETED,
            deliveredAt,
            notes: payload.notes?.trim() || null,
            evidenceConsentText: FACIAL_EVIDENCE_CONSENT_TEXT,
            evidenceConsentVersion: FACIAL_EVIDENCE_CONSENT_VERSION,
            evidenceConsentAcceptedAt: consentAcceptedAt,
            operatorIp,
            userAgent,
          },
        });

        const createdItems: Array<{
          id: string;
          epiNeedId: string;
          epiItemId: string;
          stockLocationId: string;
          quantity: number;
          stockMovementId: string;
          nextReplacementAt: Date | null;
        }> = [];

        for (const item of payload.items) {
          const req = reqByNeed.get(item.epiNeedId)!;
          const epi = epiById.get(item.epiItemId)!;
          const variantId = item.epiVariantId?.trim() || null;

          const movementResult = await this.stock.applyMovementInTx(
            tx,
            organizationId,
            userId,
            {
              type: EpiStockMovementType.ENTREGA,
              stockLocationId: item.stockLocationId,
              epiItemId: item.epiItemId,
              epiVariantId: variantId ?? undefined,
              quantity: item.quantity,
              reason: `Entrega de EPI — ${worker.name}`,
              notes: `receipt=${receiptNumber}; need=${req.epiNeed.name}`,
            },
          );

          const nextReplacementAt = this.computeNextReplacementAt(
            deliveredAt,
            resolveRestrictiveReplacementDays(
              intervalsByNeed.get(item.epiNeedId) ?? [],
            ),
            epi.usefulLifeValue,
            epi.usefulLifeUnit,
          );

          const deliveryItem = await tx.epiDeliveryItem.create({
            data: {
              deliveryId: delivery.id,
              epiNeedId: item.epiNeedId,
              epiItemId: item.epiItemId,
              epiVariantId: variantId,
              stockLocationId: item.stockLocationId,
              stockMovementId: movementResult.movement.id,
              quantity: item.quantity,
              returnedQuantity: 0,
              cancelledQuantity: 0,
              status: EpiDeliveryItemStatus.DELIVERED,
              nextReplacementAt,
            },
          });

          createdItems.push({
            id: deliveryItem.id,
            epiNeedId: deliveryItem.epiNeedId,
            epiItemId: deliveryItem.epiItemId,
            stockLocationId: deliveryItem.stockLocationId,
            quantity: deliveryItem.quantity,
            stockMovementId: deliveryItem.stockMovementId,
            nextReplacementAt: deliveryItem.nextReplacementAt,
          });
        }

        await tx.deliveryEvidence.create({
          data: {
            deliveryId: delivery.id,
            type: DeliveryEvidenceType.FACIAL_CAPTURE,
            capturedAt: deliveredAt,
            filePath: savedFile!.relativePath,
            fileHash: savedFile!.fileHash,
            mimeType: savedFile!.mimeType,
            byteSize: savedFile!.byteSize,
            verificationStatus: DeliveryEvidenceVerificationStatus.CAPTURED,
            metadata: {
              captureSource: 'portal_camera',
              consentVersion: FACIAL_EVIDENCE_CONSENT_VERSION,
              biometricMatch: false,
              note: 'Captura registrada como evidencia; sem verificacao biometrica automatica.',
            } as Prisma.InputJsonValue,
          },
        });

        return { delivery, createdItems };
      });

      await this.audit.log({
        action: 'portal.epi_delivery.created',
        organizationId,
        userId,
        entityType: 'EpiDelivery',
        entityId: created.delivery.id,
        metadata: {
          servedClientId,
          receiptNumber: created.delivery.receiptNumber,
          workerId: worker.id,
          itemCount: created.createdItems.length,
          stockMovementIds: created.createdItems.map((i) => i.stockMovementId),
          facialEvidence: true,
          consentVersion: FACIAL_EVIDENCE_CONSENT_VERSION,
          // Nao logar imagem, hash de arquivo ou caminhos.
        },
      });

      return this.getDelivery(
        organizationId,
        servedClientId,
        created.delivery.id,
      );
    } catch (err) {
      if (savedFile) {
        try {
          await unlink(savedFile.absolutePath);
        } catch {
          // ignora falha de limpeza
        }
      }
      throw err;
    }
  }

  /** Cancela entrega por erro operacional e reverte estoque restante. */
  async cancelDelivery(
    organizationId: string,
    servedClientId: string,
    userId: string,
    deliveryId: string,
    dto: PortalCancelDeliveryDto,
  ) {
    await this.requireClient(organizationId, servedClientId);
    const reason = dto.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('Informe o motivo do cancelamento.');
    }

    const delivery = await this.prisma.epiDelivery.findFirst({
      where: { id: deliveryId, organizationId, servedClientId },
      include: { items: true },
    });
    if (!delivery) {
      throw new NotFoundException('Entrega nao encontrada.');
    }
    if (delivery.status === EpiDeliveryStatus.CANCELLED) {
      throw new BadRequestException('Esta entrega ja esta cancelada.');
    }
    if (delivery.status === EpiDeliveryStatus.RETURNED) {
      throw new BadRequestException(
        'Entrega totalmente devolvida nao pode ser cancelada.',
      );
    }

    const cancelledAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const item of delivery.items) {
        const remaining =
          item.quantity - item.returnedQuantity - item.cancelledQuantity;
        if (remaining <= 0) continue;

        await this.stock.applyMovementInTx(tx, organizationId, userId, {
          type: EpiStockMovementType.CANCELAMENTO_ENTREGA,
          stockLocationId: item.stockLocationId,
          epiItemId: item.epiItemId,
          epiVariantId: item.epiVariantId ?? undefined,
          quantity: remaining,
          reason: `Cancelamento ${delivery.receiptNumber}: ${reason}`,
          notes: `deliveryItemId=${item.id}`,
        });

        const cancelledQuantity = item.cancelledQuantity + remaining;
        await tx.epiDeliveryItem.update({
          where: { id: item.id },
          data: {
            cancelledQuantity,
            status: this.deriveItemStatus(
              item.quantity,
              item.returnedQuantity,
              cancelledQuantity,
            ),
          },
        });
      }

      await tx.epiDelivery.update({
        where: { id: delivery.id },
        data: {
          status: EpiDeliveryStatus.CANCELLED,
          cancelledAt,
          cancelledByUserId: userId,
          cancelReason: reason,
        },
      });
    });

    await this.audit.log({
      action: 'portal.epi_delivery.cancelled',
      organizationId,
      userId,
      entityType: 'EpiDelivery',
      entityId: delivery.id,
      metadata: {
        servedClientId,
        receiptNumber: delivery.receiptNumber,
        reason,
      },
    });

    return this.getDelivery(organizationId, servedClientId, delivery.id);
  }

  /** Registra devolucao parcial/total de itens da entrega. */
  async createDeliveryReturn(
    organizationId: string,
    servedClientId: string,
    userId: string,
    deliveryId: string,
    dto: PortalCreateReturnDto,
  ) {
    await this.requireClient(organizationId, servedClientId);
    const reason = dto.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('Informe o motivo da devolucao.');
    }

    const delivery = await this.prisma.epiDelivery.findFirst({
      where: { id: deliveryId, organizationId, servedClientId },
      include: { items: true },
    });
    if (!delivery) {
      throw new NotFoundException('Entrega nao encontrada.');
    }
    if (
      delivery.status !== EpiDeliveryStatus.COMPLETED &&
      delivery.status !== EpiDeliveryStatus.PARTIALLY_RETURNED
    ) {
      throw new BadRequestException(
        'So e possivel devolver entregas concluidas ou parcialmente devolvidas.',
      );
    }

    const itemIds = dto.items.map((i) => i.deliveryItemId);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException(
        'Nao e permitido repetir o mesmo item na devolucao.',
      );
    }

    const itemsById = new Map(delivery.items.map((i) => [i.id, i] as const));

    for (const row of dto.items) {
      if (!Number.isInteger(row.quantity) || row.quantity <= 0) {
        throw new BadRequestException(
          'Quantidade devolvida deve ser inteiro maior que zero.',
        );
      }
      const item = itemsById.get(row.deliveryItemId);
      if (!item) {
        throw new BadRequestException(
          'Item nao pertence a esta entrega.',
        );
      }
      const available =
        item.quantity - item.returnedQuantity - item.cancelledQuantity;
      if (row.quantity > available) {
        throw new BadRequestException(
          `Quantidade devolvida excede o disponivel (${available}) para um dos itens.`,
        );
      }
    }

    const returnedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      const ret = await tx.epiDeliveryReturn.create({
        data: {
          organizationId,
          servedClientId,
          deliveryId: delivery.id,
          returnedByUserId: userId,
          returnedAt,
          reason,
          notes: dto.notes?.trim() || null,
        },
      });

      for (const row of dto.items) {
        const item = itemsById.get(row.deliveryItemId)!;
        let stockMovementId: string | null = null;

        if (row.condition === EpiDeliveryReturnCondition.REUSABLE) {
          const movement = await this.stock.applyMovementInTx(
            tx,
            organizationId,
            userId,
            {
              type: EpiStockMovementType.DEVOLUCAO,
              stockLocationId: item.stockLocationId,
              epiItemId: item.epiItemId,
              epiVariantId: item.epiVariantId ?? undefined,
              quantity: row.quantity,
              reason: `Devolucao ${delivery.receiptNumber}: ${reason}`,
              notes: `deliveryItemId=${item.id}; condition=REUSABLE`,
            },
          );
          stockMovementId = movement.movement.id;
        }

        await tx.epiDeliveryReturnItem.create({
          data: {
            returnId: ret.id,
            deliveryItemId: item.id,
            quantity: row.quantity,
            condition: row.condition,
            stockMovementId,
          },
        });

        const returnedQuantity = item.returnedQuantity + row.quantity;
        // Keep local map in sync for multi-line same delivery item not allowed,
        // but update for status derivation of delivery after loop.
        item.returnedQuantity = returnedQuantity;

        await tx.epiDeliveryItem.update({
          where: { id: item.id },
          data: {
            returnedQuantity,
            status: this.deriveItemStatus(
              item.quantity,
              returnedQuantity,
              item.cancelledQuantity,
            ),
          },
        });
      }

      const refreshed = await tx.epiDeliveryItem.findMany({
        where: { deliveryId: delivery.id },
        select: {
          quantity: true,
          returnedQuantity: true,
          cancelledQuantity: true,
        },
      });
      const nextStatus = this.deriveDeliveryStatusAfterReturn(refreshed);
      await tx.epiDelivery.update({
        where: { id: delivery.id },
        data: { status: nextStatus },
      });
    });

    await this.audit.log({
      action: 'portal.epi_delivery.returned',
      organizationId,
      userId,
      entityType: 'EpiDelivery',
      entityId: delivery.id,
      metadata: {
        servedClientId,
        receiptNumber: delivery.receiptNumber,
        reason,
        itemCount: dto.items.length,
        // Nao logar imagem/path.
      },
    });

    return this.getDelivery(organizationId, servedClientId, delivery.id);
  }

  /** Caminho absoluto da evidencia facial (uso autenticado; nao logar conteudo). */
  async getFacialEvidenceAbsolutePath(
    organizationId: string,
    servedClientId: string,
    deliveryId: string,
  ) {
    await this.requireClient(organizationId, servedClientId);

    const evidence = await this.prisma.deliveryEvidence.findFirst({
      where: {
        deliveryId,
        type: DeliveryEvidenceType.FACIAL_CAPTURE,
        delivery: { organizationId, servedClientId },
      },
      select: { filePath: true, mimeType: true },
    });
    if (!evidence) {
      throw new NotFoundException('Evidencia facial nao encontrada.');
    }

    return {
      absolutePath: resolveEvidenceAbsolutePath(evidence.filePath),
      mimeType: evidence.mimeType ?? 'image/jpeg',
    };
  }

  private deriveItemStatus(
    quantity: number,
    returnedQuantity: number,
    cancelledQuantity: number,
  ): EpiDeliveryItemStatus {
    if (cancelledQuantity >= quantity) return EpiDeliveryItemStatus.CANCELLED;
    if (returnedQuantity >= quantity) return EpiDeliveryItemStatus.RETURNED;
    if (returnedQuantity > 0 || cancelledQuantity > 0) {
      return EpiDeliveryItemStatus.PARTIALLY_RETURNED;
    }
    return EpiDeliveryItemStatus.DELIVERED;
  }

  private deriveDeliveryStatusAfterReturn(
    items: Array<{
      quantity: number;
      returnedQuantity: number;
      cancelledQuantity: number;
    }>,
  ): EpiDeliveryStatus {
    const allFullyReturned = items.every(
      (i) => i.returnedQuantity >= i.quantity,
    );
    if (allFullyReturned) return EpiDeliveryStatus.RETURNED;

    const anyReturned = items.some((i) => i.returnedQuantity > 0);
    if (anyReturned) return EpiDeliveryStatus.PARTIALLY_RETURNED;

    return EpiDeliveryStatus.COMPLETED;
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

  private itemStatusLabel(status: EpiDeliveryItemStatus): string {
    switch (status) {
      case EpiDeliveryItemStatus.CANCELLED:
        return 'Cancelado';
      case EpiDeliveryItemStatus.RETURNED:
        return 'Devolvido';
      case EpiDeliveryItemStatus.PARTIALLY_RETURNED:
        return 'Parcialmente devolvido';
      default:
        return 'Entregue';
    }
  }

  private mapEvidenceStatusLabel(
    status: DeliveryEvidenceVerificationStatus,
  ): 'FACIAL_CAPTURED' | 'NOT_VERIFIED' {
    if (status === DeliveryEvidenceVerificationStatus.NOT_VERIFIED) {
      return 'NOT_VERIFIED';
    }
    return 'FACIAL_CAPTURED';
  }

  private normalizeMetaText(
    value: string | null | undefined,
    maxLen: number,
  ): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLen);
  }

  private async nextReceiptNumber(
    tx: Prisma.TransactionClient,
    servedClientId: string,
    deliveredAt: Date,
  ) {
    const y = deliveredAt.getUTCFullYear();
    const m = String(deliveredAt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(deliveredAt.getUTCDate()).padStart(2, '0');
    const dayKey = `${y}${m}${d}`;
    const prefix = `ENT-${dayKey}-`;

    const last = await tx.epiDelivery.findFirst({
      where: {
        servedClientId,
        receiptNumber: { startsWith: prefix },
      },
      orderBy: { receiptNumber: 'desc' },
      select: { receiptNumber: true },
    });

    let seq = 1;
    if (last?.receiptNumber) {
      const tail = last.receiptNumber.slice(prefix.length);
      const parsed = Number.parseInt(tail, 10);
      if (Number.isFinite(parsed) && parsed >= 1) seq = parsed + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private computeNextReplacementAt(
    deliveredAt: Date,
    intervalDays: number | null | undefined,
    usefulLifeValue: number | null | undefined,
    usefulLifeUnit: EpiUsefulLifeUnit | null | undefined,
  ): Date | null {
    if (intervalDays != null && intervalDays > 0) {
      const next = new Date(deliveredAt);
      next.setUTCDate(next.getUTCDate() + intervalDays);
      return next;
    }
    if (usefulLifeValue != null && usefulLifeValue > 0 && usefulLifeUnit) {
      const next = new Date(deliveredAt);
      if (usefulLifeUnit === EpiUsefulLifeUnit.DIAS) {
        next.setUTCDate(next.getUTCDate() + usefulLifeValue);
      } else if (usefulLifeUnit === EpiUsefulLifeUnit.MESES) {
        next.setUTCMonth(next.getUTCMonth() + usefulLifeValue);
      } else if (usefulLifeUnit === EpiUsefulLifeUnit.ANOS) {
        next.setUTCFullYear(next.getUTCFullYear() + usefulLifeValue);
      }
      return next;
    }
    return null;
  }

  private mapDeliverySummary(row: {
    id: string;
    receiptNumber: string;
    status: EpiDeliveryStatus;
    deliveredAt: Date;
    notes: string | null;
    worker: { id: string; name: string; registration: string | null };
    deliveredByUser: { id: string; name: string; email: string };
    items: Array<{
      id: string;
      quantity: number;
      epiNeed: { id: string; name: string };
      epiItem: { id: string; name: string; caNumber: string | null };
      stockLocation: { id: string; name: string };
    }>;
    evidences: Array<{
      id: string;
      type: DeliveryEvidenceType;
      capturedAt: Date;
      verificationStatus: DeliveryEvidenceVerificationStatus;
    }>;
  }) {
    const facial = row.evidences[0] ?? null;
    return {
      id: row.id,
      receiptNumber: row.receiptNumber,
      status: row.status,
      statusLabel: this.deliveryStatusLabel(row.status),
      deliveredAt: row.deliveredAt.toISOString(),
      notes: row.notes,
      worker: {
        id: row.worker.id,
        name: row.worker.name,
        registration: row.worker.registration,
      },
      deliveredBy: {
        id: row.deliveredByUser.id,
        name: row.deliveredByUser.name,
        email: row.deliveredByUser.email,
      },
      itemCount: row.items.length,
      items: row.items.map((item) => ({
        id: item.id,
        needName: item.epiNeed.name,
        epiName: item.epiItem.name,
        caNumber: item.epiItem.caNumber,
        locationName: item.stockLocation.name,
        quantity: item.quantity,
      })),
      method: facial ? ('Facial capturada' as const) : ('Sem evidencia' as const),
      evidence: facial
        ? {
            id: facial.id,
            type: facial.type,
            statusLabel: this.mapEvidenceStatusLabel(
              facial.verificationStatus,
            ),
            capturedAt: facial.capturedAt.toISOString(),
            verificationStatus: facial.verificationStatus,
          }
        : null,
    };
  }
}
