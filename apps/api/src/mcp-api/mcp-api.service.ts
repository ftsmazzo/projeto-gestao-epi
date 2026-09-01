import { Injectable, NotFoundException } from '@nestjs/common';
import {
  SstDocumentStatus,
  WorkerStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ServedClientsService } from '../served-clients/served-clients.service';
import { CaepiService } from '../caepi/caepi.service';
import { isDeliverableEpiNeed } from '../epi-needs/epi-need-canonical';
import { formatCnpj, maskCpf } from './mcp-privacy';

@Injectable()
export class McpApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servedClients: ServedClientsService,
    private readonly caepi: CaepiService,
  ) {}

  async getContext(organizationId: string) {
    const [organization, quota] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, slug: true, status: true },
      }),
      this.servedClients.getQuotaSummary(organizationId),
    ]);
    if (!organization) throw new NotFoundException('Organizacao nao encontrada.');
    return {
      organization,
      quota,
      generatedAt: new Date().toISOString(),
    };
  }

  async listClients(organizationId: string) {
    const rows = await this.servedClients.list(organizationId);
    return rows.map((c) => ({
      id: c.id,
      legalName: c.legalName,
      tradeName: c.tradeName,
      cnpj: formatCnpj(c.cnpj),
      status: c.status,
      allocatedLifeQuota: c.allocatedLifeQuota,
      usedLives: c.usedLives,
      group: c.group,
    }));
  }

  async getClient(organizationId: string, clientId: string) {
    const client = await this.servedClients.getById(organizationId, clientId);
    const usedLives = await this.prisma.worker.count({
      where: {
        organizationId,
        servedClientId: clientId,
        status: WorkerStatus.ACTIVE,
      },
    });
    return {
      id: client.id,
      legalName: client.legalName,
      tradeName: client.tradeName,
      cnpj: formatCnpj(client.cnpj),
      status: client.status,
      allocatedLifeQuota: client.allocatedLifeQuota,
      usedLives,
    };
  }

  getClientOverview(organizationId: string, clientId: string) {
    return this.servedClients.getOverview(organizationId, clientId);
  }

  async listWorkers(
    organizationId: string,
    clientId: string,
    opts?: { status?: WorkerStatus; limit?: number },
  ) {
    await this.servedClients.getById(organizationId, clientId);
    const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
    const workers = await this.prisma.worker.findMany({
      where: {
        organizationId,
        servedClientId: clientId,
        ...(opts?.status ? { status: opts.status } : {}),
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      take: limit,
      select: {
        id: true,
        name: true,
        cpf: true,
        registration: true,
        status: true,
        role: true,
        admissionDate: true,
        operationalUnit: { select: { name: true } },
        clientSector: { select: { name: true } },
        clientJobFunction: { select: { name: true } },
        facialReferences: {
          where: { status: 'ACTIVE' },
          take: 1,
          select: { id: true },
        },
      },
    });
    return {
      total: workers.length,
      workers: workers.map((w) => ({
        id: w.id,
        name: w.name,
        cpfMasked: maskCpf(w.cpf),
        registration: w.registration,
        status: w.status,
        role: w.role,
        admissionDate: w.admissionDate,
        unit: w.operationalUnit?.name ?? null,
        sector: w.clientSector?.name ?? null,
        jobFunction: w.clientJobFunction?.name ?? null,
        hasFacialEnrollment: w.facialReferences.length > 0,
      })),
    };
  }

  async getClientStructure(organizationId: string, clientId: string) {
    await this.servedClients.getById(organizationId, clientId);
    const [sectors, jobs, units] = await Promise.all([
      this.prisma.clientSector.findMany({
        where: { organizationId, servedClientId: clientId, isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          _count: { select: { workers: true, jobFunctions: true } },
        },
      }),
      this.prisma.clientJobFunction.findMany({
        where: { organizationId, servedClientId: clientId, isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          sector: { select: { name: true } },
          _count: {
            select: {
              workers: true,
              risks: true,
              epiRequirements: { where: { isActive: true } },
            },
          },
        },
      }),
      this.prisma.operationalUnit.findMany({
        where: { organizationId, servedClientId: clientId, status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true, city: true, state: true },
      }),
    ]);
    return {
      units,
      sectors: sectors.map((s) => ({
        id: s.id,
        name: s.name,
        workers: s._count.workers,
        jobFunctions: s._count.jobFunctions,
      })),
      jobFunctions: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        sector: j.sector?.name ?? null,
        workers: j._count.workers,
        risks: j._count.risks,
        epiRequirements: j._count.epiRequirements,
      })),
    };
  }

  async search(organizationId: string, query: string, limit = 20) {
    const q = query.trim();
    if (q.length < 2) {
      return { clients: [], workers: [] };
    }
    const take = Math.min(Math.max(limit, 1), 50);
    const digits = q.replace(/\D/g, '');

    const [clients, workers] = await Promise.all([
      this.prisma.servedClient.findMany({
        where: {
          organizationId,
          OR: [
            { legalName: { contains: q, mode: 'insensitive' } },
            { tradeName: { contains: q, mode: 'insensitive' } },
            ...(digits.length >= 4 ? [{ cnpj: { contains: digits } }] : []),
          ],
        },
        take,
        orderBy: { legalName: 'asc' },
        select: {
          id: true,
          legalName: true,
          cnpj: true,
          status: true,
        },
      }),
      this.prisma.worker.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            ...(digits.length >= 4 ? [{ cpf: { contains: digits } }] : []),
          ],
        },
        take,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          cpf: true,
          status: true,
          servedClient: { select: { id: true, legalName: true } },
        },
      }),
    ]);

    return {
      clients: clients.map((c) => ({
        id: c.id,
        legalName: c.legalName,
        cnpj: formatCnpj(c.cnpj),
        status: c.status,
      })),
      workers: workers.map((w) => ({
        id: w.id,
        name: w.name,
        cpfMasked: maskCpf(w.cpf),
        status: w.status,
        clientId: w.servedClient.id,
        clientName: w.servedClient.legalName,
      })),
    };
  }

  async listEpiCatalog(organizationId: string) {
    const items = await this.prisma.epiItem.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        category: true,
        variants: {
          where: { isActive: true },
          select: { id: true, size: true, color: true, model: true },
        },
      },
    });
    return items;
  }

  async listEpiNeeds(organizationId: string) {
    const needs = await this.prisma.epiNeed.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, category: true },
    });
    return needs.filter((n) => isDeliverableEpiNeed(n.name));
  }

  findCaepi(caNumber: string) {
    return this.caepi.findByCaNumber(caNumber);
  }

  async listTrainingIssuances(
    organizationId: string,
    clientId?: string,
    limit = 30,
  ) {
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.trainingIssuance.findMany({
      where: {
        organizationId,
        ...(clientId ? { servedClientId: clientId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        controlNumber: true,
        heldOn: true,
        hours: true,
        createdAt: true,
        workerIds: true,
        template: { select: { courseTitle: true, nrLabel: true, name: true } },
        servedClient: { select: { id: true, legalName: true } },
      },
    });
    return rows.map((r) => {
      const workerIds = Array.isArray(r.workerIds) ? r.workerIds : [];
      return {
        id: r.id,
        controlNumber: r.controlNumber,
        courseTitle: r.template.courseTitle,
        nrLabel: r.template.nrLabel,
        templateName: r.template.name,
        heldOn: r.heldOn,
        hours: r.hours,
        createdAt: r.createdAt,
        clientId: r.servedClient.id,
        clientName: r.servedClient.legalName,
        workerCount: workerIds.length,
      };
    });
  }

  async listSstDocuments(
    organizationId: string,
    clientId?: string,
    status?: SstDocumentStatus,
    limit = 40,
  ) {
    const take = Math.min(Math.max(limit, 1), 100);
    const docs = await this.prisma.sstDocument.findMany({
      where: {
        organizationId,
        ...(clientId ? { servedClientId: clientId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take,
      select: {
        id: true,
        type: true,
        status: true,
        updatedAt: true,
        worker: { select: { id: true, name: true } },
        servedClient: { select: { id: true, legalName: true } },
      },
    });
    return docs.map((d) => ({
      id: d.id,
      type: d.type,
      status: d.status,
      updatedAt: d.updatedAt,
      workerId: d.worker.id,
      workerName: d.worker.name,
      clientId: d.servedClient.id,
      clientName: d.servedClient.legalName,
    }));
  }

  async listClientGroups(organizationId: string) {
    return this.prisma.clientGroup.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: {
        members: {
          include: {
            servedClient: {
              select: { id: true, legalName: true, cnpj: true, status: true },
            },
          },
        },
      },
    });
  }

  async getStockSummary(organizationId: string, clientId?: string) {
    const balances = await this.prisma.epiStockBalance.groupBy({
      by: ['stockLocationId'],
      where: {
        organizationId,
        quantity: { gt: 0 },
        stockLocation: clientId
          ? { servedClientId: clientId }
          : { servedClientId: null },
      },
      _sum: { quantity: true },
      _count: { _all: true },
    });
    const locations = await this.prisma.stockLocation.findMany({
      where: {
        organizationId,
        id: { in: balances.map((b) => b.stockLocationId) },
      },
      select: { id: true, name: true, servedClientId: true },
    });
    const locMap = new Map(locations.map((l) => [l.id, l]));
    return balances.map((b) => ({
      locationId: b.stockLocationId,
      locationName: locMap.get(b.stockLocationId)?.name ?? '—',
      skuCount: b._count._all,
      totalQuantity: b._sum.quantity ?? 0,
      scope: clientId ? 'cliente' : 'consultoria',
    }));
  }
}
