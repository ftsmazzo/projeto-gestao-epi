import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const VALIDITY_SOON_DAYS = 90;

type ValidityBucket = 'expired' | 'soon' | 'ok' | 'missing';

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

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
        estoque: uniqueNeeds,
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
          mode: 'needs' as const,
          reason:
            'Exibe necessidades da empresa. Saldo fisico por cliente vem na proxima etapa.',
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
        items: Array<{
          id: string;
          name: string;
          caNumber: string | null;
          caExpiresAt: string | null;
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
          items: [],
        };
        byNeed.set(need.id, entry);
      }
      if (!entry.jobNames.includes(req.jobFunction.name)) {
        entry.jobNames.push(req.jobFunction.name);
      }
      for (const link of need.itemLinks) {
        if (!link.epiItem.isActive) continue;
        if (entry.items.some((i) => i.id === link.epiItem.id)) continue;
        entry.items.push({
          id: link.epiItem.id,
          name: link.epiItem.name,
          caNumber: link.epiItem.caNumber,
          caExpiresAt: link.epiItem.caExpiresAt?.toISOString() ?? null,
        });
      }
    }

    const needs = Array.from(byNeed.values())
      .map((n) => ({
        ...n,
        jobNames: n.jobNames.sort((a, b) => a.localeCompare(b, 'pt-BR')),
        items: n.items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        hasLinkedEpi: n.items.length > 0,
      }))
      .sort((a, b) => a.needName.localeCompare(b.needName, 'pt-BR'));

    return {
      mode: 'needs' as const,
      note: 'Saldo fisico por empresa ainda nao esta liberado. Aqui voce ve as necessidades desta empresa e os EPIs vinculados pela Consultoria.',
      summary: {
        needs: needs.length,
        withLinkedEpi: needs.filter((n) => n.hasLinkedEpi).length,
        withoutLinkedEpi: needs.filter((n) => !n.hasLinkedEpi).length,
      },
      needs,
    };
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
