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
  WorkerFacialReferenceStatus,
  WorkerBiometricConsentStatus,
  WorkerBiometricDeletionStatus,
  WorkerStatus,
} from '@prisma/client';
import {
  decideFaceMatch,
  EPI_DELIVERY_DECLARATION_TEXT,
  EPI_DELIVERY_DECLARATION_VERSION,
  EPI_SHEET_DECLARATION_TEXT,
  EPI_SHEET_DECLARATION_VERSION,
  FACE_ENGINE,
  FACE_ENGINE_VERSION,
  assessNeedEquipmentCompatibility,
  isLivenessChallengeType,
  isLivenessRequired,
  isValidFaceDescriptor,
  resolveFaceMatchThreshold,
} from '@gestao-epi/shared';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { unlink, readFile } from 'fs/promises';
import { AuditService } from '../audit/audit.service';
import { normalizeCaNumber } from '../caepi/caepi-import.utils';
import { CaepiService } from '../caepi/caepi.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import type { CreateWorkerDto } from '../workers/dto/create-worker.dto';
import type { UpdateWorkerDto } from '../workers/dto/update-worker.dto';
import { WorkerBiometricConsentService } from '../workers/worker-biometric-consent.service';
import { evaluateWorkerBiometrics } from '../workers/worker-biometrics.utils';
import { WorkerFacialEnrollmentService } from '../workers/worker-facial-enrollment.service';
import {
  resolveWorkerFaceReferenceAbsolutePath,
} from '../workers/worker-face-reference.storage';
import { WorkerImportService } from '../workers/worker-import.service';
import { WORKER_CSV_TEMPLATE } from '../workers/worker-import.utils';
import { WorkersService } from '../workers/workers.service';
import type { ConfirmWorkerImportDto } from '../workers/dto/worker-import.dto';
import {
  FACIAL_EVIDENCE_CONSENT_TEXT,
  FACIAL_EVIDENCE_CONSENT_VERSION,
  type PortalCancelDeliveryDto,
  type PortalCreateDeliveryPayloadDto,
  type PortalCreateReturnDto,
} from './dto/portal-delivery.dto';
import type {
  PortalStockEntradasDto,
  PortalStockSaidaDto,
} from './dto/portal-stock.dto';
import {
  resolveInvoiceDocumentAbsolutePath,
  saveInvoiceDocumentFile,
} from './invoice-document.storage';
import {
  extractInvoiceFromFile,
  type InvoiceExtractionResult,
} from './invoice-extract';
import {
  resolveEvidenceAbsolutePath,
  saveFacialEvidenceFile,
} from './facial-evidence.storage';
import { resolveUsefulLife } from '../epi-needs/epi-useful-life.defaults';
import {
  findMatchingEpiNeed,
  isDeliverableEpiNeed,
  needNameMatchesEquipment,
} from '../epi-needs/epi-need-canonical';
import {
  calendarDaysRemaining,
  computeNextReplacementAt,
  formatRemainingDays,
  formatUsageFrequencyLabel,
  formatUsefulLifeSnapshot,
  usefulLifeToBaseDays,
  REPLACEMENT_WARN_DAYS,
  REPLACEMENT_CRITICAL_DAYS,
} from './replacement-schedule.utils';
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
    private readonly biometricConsent: WorkerBiometricConsentService,
    private readonly workers: WorkersService,
    private readonly facialEnrollment: WorkerFacialEnrollmentService,
    private readonly workerImport: WorkerImportService,
  ) {}

  async getDashboard(organizationId: string, servedClientId: string) {
    const client = await this.requireClient(organizationId, servedClientId);

    const now = new Date();
    const warnHorizon = new Date(now);
    warnHorizon.setUTCDate(warnHorizon.getUTCDate() + REPLACEMENT_WARN_DAYS);
    warnHorizon.setUTCHours(23, 59, 59, 999);
    const criticalHorizon = new Date(now);
    criticalHorizon.setUTCDate(
      criticalHorizon.getUTCDate() + REPLACEMENT_CRITICAL_DAYS,
    );
    criticalHorizon.setUTCHours(23, 59, 59, 999);
    const deliveriesFrom = new Date(now);
    deliveriesFrom.setUTCDate(deliveriesFrom.getUTCDate() - 7);
    deliveriesFrom.setUTCHours(0, 0, 0, 0);

    const [
      unitsActive,
      workersActive,
      sectorsActive,
      jobsActive,
      requirementsActive,
      validity,
      stockBalances,
      replacementItems,
      deliveriesLast7Days,
      workersWithBiometrics,
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
      this.prisma.epiStockBalance.findMany({
        where: {
          organizationId,
          stockLocation: { servedClientId, isActive: true },
        },
        select: { quantity: true, minQuantity: true },
      }),
      this.prisma.epiDeliveryItem.findMany({
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
          },
        },
        select: { nextReplacementAt: true },
      }),
      this.prisma.epiDelivery.count({
        where: {
          organizationId,
          servedClientId,
          deliveredAt: { gte: deliveriesFrom },
          status: { not: EpiDeliveryStatus.CANCELLED },
        },
      }),
      this.prisma.workerFacialReference.findMany({
        where: {
          organizationId,
          servedClientId,
          status: WorkerFacialReferenceStatus.ACTIVE,
          faceDescriptor: { not: Prisma.DbNull },
          worker: { status: WorkerStatus.ACTIVE },
        },
        distinct: ['workerId'],
        select: { workerId: true },
      }),
    ]);

    const uniqueNeeds = await this.countUniqueNeeds(
      organizationId,
      servedClientId,
    );

    const stockAgg = stockBalances.reduce(
      (acc, row) => {
        acc.quantity += row.quantity;
        if (row.quantity <= 0) acc.zero += 1;
        else if (row.minQuantity != null && row.quantity <= row.minQuantity) {
          acc.low += 1;
        }
        return acc;
      },
      { quantity: 0, low: 0, zero: 0 },
    );

    let replacementOverdue = 0;
    let replacementCritical = 0;
    let replacementWarn = 0;
    for (const item of replacementItems) {
      const at = item.nextReplacementAt;
      if (!at) continue;
      if (at.getTime() < now.getTime()) replacementOverdue += 1;
      else if (at.getTime() <= criticalHorizon.getTime()) {
        replacementCritical += 1;
      } else replacementWarn += 1;
    }
    const replacementTotal =
      replacementOverdue + replacementCritical + replacementWarn;

    const expired = validity.filter((v) => v.bucket === 'expired').length;
    const soon = validity.filter((v) => v.bucket === 'soon').length;
    const missingCa = validity.filter((v) => v.bucket === 'missing').length;
    const caTotal = expired + soon + missingCa;
    const stockAlertTotal = stockAgg.low + stockAgg.zero;
    const biometricsMissing = Math.max(
      0,
      workersActive - workersWithBiometrics.length,
    );

    const attentionCards = this.buildAttentionCards({
      replacement: {
        overdue: replacementOverdue,
        critical: replacementCritical,
        warn: replacementWarn,
        total: replacementTotal,
        warnDays: REPLACEMENT_WARN_DAYS,
        criticalDays: REPLACEMENT_CRITICAL_DAYS,
      },
      caValidity: {
        expired,
        soon,
        missingCa,
        total: caTotal,
      },
      stock: {
        low: stockAgg.low,
        zero: stockAgg.zero,
        total: stockAlertTotal,
      },
      deliveries: { last7Days: deliveriesLast7Days },
      biometrics: { missing: biometricsMissing, workersActive },
    });

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
        entregas: deliveriesLast7Days,
        validade: caTotal,
        custos: null as number | null,
        estoque: stockAgg.quantity,
      },
      validitySummary: {
        expired,
        soon,
        missingCa,
        tracked: validity.length,
      },
      attention: {
        replacement: {
          overdue: replacementOverdue,
          critical: replacementCritical,
          warn: replacementWarn,
          total: replacementTotal,
          warnDays: REPLACEMENT_WARN_DAYS,
          criticalDays: REPLACEMENT_CRITICAL_DAYS,
        },
        caValidity: {
          expired,
          soon,
          missingCa,
          total: caTotal,
        },
        stock: {
          low: stockAgg.low,
          zero: stockAgg.zero,
          total: stockAlertTotal,
        },
        deliveries: { last7Days: deliveriesLast7Days },
        biometrics: {
          missing: biometricsMissing,
          workersActive,
        },
        cards: attentionCards,
      },
      modules: {
        entregas: { ready: true },
        validade: { ready: true },
        custos: { ready: true },
        estoque: {
          ready: true,
          mode: 'stock' as const,
          reason: 'Entrada e saldos desta empresa no Painel do Cliente.',
        },
      },
    };
  }

  private buildAttentionCards(input: {
    replacement: {
      overdue: number;
      critical: number;
      warn: number;
      total: number;
      warnDays: number;
      criticalDays: number;
    };
    caValidity: {
      expired: number;
      soon: number;
      missingCa: number;
      total: number;
    };
    stock: { low: number; zero: number; total: number };
    deliveries: { last7Days: number };
    biometrics: { missing: number; workersActive: number };
  }) {
    const replacementTone =
      input.replacement.overdue + input.replacement.critical > 0
        ? ('critical' as const)
        : input.replacement.warn > 0
          ? ('warn' as const)
          : ('ok' as const);

    const caTone =
      input.caValidity.expired > 0
        ? ('critical' as const)
        : input.caValidity.soon + input.caValidity.missingCa > 0
          ? ('warn' as const)
          : ('ok' as const);

    const stockTone =
      input.stock.zero > 0
        ? ('critical' as const)
        : input.stock.low > 0
          ? ('warn' as const)
          : ('ok' as const);

    const replacementDetail =
      input.replacement.total === 0
        ? 'Nenhuma troca no horizonte de alerta.'
        : [
            input.replacement.overdue
              ? `${input.replacement.overdue} vencida(s)`
              : null,
            input.replacement.critical
              ? `${input.replacement.critical} em ate ${input.replacement.criticalDays}d`
              : null,
            input.replacement.warn
              ? `${input.replacement.warn} em ate ${input.replacement.warnDays}d`
              : null,
          ]
            .filter(Boolean)
            .join(' · ');

    const caDetail =
      input.caValidity.total === 0
        ? 'Nenhum CA exigindo atencao.'
        : [
            input.caValidity.expired
              ? `${input.caValidity.expired} vencido(s)`
              : null,
            input.caValidity.soon
              ? `${input.caValidity.soon} a vencer`
              : null,
            input.caValidity.missingCa
              ? `${input.caValidity.missingCa} sem CA`
              : null,
          ]
            .filter(Boolean)
            .join(' · ');

    const stockDetail =
      input.stock.total === 0
        ? 'Saldos dentro do minimo.'
        : [
            input.stock.zero ? `${input.stock.zero} zerado(s)` : null,
            input.stock.low ? `${input.stock.low} baixo(s)` : null,
          ]
            .filter(Boolean)
            .join(' · ');

    return [
      {
        id: 'replacement' as const,
        title: 'Vida util / trocas',
        href: '/portal/trabalhadores?filtro=trocas',
        count: input.replacement.total,
        tone: replacementTone,
        label:
          replacementTone === 'ok'
            ? 'Em dia'
            : replacementTone === 'critical'
              ? 'Troca urgente'
              : 'Troca proxima',
        detail: replacementDetail,
        visible: input.replacement.total > 0,
      },
      {
        id: 'caValidity' as const,
        title: 'Validade de CA',
        href: '/portal/validade',
        count: input.caValidity.total,
        tone: caTone,
        label:
          caTone === 'ok'
            ? 'Em dia'
            : caTone === 'critical'
              ? 'CA vencido'
              : 'CA em alerta',
        detail: caDetail,
        visible: input.caValidity.total > 0,
      },
      {
        id: 'stock' as const,
        title: 'Estoque baixo',
        href: '/portal/estoque',
        count: input.stock.total,
        tone: stockTone,
        label:
          stockTone === 'ok'
            ? 'Em dia'
            : stockTone === 'critical'
              ? 'Estoque critico'
              : 'Reabastecer',
        detail: stockDetail,
        visible: input.stock.total > 0,
      },
      {
        id: 'deliveries' as const,
        title: 'Entregas',
        href: '/portal/entregas',
        count: input.deliveries.last7Days,
        tone: 'info' as const,
        label: 'Ultimos 7 dias',
        detail:
          input.deliveries.last7Days === 0
            ? 'Nenhuma entrega recente.'
            : `${input.deliveries.last7Days} entrega(s) nos ultimos 7 dias.`,
        visible: true,
      },
      {
        id: 'biometrics' as const,
        title: 'Sem biometria',
        href: '/portal/trabalhadores',
        count: input.biometrics.missing,
        tone:
          input.biometrics.missing > 0
            ? ('warn' as const)
            : ('ok' as const),
        label:
          input.biometrics.missing > 0
            ? 'Cadastro pendente'
            : 'Biometria ok',
        detail:
          input.biometrics.missing > 0
            ? `${input.biometrics.missing} trabalhador(es) ativo(s) sem template facial.`
            : 'Todos os ativos com biometria.',
        visible: input.biometrics.missing > 0,
      },
    ];
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

    const [sectors, units, lastPgro] = await Promise.all([
      this.prisma.clientSector.findMany({
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
      }),
      this.prisma.operationalUnit.findMany({
        where: {
          organizationId,
          servedClientId,
          status: 'ACTIVE',
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.pgroImportRun.findFirst({
        where: {
          organizationId,
          servedClientId,
          status: 'CONFIRMED',
        },
        orderBy: { finishedAt: 'desc' },
        select: {
          id: true,
          fileName: true,
          createdAt: true,
          finishedAt: true,
        },
      }),
    ]);

    return {
      lastPgroImport: lastPgro
        ? {
            id: lastPgro.id,
            fileName: lastPgro.fileName,
            createdAt: lastPgro.createdAt.toISOString(),
            finishedAt: lastPgro.finishedAt?.toISOString() ?? null,
          }
        : null,
      units: units.map((unit) => ({
        id: unit.id,
        name: unit.name,
        code: unit.code,
      })),
      sectors: sectors.map((sector) => ({
        id: sector.id,
        name: sector.name,
        unitName: sector.operationalUnit?.name ?? null,
        operationalUnitId: sector.operationalUnit?.id ?? null,
        jobs: sector.jobFunctions.map((job) => {
          const needMap = new Map<
            string,
            { id: string; name: string; riskNames: string[] }
          >();
          for (const req of job.epiRequirements) {
            if (!isDeliverableEpiNeed(req.epiNeed.name)) continue;
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
    const now = new Date();
    const warnHorizon = new Date(now);
    warnHorizon.setUTCDate(warnHorizon.getUTCDate() + REPLACEMENT_WARN_DAYS);
    warnHorizon.setUTCHours(23, 59, 59, 999);
    const criticalHorizon = new Date(now);
    criticalHorizon.setUTCDate(
      criticalHorizon.getUTCDate() + REPLACEMENT_CRITICAL_DAYS,
    );
    criticalHorizon.setUTCHours(23, 59, 59, 999);

    const [workers, dueItems, faces] = await Promise.all([
      this.prisma.worker.findMany({
        where: { organizationId, servedClientId },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        include: {
          operationalUnit: { select: { id: true, name: true } },
          clientSector: { select: { id: true, name: true } },
          clientJobFunction: {
            select: { id: true, name: true, isActive: true },
          },
        },
      }),
      this.prisma.epiDeliveryItem.findMany({
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
          },
        },
        include: {
          delivery: {
            select: {
              id: true,
              receiptNumber: true,
              workerId: true,
            },
          },
          epiNeed: { select: { name: true } },
          epiItem: { select: { name: true, caNumber: true } },
        },
        orderBy: { nextReplacementAt: 'asc' },
      }),
      this.prisma.workerFacialReference.findMany({
        where: {
          organizationId,
          servedClientId,
          status: {
            in: [
              WorkerFacialReferenceStatus.ACTIVE,
              WorkerFacialReferenceStatus.NEEDS_REENROLLMENT,
              WorkerFacialReferenceStatus.REVOKED,
            ],
          },
        },
        orderBy: { uploadedAt: 'desc' },
        select: {
          workerId: true,
          status: true,
          faceDescriptor: true,
          filePath: true,
        },
      }),
    ]);

    const faceByWorker = new Map<string, (typeof faces)[number]>();
    for (const face of faces) {
      if (!faceByWorker.has(face.workerId)) {
        faceByWorker.set(face.workerId, face);
      }
    }

    const dueByWorker = new Map<
      string,
      Array<{
        id: string;
        deliveryId: string;
        receiptNumber: string;
        epiName: string;
        needName: string;
        caNumber: string | null;
        nextReplacementAt: string;
        usefulLifeLabel: string | null;
        daysRemaining: number;
        tone: 'warn' | 'critical';
      }>
    >();

    for (const item of dueItems) {
      const at = item.nextReplacementAt;
      if (!at) continue;
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysRemaining = Math.ceil((at.getTime() - now.getTime()) / msPerDay);
      const tone: 'warn' | 'critical' =
        at.getTime() <= criticalHorizon.getTime() ? 'critical' : 'warn';
      const workerId = item.delivery.workerId;
      const list = dueByWorker.get(workerId) ?? [];
      list.push({
        id: item.id,
        deliveryId: item.delivery.id,
        receiptNumber: item.delivery.receiptNumber,
        epiName: item.epiItem.name,
        needName: item.epiNeed.name,
        caNumber: item.epiItem.caNumber,
        nextReplacementAt: at.toISOString(),
        usefulLifeLabel: formatUsefulLifeSnapshot(
          item.usefulLifeValue,
          item.usefulLifeUnit,
          item.quantity - item.returnedQuantity - item.cancelledQuantity,
        ),
        daysRemaining,
        tone,
      });
      dueByWorker.set(workerId, list);
    }

    const active = workers.filter((w) => w.status === WorkerStatus.ACTIVE).length;

    const mapped = workers.map((w) => {
      const items = dueByWorker.get(w.id) ?? [];
      const overdue = items.filter((i) => i.daysRemaining < 0).length;
      const critical = items.filter(
        (i) => i.daysRemaining >= 0 && i.tone === 'critical',
      ).length;
      const warn = items.filter((i) => i.tone === 'warn').length;
      const replacementDue =
        items.length === 0
          ? null
          : {
              count: items.length,
              overdue,
              critical,
              warn,
              tone:
                overdue + critical > 0
                  ? ('critical' as const)
                  : ('warn' as const),
              items,
            };

      const face = faceByWorker.get(w.id);
      const bio = evaluateWorkerBiometrics({
        status: face?.status,
        faceDescriptor: face?.faceDescriptor,
        filePath: face?.filePath,
      });

      return {
        id: w.id,
        name: w.name,
        cpf: w.cpf,
        registration: w.registration,
        email: w.email,
        phone: w.phone,
        role: w.role,
        department: w.department,
        status: w.status,
        notes: w.notes,
        operationalUnitId: w.operationalUnitId,
        clientSectorId: w.clientSectorId,
        clientJobFunctionId: w.clientJobFunctionId,
        unitName: w.operationalUnit?.name ?? null,
        sectorName: w.clientSector?.name ?? null,
        jobFunctionName: w.clientJobFunction?.name ?? null,
        needsReallocation: Boolean(
          w.clientJobFunctionId && w.clientJobFunction && !w.clientJobFunction.isActive,
        ),
        admissionDate: w.admissionDate?.toISOString() ?? null,
        hasValidBiometrics: bio.hasValidBiometrics,
        biometricStatus: bio.biometricStatus,
        replacementDue,
      };
    });

    mapped.sort((a, b) => {
      const aDue = a.replacementDue ? 1 : 0;
      const bDue = b.replacementDue ? 1 : 0;
      if (aDue !== bDue) return bDue - aDue;
      if (a.replacementDue && b.replacementDue) {
        if (a.replacementDue.tone !== b.replacementDue.tone) {
          return a.replacementDue.tone === 'critical' ? -1 : 1;
        }
      }
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    return {
      lives: {
        allocated: client.allocatedLifeQuota,
        used: active,
        available: Math.max(0, client.allocatedLifeQuota - active),
      },
      replacementHorizon: {
        warnDays: REPLACEMENT_WARN_DAYS,
        criticalDays: REPLACEMENT_CRITICAL_DAYS,
      },
      summary: {
        withReplacementDue: mapped.filter((w) => w.replacementDue).length,
      },
      workers: mapped,
    };
  }

  async createWorker(
    organizationId: string,
    userId: string,
    servedClientId: string,
    dto: CreateWorkerDto,
  ) {
    await this.requireClient(organizationId, servedClientId);
    return this.workers.create(organizationId, userId, servedClientId, dto);
  }

  async updateWorker(
    organizationId: string,
    userId: string,
    servedClientId: string,
    workerId: string,
    dto: UpdateWorkerDto,
  ) {
    await this.requireClient(organizationId, servedClientId);
    await this.assertWorkerBelongsToClient(
      organizationId,
      servedClientId,
      workerId,
    );
    return this.workers.update(organizationId, userId, workerId, dto);
  }

  async updateWorkerStatus(
    organizationId: string,
    userId: string,
    servedClientId: string,
    workerId: string,
    status: WorkerStatus,
  ) {
    await this.requireClient(organizationId, servedClientId);
    await this.assertWorkerBelongsToClient(
      organizationId,
      servedClientId,
      workerId,
    );
    return this.workers.updateStatus(organizationId, userId, workerId, status);
  }

  async getWorkerFacialEnrollmentLink(
    organizationId: string,
    servedClientId: string,
    workerId: string,
  ) {
    await this.requireClient(organizationId, servedClientId);
    await this.assertWorkerBelongsToClient(
      organizationId,
      servedClientId,
      workerId,
    );
    return this.facialEnrollment.getLatestStatus(organizationId, workerId);
  }

  async generateWorkerFacialEnrollmentLink(
    organizationId: string,
    userId: string,
    servedClientId: string,
    workerId: string,
  ) {
    await this.requireClient(organizationId, servedClientId);
    await this.assertWorkerBelongsToClient(
      organizationId,
      servedClientId,
      workerId,
    );
    return this.facialEnrollment.generate(organizationId, userId, workerId);
  }

  async resendWorkerFacialEnrollmentWhatsapp(
    organizationId: string,
    userId: string,
    servedClientId: string,
    workerId: string,
  ) {
    await this.requireClient(organizationId, servedClientId);
    await this.assertWorkerBelongsToClient(
      organizationId,
      servedClientId,
      workerId,
    );
    return this.facialEnrollment.resendWhatsapp(
      organizationId,
      userId,
      workerId,
    );
  }

  getWorkerCsvTemplate() {
    return {
      fileName: 'modelo-importacao-trabalhadores.csv',
      contentType: 'text/csv; charset=utf-8',
      csvText: WORKER_CSV_TEMPLATE,
    };
  }

  async previewWorkerImport(
    organizationId: string,
    servedClientId: string,
    input: { csvText?: string; csvBase64?: string },
  ) {
    await this.requireClient(organizationId, servedClientId);
    return this.workerImport.preview(organizationId, servedClientId, input);
  }

  async confirmWorkerImport(
    organizationId: string,
    userId: string,
    servedClientId: string,
    dto: ConfirmWorkerImportDto,
  ) {
    await this.requireClient(organizationId, servedClientId);
    return this.workerImport.confirm(
      organizationId,
      userId,
      servedClientId,
      dto.rows.map((row) => ({
        rowNumber: row.rowNumber,
        payload: {
          name: row.payload.name,
          cpf: row.payload.cpf ?? null,
          registration: row.payload.registration ?? null,
          email: row.payload.email ?? null,
          phone: row.payload.phone ?? null,
          admissionDate: row.payload.admissionDate ?? null,
          status: row.payload.status,
          operationalUnitId: row.payload.operationalUnitId ?? null,
          clientSectorId: row.payload.clientSectorId ?? null,
          clientJobFunctionId: row.payload.clientJobFunctionId ?? null,
          department: row.payload.department ?? null,
          role: row.payload.role ?? null,
        },
      })),
    );
  }

  private async assertWorkerBelongsToClient(
    organizationId: string,
    servedClientId: string,
    workerId: string,
  ) {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, organizationId, servedClientId },
      select: { id: true },
    });
    if (!worker) {
      throw new NotFoundException('Trabalhador nao encontrado.');
    }
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

  async searchEpis(
    organizationId: string,
    servedClientId: string,
    q: string,
  ) {
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

    // Somente necessidades da estrutura deste cliente (nao o catalogo inteiro da consultoria).
    const clientNeedIds = await this.listClientActiveNeedIds(
      organizationId,
      servedClientId,
    );
    const clientStockedItemIds = await this.listClientStockedEpiItemIds(
      organizationId,
      servedClientId,
    );

    if (clientNeedIds.length > 0) {
      const needs = await this.prisma.epiNeed.findMany({
        where: {
          organizationId,
          isActive: true,
          id: { in: clientNeedIds },
        },
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
        const localLinks = need.itemLinks.filter(
          (l) =>
            l.epiItem?.isActive && clientStockedItemIds.has(l.epiItem.id),
        );
        if (localLinks.length > 0) {
          for (const link of localLinks) {
            const mapped = mapEpiSearchItem(link.epiItem as EpiCatalogSelect);
            byId.set(mapped.id, {
              ...mapped,
              epiNeedId: need.id,
              needName: need.name,
            });
          }
        } else {
          // Necessidade da estrutura deste cliente, ainda sem CA/estoque local.
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
    }

    // EPIs reais ja presentes no estoque deste cliente.
    if (clientStockedItemIds.size > 0) {
      const catalog = await this.prisma.epiItem.findMany({
        where: {
          organizationId,
          isActive: true,
          id: { in: Array.from(clientStockedItemIds) },
        },
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
    }

    // CAEPI → cruza com itens ja estocados neste cliente pelo CA.
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
              id: { in: Array.from(clientStockedItemIds) },
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
  async searchCaepiBase(
    q: string,
    limit = 12,
    options?: { validOnly?: boolean },
  ) {
    const result = await this.caepi.searchCertificates(q, limit, options);
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
      if (item.invoiceDocumentId) {
        const invoice = await this.prisma.invoiceDocument.findFirst({
          where: {
            id: item.invoiceDocumentId,
            organizationId,
            servedClientId,
          },
          select: { id: true },
        });
        if (!invoice) {
          throw new BadRequestException(
            'Nota fiscal anexada nao encontrada para este cliente.',
          );
        }
      }
      const resolved = await this.resolveEpiItemForEntrada(
        organizationId,
        item,
      );
      const epiRow = await this.prisma.epiItem.findFirst({
        where: { id: resolved.epiItemId, organizationId },
        select: {
          name: true,
          caNumber: true,
          description: true,
          approvedFor: true,
          reference: true,
        },
      });
      const linkedNeedNames = await this.autoLinkCaItemToClientNeeds(
        organizationId,
        servedClientId,
        resolved.epiItemId,
        {
          equipmentName: epiRow?.name ?? null,
          extraText: [
            epiRow?.description,
            epiRow?.approvedFor,
            epiRow?.reference,
          ]
            .filter(Boolean)
            .join(' '),
        },
      );
      const result = await this.stock.createMovement(organizationId, userId, {
        type: EpiStockMovementType.ENTRADA,
        stockLocationId: location.id,
        epiItemId: resolved.epiItemId,
        quantity: item.quantity,
        unitCostCents: item.unitCostCents,
        invoiceDocumentId: item.invoiceDocumentId,
        notes: item.epiNeedId
          ? `Entrada portal (necessidade ${item.epiNeedId})`
          : 'Entrada pelo Painel do Cliente',
      });
      results.push({
        epiItemId: resolved.epiItemId,
        epiNeedId: item.epiNeedId ?? null,
        linkedNeedNames,
        quantity: item.quantity,
        unitCostCents: item.unitCostCents ?? null,
        totalCostCents:
          item.unitCostCents != null
            ? item.unitCostCents * item.quantity
            : null,
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
   * Baixa manual de estoque (ex.: corrigir digitacao na entrada 900→90).
   * Registra SAIDA_MANUAL com motivo obrigatorio.
   */
  async createSaidaManual(
    organizationId: string,
    servedClientId: string,
    userId: string,
    dto: PortalStockSaidaDto,
  ) {
    await this.requireClient(organizationId, servedClientId);
    if (!userId) {
      throw new BadRequestException(
        'Usuario do portal sem vinculo para registrar movimentacao.',
      );
    }

    const reason = dto.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException(
        'Informe o motivo da baixa (ex.: erro de digitacao na entrada).',
      );
    }

    const defaultLocation = await this.ensureDefaultLocation(
      organizationId,
      servedClientId,
    );
    const stockLocationId = dto.stockLocationId?.trim() || defaultLocation.id;

    const location = await this.prisma.stockLocation.findFirst({
      where: {
        id: stockLocationId,
        organizationId,
        servedClientId,
        isActive: true,
      },
      select: { id: true, name: true },
    });
    if (!location) {
      throw new BadRequestException(
        'Local de estoque nao encontrado para este cliente.',
      );
    }

    const balance = await this.prisma.epiStockBalance.findFirst({
      where: {
        organizationId,
        stockLocationId: location.id,
        epiItemId: dto.epiItemId,
        epiVariantId: null,
      },
      include: {
        epiItem: {
          select: { id: true, name: true, caNumber: true },
        },
      },
    });
    if (!balance) {
      throw new BadRequestException(
        'Nao ha saldo deste EPI no estoque do cliente.',
      );
    }
    if (dto.quantity > balance.quantity) {
      throw new BadRequestException(
        `Quantidade a deduzir (${dto.quantity}) e maior que o saldo atual (${balance.quantity}).`,
      );
    }

    const result = await this.stock.createMovement(organizationId, userId, {
      type: EpiStockMovementType.SAIDA_MANUAL,
      stockLocationId: location.id,
      epiItemId: dto.epiItemId,
      quantity: dto.quantity,
      reason,
      notes: dto.notes?.trim() || 'Baixa manual pelo Painel do Cliente',
    });

    return {
      locationId: location.id,
      locationName: location.name,
      epiItemId: balance.epiItem.id,
      epiName: balance.epiItem.name,
      caNumber: balance.epiItem.caNumber,
      quantityDeducted: dto.quantity,
      previousQuantity: result.movement.previousQuantity,
      newQuantity: result.movement.newQuantity,
      movementId: result.movement.id,
      reason,
    };
  }

  async uploadInvoiceDocument(
    organizationId: string,
    servedClientId: string,
    userId: string,
    file: Express.Multer.File,
    meta?: { number?: string; supplierName?: string; notes?: string },
  ) {
    await this.requireClient(organizationId, servedClientId);
    if (!userId) {
      throw new BadRequestException(
        'Usuario do portal sem vinculo para anexar nota.',
      );
    }
    const mime = (file.mimetype || '').toLowerCase();
    const allowed =
      mime.includes('pdf') ||
      mime.includes('jpeg') ||
      mime.includes('jpg') ||
      mime.includes('png') ||
      mime.includes('webp') ||
      mime.includes('octet-stream');
    if (!allowed) {
      throw new BadRequestException(
        'Envie PDF ou imagem (JPG/PNG/WebP) da nota fiscal.',
      );
    }
    if (!file.buffer?.length) {
      throw new BadRequestException('Arquivo da nota vazio.');
    }
    if (file.buffer.byteLength > 12 * 1024 * 1024) {
      throw new BadRequestException('Nota fiscal acima de 12 MB.');
    }

    const saved = await saveInvoiceDocumentFile({
      organizationId,
      servedClientId,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
    });

    let extraction: InvoiceExtractionResult;
    try {
      extraction = await extractInvoiceFromFile({
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
      });
    } catch (err) {
      extraction = {
        method: 'NONE',
        ok: false,
        message:
          err instanceof Error
            ? `Falha na extracao: ${err.message}`
            : 'Falha na extracao.',
        invoiceNumber: null,
        supplierName: null,
        lines: [],
        suggested: null,
        rawTextPreview: null,
      };
    }

    const number =
      meta?.number?.trim() || extraction.invoiceNumber || null;
    const supplierName =
      meta?.supplierName?.trim() || extraction.supplierName || null;

    const doc = await this.prisma.invoiceDocument.create({
      data: {
        organizationId,
        servedClientId,
        number,
        supplierName,
        notes: meta?.notes?.trim() || null,
        filePath: saved.relativePath,
        fileHash: saved.fileHash,
        mimeType: saved.mimeType,
        byteSize: saved.byteSize,
        extractedJson: extraction as unknown as Prisma.InputJsonValue,
        extractedAt: new Date(),
        extractionMethod: extraction.method,
        createdByUserId: userId,
      },
    });

    return {
      id: doc.id,
      number: doc.number,
      supplierName: doc.supplierName,
      mimeType: doc.mimeType,
      byteSize: doc.byteSize,
      createdAt: doc.createdAt.toISOString(),
      ocrAvailable: extraction.ok,
      ocrMessage: extraction.message,
      extraction,
    };
  }

  async extractInvoiceDocument(
    organizationId: string,
    servedClientId: string,
    invoiceId: string,
  ) {
    await this.requireClient(organizationId, servedClientId);
    const doc = await this.prisma.invoiceDocument.findFirst({
      where: { id: invoiceId, organizationId, servedClientId },
    });
    if (!doc) {
      throw new NotFoundException('Nota fiscal nao encontrada.');
    }

    const absolute = resolveInvoiceDocumentAbsolutePath(doc.filePath);
    if (!absolute) {
      throw new NotFoundException('Arquivo da nota nao encontrado no storage.');
    }
    const buffer = await readFile(absolute);
    const extraction = await extractInvoiceFromFile({
      buffer,
      mimeType: doc.mimeType,
      originalName: doc.filePath,
    });

    const updated = await this.prisma.invoiceDocument.update({
      where: { id: doc.id },
      data: {
        extractedJson: extraction as unknown as Prisma.InputJsonValue,
        extractedAt: new Date(),
        extractionMethod: extraction.method,
        number: doc.number || extraction.invoiceNumber || null,
        supplierName: doc.supplierName || extraction.supplierName || null,
      },
    });

    return {
      id: updated.id,
      number: updated.number,
      supplierName: updated.supplierName,
      mimeType: updated.mimeType,
      byteSize: updated.byteSize,
      createdAt: updated.createdAt.toISOString(),
      ocrAvailable: extraction.ok,
      ocrMessage: extraction.message,
      extraction,
    };
  }

  async getCustosDashboard(organizationId: string, servedClientId: string) {
    await this.requireClient(organizationId, servedClientId);

    const locationIds = (
      await this.prisma.stockLocation.findMany({
        where: { organizationId, servedClientId },
        select: { id: true },
      })
    ).map((l) => l.id);

    const [balances, purchases, deliveryItems, invoices] = await Promise.all([
      this.prisma.epiStockBalance.findMany({
        where: {
          organizationId,
          stockLocationId: { in: locationIds.length ? locationIds : ['__none__'] },
        },
        include: {
          epiItem: {
            select: {
              id: true,
              name: true,
              caNumber: true,
              defaultUnitPriceCents: true,
            },
          },
        },
      }),
      this.prisma.epiStockMovement.findMany({
        where: {
          organizationId,
          type: EpiStockMovementType.ENTRADA,
          stockLocationId: { in: locationIds.length ? locationIds : ['__none__'] },
        },
        select: {
          id: true,
          epiItemId: true,
          quantity: true,
          unitCostCents: true,
          totalCostCents: true,
          createdAt: true,
          invoiceDocumentId: true,
          epiItem: {
            select: { id: true, name: true, caNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.prisma.epiDeliveryItem.findMany({
        where: {
          delivery: {
            organizationId,
            servedClientId,
            status: {
              in: [
                EpiDeliveryStatus.COMPLETED,
                EpiDeliveryStatus.PARTIALLY_RETURNED,
              ],
            },
          },
        },
        select: {
          quantity: true,
          returnedQuantity: true,
          cancelledQuantity: true,
          epiItem: {
            select: {
              id: true,
              name: true,
              caNumber: true,
              defaultUnitPriceCents: true,
            },
          },
          delivery: {
            select: {
              worker: {
                select: {
                  clientSectorId: true,
                  clientJobFunctionId: true,
                  clientSector: { select: { id: true, name: true } },
                  clientJobFunction: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        take: 5000,
      }),
      this.prisma.invoiceDocument.findMany({
        where: { organizationId, servedClientId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          number: true,
          supplierName: true,
          mimeType: true,
          byteSize: true,
          createdAt: true,
          extractionMethod: true,
          extractedAt: true,
          extractedJson: true,
        },
      }),
    ]);

    let stockValueCents = 0;
    let pricedBalanceLines = 0;
    let unpricedBalanceLines = 0;
    const byEpiMap = new Map<
      string,
      {
        epiItemId: string;
        name: string;
        caNumber: string | null;
        qtyInStock: number;
        stockValueCents: number;
        qtyPurchased: number;
        purchaseCostCents: number;
        qtyDelivered: number;
        deliveryCostCents: number;
        unitPriceCents: number | null;
      }
    >();

    for (const bal of balances) {
      const price = bal.epiItem.defaultUnitPriceCents;
      const lineValue =
        price != null ? price * Math.max(0, bal.quantity) : 0;
      if (price != null) {
        pricedBalanceLines += 1;
        stockValueCents += lineValue;
      } else if (bal.quantity > 0) {
        unpricedBalanceLines += 1;
      }
      const cur = byEpiMap.get(bal.epiItemId) ?? {
        epiItemId: bal.epiItemId,
        name: bal.epiItem.name,
        caNumber: bal.epiItem.caNumber,
        qtyInStock: 0,
        stockValueCents: 0,
        qtyPurchased: 0,
        purchaseCostCents: 0,
        qtyDelivered: 0,
        deliveryCostCents: 0,
        unitPriceCents: price,
      };
      cur.qtyInStock += bal.quantity;
      cur.stockValueCents += lineValue;
      if (price != null) cur.unitPriceCents = price;
      byEpiMap.set(bal.epiItemId, cur);
    }

    let purchasedCents = 0;
    let purchasedQty = 0;
    for (const mov of purchases) {
      const cost =
        mov.totalCostCents ??
        (mov.unitCostCents != null ? mov.unitCostCents * mov.quantity : 0);
      purchasedCents += cost;
      purchasedQty += mov.quantity;
      const cur = byEpiMap.get(mov.epiItemId) ?? {
        epiItemId: mov.epiItemId,
        name: mov.epiItem.name,
        caNumber: mov.epiItem.caNumber,
        qtyInStock: 0,
        stockValueCents: 0,
        qtyPurchased: 0,
        purchaseCostCents: 0,
        qtyDelivered: 0,
        deliveryCostCents: 0,
        unitPriceCents: mov.unitCostCents,
      };
      cur.qtyPurchased += mov.quantity;
      cur.purchaseCostCents += cost;
      if (mov.unitCostCents != null) cur.unitPriceCents = mov.unitCostCents;
      byEpiMap.set(mov.epiItemId, cur);
    }

    let deliveredCents = 0;
    let deliveredQty = 0;
    const bySectorMap = new Map<
      string,
      { id: string; name: string; qty: number; costCents: number }
    >();
    const byJobMap = new Map<
      string,
      { id: string; name: string; qty: number; costCents: number }
    >();

    for (const item of deliveryItems) {
      const netQty = Math.max(
        0,
        item.quantity - item.returnedQuantity - item.cancelledQuantity,
      );
      if (netQty <= 0) continue;
      const unit = item.epiItem.defaultUnitPriceCents;
      const cost = unit != null ? unit * netQty : 0;
      deliveredQty += netQty;
      deliveredCents += cost;

      const cur = byEpiMap.get(item.epiItem.id) ?? {
        epiItemId: item.epiItem.id,
        name: item.epiItem.name,
        caNumber: item.epiItem.caNumber,
        qtyInStock: 0,
        stockValueCents: 0,
        qtyPurchased: 0,
        purchaseCostCents: 0,
        qtyDelivered: 0,
        deliveryCostCents: 0,
        unitPriceCents: unit,
      };
      cur.qtyDelivered += netQty;
      cur.deliveryCostCents += cost;
      if (unit != null) cur.unitPriceCents = unit;
      byEpiMap.set(item.epiItem.id, cur);

      const sector = item.delivery.worker.clientSector;
      const sectorKey = sector?.id ?? '__none__';
      const sectorRow = bySectorMap.get(sectorKey) ?? {
        id: sector?.id ?? '',
        name: sector?.name ?? 'Sem setor',
        qty: 0,
        costCents: 0,
      };
      sectorRow.qty += netQty;
      sectorRow.costCents += cost;
      bySectorMap.set(sectorKey, sectorRow);

      const job = item.delivery.worker.clientJobFunction;
      const jobKey = job?.id ?? '__none__';
      const jobRow = byJobMap.get(jobKey) ?? {
        id: job?.id ?? '',
        name: job?.name ?? 'Sem funcao',
        qty: 0,
        costCents: 0,
      };
      jobRow.qty += netQty;
      jobRow.costCents += cost;
      byJobMap.set(jobKey, jobRow);
    }

    const byEpi = [...byEpiMap.values()].sort(
      (a, b) =>
        b.purchaseCostCents +
        b.deliveryCostCents -
        (a.purchaseCostCents + a.deliveryCostCents),
    );

    return {
      summary: {
        stockValueCents,
        purchasedCents,
        deliveredCents,
        purchasedQty,
        deliveredQty,
        pricedBalanceLines,
        unpricedBalanceLines,
        invoiceCount: invoices.length,
      },
      byEpi,
      bySector: [...bySectorMap.values()].sort(
        (a, b) => b.costCents - a.costCents,
      ),
      byJobFunction: [...byJobMap.values()].sort(
        (a, b) => b.costCents - a.costCents,
      ),
      recentPurchases: purchases.slice(0, 12).map((mov) => ({
        id: mov.id,
        epiItemId: mov.epiItemId,
        epiName: mov.epiItem.name,
        caNumber: mov.epiItem.caNumber,
        quantity: mov.quantity,
        unitCostCents: mov.unitCostCents,
        totalCostCents:
          mov.totalCostCents ??
          (mov.unitCostCents != null
            ? mov.unitCostCents * mov.quantity
            : null),
        invoiceDocumentId: mov.invoiceDocumentId,
        createdAt: mov.createdAt.toISOString(),
      })),
      invoices: invoices.map((doc) => {
        const extraction =
          doc.extractedJson && typeof doc.extractedJson === 'object'
            ? (doc.extractedJson as unknown as InvoiceExtractionResult)
            : null;
        return {
          id: doc.id,
          number: doc.number,
          supplierName: doc.supplierName,
          mimeType: doc.mimeType,
          byteSize: doc.byteSize,
          createdAt: doc.createdAt.toISOString(),
          extractionMethod: doc.extractionMethod,
          extractedAt: doc.extractedAt?.toISOString() ?? null,
          extraction,
        };
      }),
      ocr: {
        available: true,
        message: process.env.OPENAI_API_KEY?.trim()
          ? 'PDF com texto e fotos (OpenAI Vision) suportados. Sempre confira os valores sugeridos.'
          : 'PDF com texto: extracao automatica ativa. Fotos: configure OPENAI_API_KEY para Vision.',
      },
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
        select: { id: true, name: true, caNumber: true },
      });
      if (!existing) {
        throw new NotFoundException('EPI informado nao existe no catalogo.');
      }
      if (input.epiNeedId) {
        await this.assertNeedMatchesCaEquipment(
          organizationId,
          input.epiNeedId,
          existing.caNumber ?? '—',
          existing.name,
        );
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
        const item = await this.prisma.epiItem.findFirst({
          where: { id: byCa.id },
          select: { name: true, caNumber: true },
        });
        await this.assertNeedMatchesCaEquipment(
          organizationId,
          input.epiNeedId,
          item?.caNumber ?? caNumber,
          item?.name ?? null,
        );
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
    if (input.epiNeedId) {
      await this.assertNeedMatchesCaEquipment(
        organizationId,
        input.epiNeedId,
        caNumber,
        cert.equipmentName,
      );
    }

    const need = input.epiNeedId
      ? await this.prisma.epiNeed.findFirst({
          where: { id: input.epiNeedId, organizationId },
          select: {
            name: true,
            category: true,
            usefulLifeValue: true,
            usefulLifeUnit: true,
          },
        })
      : null;
    const name =
      cert.equipmentName?.trim() || need?.name || `EPI CA ${caNumber}`;
    const life = resolveUsefulLife({
      name: need?.name ?? name,
      category: need?.category,
      value: need?.usefulLifeValue,
      unit: need?.usefulLifeUnit,
    });

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
        usefulLifeValue: life?.value ?? null,
        usefulLifeUnit: life?.unit ?? null,
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

  private async assertNeedMatchesCaEquipment(
    organizationId: string,
    epiNeedId: string,
    caNumber: string,
    equipmentName: string | null | undefined,
  ) {
    const need = await this.prisma.epiNeed.findFirst({
      where: { id: epiNeedId, organizationId },
      select: { name: true },
    });
    if (!need) {
      throw new NotFoundException('Necessidade nao encontrada.');
    }
    const check = assessNeedEquipmentCompatibility(
      need.name,
      equipmentName,
    );
    if (!check.compatible) {
      throw new BadRequestException(
        `CA ${caNumber} nao combina com a necessidade "${need.name}". ${check.reason} Escolha um CA da mesma protecao (ex.: capacete de cabeca, nao respirador de jateamento).`,
      );
    }
  }

  private async listClientActiveNeedIds(
    organizationId: string,
    servedClientId: string,
  ): Promise<string[]> {
    const rows = await this.prisma.jobFunctionEpiRequirement.findMany({
      where: {
        organizationId,
        isActive: true,
        jobFunction: { servedClientId, isActive: true },
      },
      select: { epiNeedId: true },
      distinct: ['epiNeedId'],
    });
    return rows.map((row) => row.epiNeedId);
  }

  private async autoLinkCaItemToClientNeeds(
    organizationId: string,
    servedClientId: string,
    epiItemId: string,
    hints: { equipmentName: string | null; extraText?: string | null },
  ): Promise<string[]> {
    const clientNeedIds = await this.listClientActiveNeedIds(
      organizationId,
      servedClientId,
    );
    if (clientNeedIds.length === 0) return [];

    const needs = await this.prisma.epiNeed.findMany({
      where: { organizationId, isActive: true, id: { in: clientNeedIds } },
      select: { id: true, name: true },
    });
    if (needs.length === 0) return [];

    const matched = needs.filter((need) =>
      needNameMatchesEquipment(
        need.name,
        hints.equipmentName,
        hints.extraText,
      ),
    );
    if (matched.length === 0 && hints.equipmentName) {
      const hit = findMatchingEpiNeed(hints.equipmentName, needs);
      if (
        hit &&
        assessNeedEquipmentCompatibility(hit.name, hints.equipmentName)
          .compatible
      ) {
        matched.push(hit);
      }
    }

    const unique = [
      ...new Map(matched.map((need) => [need.id, need])).values(),
    ];
    const linked: string[] = [];
    for (const need of unique) {
      await this.ensureNeedItemLink(organizationId, need.id, epiItemId);
      linked.push(need.name);
    }
    return linked;
  }

  /** Religa estoque ja existente (entrada por CA sem vinculo) as necessidades do PGR. */
  private async healUnlinkedStockedItems(
    organizationId: string,
    servedClientId: string,
  ) {
    const rows = await this.prisma.epiStockBalance.findMany({
      where: {
        organizationId,
        quantity: { gt: 0 },
        stockLocation: { servedClientId, isActive: true },
        epiItem: { isActive: true },
      },
      select: {
        epiItem: {
          select: {
            id: true,
            name: true,
            description: true,
            approvedFor: true,
            reference: true,
          },
        },
      },
    });
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.epiItem.id)) continue;
      seen.add(row.epiItem.id);
      await this.autoLinkCaItemToClientNeeds(
        organizationId,
        servedClientId,
        row.epiItem.id,
        {
          equipmentName: row.epiItem.name,
          extraText: [
            row.epiItem.description,
            row.epiItem.approvedFor,
            row.epiItem.reference,
          ]
            .filter(Boolean)
            .join(' '),
        },
      );
    }
  }

  /** EPIs que ja tiveram saldo neste cliente (entrada/estoque local). */
  private async listClientStockedEpiItemIds(
    organizationId: string,
    servedClientId: string,
    epiItemIds?: string[],
  ): Promise<Set<string>> {
    if (epiItemIds && epiItemIds.length === 0) return new Set();
    const rows = await this.prisma.epiStockBalance.findMany({
      where: {
        organizationId,
        ...(epiItemIds?.length ? { epiItemId: { in: epiItemIds } } : {}),
        stockLocation: { servedClientId, isActive: true },
      },
      select: { epiItemId: true },
      distinct: ['epiItemId'],
    });
    return new Set(rows.map((row) => row.epiItemId));
  }

  private async ensureNeedItemLink(
    organizationId: string,
    epiNeedId: string,
    epiItemId: string,
  ) {
    const need = await this.prisma.epiNeed.findFirst({
      where: { id: epiNeedId, organizationId },
      select: {
        id: true,
        name: true,
        category: true,
        usefulLifeValue: true,
        usefulLifeUnit: true,
      },
    });
    if (!need) {
      throw new NotFoundException('Necessidade nao encontrada.');
    }
    const item = await this.prisma.epiItem.findFirst({
      where: { id: epiItemId, organizationId },
      select: { id: true, usefulLifeValue: true, usefulLifeUnit: true },
    });
    const leakedOneDay =
      item?.usefulLifeValue === 1 && item.usefulLifeUnit === EpiUsefulLifeUnit.DIAS;
    if (item && (item.usefulLifeValue == null || leakedOneDay)) {
      const life = resolveUsefulLife({
        name: need.name,
        category: need.category,
        value: need.usefulLifeValue,
        unit: need.usefulLifeUnit,
      });
      if (life && (item.usefulLifeValue == null || leakedOneDay)) {
        await this.prisma.epiItem.update({
          where: { id: item.id },
          data: {
            usefulLifeValue: life.value,
            usefulLifeUnit: life.unit,
          },
        });
      }
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

    const linkedItemIds = new Set<string>();
    for (const req of requirements) {
      if (!isDeliverableEpiNeed(req.epiNeed.name)) continue;
      for (const link of req.epiNeed.itemLinks) {
        if (link.epiItem.isActive) linkedItemIds.add(link.epiItem.id);
      }
    }
    const clientStockedItemIds = await this.listClientStockedEpiItemIds(
      organizationId,
      servedClientId,
      Array.from(linkedItemIds),
    );

    for (const req of requirements) {
      if (!isDeliverableEpiNeed(req.epiNeed.name)) continue;
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
        // Vinculo org-wide da consultoria so vale neste gestor se o CA ja entrou no estoque local.
        if (!clientStockedItemIds.has(link.epiItem.id)) continue;
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

    return Array.from(byNeed.values())
      .map((n) => {
        const items = n.items.sort((a, b) =>
          a.name.localeCompare(b.name, 'pt-BR'),
        );
        return {
          ...n,
          jobNames: n.jobNames.sort((a, b) => a.localeCompare(b, 'pt-BR')),
          items,
          suggestedItems: [] as typeof items,
          hasLinkedEpi: items.length > 0,
          hasCatalogSuggestions: false,
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

    const linkedItemIds = new Set<string>();
    for (const req of requirements) {
      if (!isDeliverableEpiNeed(req.epiNeed.name)) continue;
      for (const link of req.epiNeed.itemLinks) {
        if (link.epiItem.isActive) linkedItemIds.add(link.epiItem.id);
      }
    }
    const clientStockedItemIds = await this.listClientStockedEpiItemIds(
      organizationId,
      servedClientId,
      Array.from(linkedItemIds),
    );

    for (const req of requirements) {
      const links = req.epiNeed.itemLinks.filter(
        (l) => l.epiItem.isActive && clientStockedItemIds.has(l.epiItem.id),
      );
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
                select: {
                  epiNeedId: true,
                  epiNeed: { select: { name: true } },
                },
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
      const needIds = new Set<string>();
      for (const req of w.clientJobFunction?.epiRequirements ?? []) {
        if (!isDeliverableEpiNeed(req.epiNeed.name)) continue;
        needIds.add(req.epiNeedId);
      }
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
    await this.healUnlinkedStockedItems(organizationId, servedClientId);

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

    const facialRef = await this.prisma.workerFacialReference.findFirst({
      where: {
        organizationId,
        servedClientId,
        workerId: worker.id,
        status: {
          in: [
            WorkerFacialReferenceStatus.ACTIVE,
            WorkerFacialReferenceStatus.NEEDS_REENROLLMENT,
          ],
        },
      },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        uploadedAt: true,
        status: true,
        faceDescriptor: true,
      },
    });
    const hasDescriptor = Boolean(
      facialRef?.status === WorkerFacialReferenceStatus.ACTIVE &&
        facialRef.faceDescriptor &&
        isValidFaceDescriptor(facialRef.faceDescriptor),
    );
    const workerHasFacialReference = Boolean(
      facialRef?.status === WorkerFacialReferenceStatus.ACTIVE,
    );
    const workerHasBiometricTemplate = hasDescriptor;
    const needsReenrollment =
      facialRef?.status === WorkerFacialReferenceStatus.NEEDS_REENROLLMENT ||
      (facialRef?.status === WorkerFacialReferenceStatus.ACTIVE &&
        !hasDescriptor);
    const facialReferenceDto = {
      hasActive: workerHasFacialReference,
      hasDescriptor,
      needsReenrollment,
      uploadedAt: facialRef?.uploadedAt.toISOString() ?? null,
    };

    const consentMeta = await this.biometricConsent.getLatest(
      organizationId,
      worker.id,
    );
    const biometricConsentStatus = consentMeta.status;

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
        workerHasFacialReference,
        workerHasBiometricTemplate,
        biometricConsentStatus,
        facialReference: facialReferenceDto,
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
            category: true,
            usefulLifeValue: true,
            usefulLifeUnit: true,
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

    const deliverableRequirements = requirements.filter((req) =>
      isDeliverableEpiNeed(req.epiNeed.name),
    );

    if (deliverableRequirements.length === 0) {
      return {
        worker: workerDto,
        workerHasFacialReference,
        workerHasBiometricTemplate,
        biometricConsentStatus,
        facialReference: facialReferenceDto,
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
    for (const req of deliverableRequirements) {
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
      deliverableRequirements.map((req) => ({
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
    const linksByNeed = new Map<
      string,
      (typeof deliverableRequirements)[0]['epiNeed']
    >();
    for (const req of deliverableRequirements) {
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
            usefulLifeValue: item.usefulLifeValue,
            usefulLifeUnit: item.usefulLifeUnit,
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

      const needLife = resolveUsefulLife({
        name: epiNeed.name,
        category: epiNeed.category,
        value: epiNeed.usefulLifeValue,
        unit: epiNeed.usefulLifeUnit,
      });

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
        suggestedUsefulLifeValue: needLife?.value ?? null,
        suggestedUsefulLifeUnit: needLife?.unit ?? null,
        suggestedUsefulLifeLabel: needLife
          ? formatUsefulLife(needLife.value, needLife.unit)
          : null,
        suggestedUsefulLifeDays: needLife
          ? usefulLifeToBaseDays(needLife.value, needLife.unit)
          : null,
        status,
        guidance,
        warnings: group.warnings,
        availableStock,
        linkedEpis: linkedEpis.map((item) => {
          const itemLife =
            resolveUsefulLife({
              name: epiNeed.name,
              category: epiNeed.category,
              value: item.usefulLifeValue,
              unit: item.usefulLifeUnit,
            }) ??
            resolveUsefulLife({
              name: item.name,
              value: item.usefulLifeValue,
              unit: item.usefulLifeUnit,
            }) ??
            needLife;
          return {
            epiItemId: item.epiItemId,
            name: item.name,
            caNumber: item.caNumber,
            caExpiresAt: item.caExpiresAt,
            usefulLifeValue: itemLife?.value ?? null,
            usefulLifeUnit: itemLife?.unit ?? null,
            usefulLifeLabel: itemLife
              ? formatUsefulLife(itemLife.value, itemLife.unit)
              : item.usefulLifeLabel,
            usefulLifeDays: itemLife
              ? usefulLifeToBaseDays(itemLife.value, itemLife.unit)
              : null,
            totalQuantity: item.totalQuantity,
            balances: item.balances,
          };
        }),
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
    if (biometricConsentStatus !== 'GRANTED') {
      summaryStatus = 'BLOQUEADO';
      message =
        'Trabalhador sem consentimento biometrico ativo. Solicite regularizacao a Consultoria.';
    } else if (!workerHasBiometricTemplate) {
      summaryStatus = 'BLOQUEADO';
      message = needsReenrollment
        ? 'Biometria facial desatualizada. Solicite a Consultoria o recadastro da biometria (template).'
        : 'Trabalhador sem biometria facial cadastrada. Solicite a Consultoria o cadastro antes da entrega.';
    } else if (semEpiReal > 0) {
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
      workerHasFacialReference,
      workerHasBiometricTemplate,
      biometricConsentStatus,
      facialReference: facialReferenceDto,
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
            matchDistance: true,
            matchThreshold: true,
            faceEngine: true,
            verifiedAt: true,
          },
          take: 1,
        },
      },
    });

    return {
      deliveries: rows.map((row) => this.mapDeliverySummary(row)),
    };
  }

  async getWorkerEpiSheet(
    organizationId: string,
    servedClientId: string,
    workerId: string,
    scope: 'history' | 'open' = 'history',
    period?: { from?: string; to?: string },
  ) {
    const client = await this.requireClient(organizationId, servedClientId);

    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, organizationId, servedClientId },
      include: {
        operationalUnit: { select: { name: true } },
        clientSector: { select: { name: true } },
        clientJobFunction: { select: { name: true } },
      },
    });
    if (!worker) {
      throw new NotFoundException('Trabalhador nao encontrado neste cliente.');
    }

    const statusFilter =
      scope === 'open'
        ? {
            in: [
              EpiDeliveryStatus.COMPLETED,
              EpiDeliveryStatus.PARTIALLY_RETURNED,
            ] as EpiDeliveryStatus[],
          }
        : { not: EpiDeliveryStatus.CANCELLED };

    const fromDate = this.parseSheetDayStart(period?.from);
    const toDate = this.parseSheetDayEnd(period?.to);
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException(
        'Data inicial nao pode ser maior que a data final.',
      );
    }

    const deliveredAtFilter =
      fromDate || toDate
        ? {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          }
        : undefined;

    const deliveries = await this.prisma.epiDelivery.findMany({
      where: {
        organizationId,
        servedClientId,
        workerId: worker.id,
        status: statusFilter,
        ...(deliveredAtFilter ? { deliveredAt: deliveredAtFilter } : {}),
      },
      orderBy: { deliveredAt: 'desc' },
      include: {
        items: {
          include: {
            epiNeed: { select: { name: true } },
            epiItem: { select: { name: true, caNumber: true } },
            stockLocation: { select: { name: true } },
          },
        },
        evidences: {
          where: { type: DeliveryEvidenceType.FACIAL_CAPTURE },
          select: {
            id: true,
            capturedAt: true,
            verificationStatus: true,
            filePath: true,
            deletionStatus: true,
          },
          take: 1,
        },
      },
    });

    const generatedAt = new Date();
    const mapped = deliveries.map((row) => {
      const facial = row.evidences[0] ?? null;
      return {
        id: row.id,
        receiptNumber: row.receiptNumber,
        status: row.status,
        statusLabel: this.deliveryStatusLabel(row.status),
        deliveredAt: row.deliveredAt.toISOString(),
        items: row.items.map((item) => {
          const remainingQty = Math.max(
            0,
            item.quantity - item.returnedQuantity - item.cancelledQuantity,
          );
          const closed =
            item.status === EpiDeliveryItemStatus.REPLACED ||
            item.status === EpiDeliveryItemStatus.RETURNED ||
            item.status === EpiDeliveryItemStatus.CANCELLED;
          const nextAt = closed
            ? null
            : (item.nextReplacementAt ??
              computeNextReplacementAt({
                deliveredAt: row.deliveredAt,
                usefulLifeValue: item.usefulLifeValue,
                usefulLifeUnit: item.usefulLifeUnit,
                quantity: remainingQty > 0 ? remainingQty : item.quantity,
              }));
          const remaining =
            nextAt != null ? calendarDaysRemaining(nextAt, generatedAt) : null;
          return {
            id: item.id,
            needName: item.epiNeed.name,
            epiName: item.epiItem.name,
            caNumber: item.epiItem.caNumber,
            quantity: item.quantity,
            returnedQuantity: item.returnedQuantity,
            cancelledQuantity: item.cancelledQuantity,
            status: item.status,
            statusLabel: this.itemStatusLabel(item.status),
            nextReplacementAt: nextAt?.toISOString() ?? null,
            usefulLifeLabel: formatUsefulLifeSnapshot(
              item.usefulLifeValue,
              item.usefulLifeUnit,
              remainingQty > 0 ? remainingQty : item.quantity,
            ),
            remainingDays: remaining,
            remainingLabel: formatRemainingDays(remaining),
            usageFrequencyLabel: null,
            locationName: item.stockLocation.name,
          };
        }),
        evidence: facial
          ? {
              id: facial.id,
              capturedAt: facial.capturedAt.toISOString(),
              verificationStatus: facial.verificationStatus,
              hasFile: Boolean(
                facial.filePath &&
                  facial.deletionStatus !==
                    WorkerBiometricDeletionStatus.DELETED &&
                  existsSync(resolveEvidenceAbsolutePath(facial.filePath)),
              ),
              fileRemovedByRetention:
                facial.deletionStatus ===
                WorkerBiometricDeletionStatus.DELETED,
            }
          : null,
      };
    });

    return {
      generatedAt: generatedAt.toISOString(),
      period: {
        from: fromDate ? fromDate.toISOString().slice(0, 10) : null,
        to: toDate ? toDate.toISOString().slice(0, 10) : null,
      },
      client: {
        id: client.id,
        legalName: client.legalName,
        tradeName: client.tradeName,
        cnpj: client.cnpj,
      },
      worker: {
        id: worker.id,
        name: worker.name,
        registration: worker.registration,
        cpfMasked: this.maskCpf(worker.cpf),
        unitName: worker.operationalUnit?.name ?? null,
        sectorName: worker.clientSector?.name ?? worker.department ?? null,
        jobFunctionName:
          worker.clientJobFunction?.name ?? worker.role ?? null,
        status: worker.status,
      },
      summary: {
        deliveryCount: mapped.length,
        itemCount: mapped.reduce((acc, d) => acc + d.items.length, 0),
      },
      deliveries: mapped,
      declaration: {
        version: EPI_SHEET_DECLARATION_VERSION,
        text: EPI_SHEET_DECLARATION_TEXT,
      },
    };
  }

  private parseSheetDayStart(value?: string): Date | null {
    if (!value?.trim()) return null;
    const d = new Date(`${value.trim()}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(
        'Data inicial invalida. Use o formato AAAA-MM-DD.',
      );
    }
    return d;
  }

  private parseSheetDayEnd(value?: string): Date | null {
    if (!value?.trim()) return null;
    const d = new Date(`${value.trim()}T23:59:59.999Z`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(
        'Data final invalida. Use o formato AAAA-MM-DD.',
      );
    }
    return d;
  }

  async getDelivery(
    organizationId: string,
    servedClientId: string,
    deliveryId: string,
  ) {
    const client = await this.requireClient(organizationId, servedClientId);

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
            matchDistance: true,
            matchThreshold: true,
            faceEngine: true,
            verifiedAt: true,
            mimeType: true,
            byteSize: true,
            filePath: true,
            deletionStatus: true,
            deletedAt: true,
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
      client: {
        id: client.id,
        legalName: client.legalName,
        tradeName: client.tradeName,
        cnpj: client.cnpj,
      },
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
        const closed =
          item.status === EpiDeliveryItemStatus.REPLACED ||
          item.status === EpiDeliveryItemStatus.RETURNED ||
          item.status === EpiDeliveryItemStatus.CANCELLED;
        const availableQuantity = closed
          ? 0
          : Math.max(
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
          usefulLifeValue: item.usefulLifeValue ?? null,
          usefulLifeUnit: item.usefulLifeUnit ?? null,
          usefulLifeLabel: formatUsefulLifeSnapshot(
            item.usefulLifeValue,
            item.usefulLifeUnit,
            availableQuantity > 0 ? availableQuantity : item.quantity,
          ),
          usageDaysPerWeek: item.usageDaysPerWeek ?? null,
          usageFrequencyLabel: formatUsageFrequencyLabel(
            item.usageDaysPerWeek,
          ),
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
          (row.status === EpiDeliveryStatus.COMPLETED ||
            row.status === EpiDeliveryStatus.PARTIALLY_RETURNED) &&
          row.items.some(
            (item) =>
              item.status !== EpiDeliveryItemStatus.REPLACED &&
              item.status !== EpiDeliveryItemStatus.RETURNED &&
              item.status !== EpiDeliveryItemStatus.CANCELLED &&
              item.quantity - item.returnedQuantity - item.cancelledQuantity >
                0,
          ),
        canReturn:
          (row.status === EpiDeliveryStatus.COMPLETED ||
            row.status === EpiDeliveryStatus.PARTIALLY_RETURNED) &&
          row.items.some(
            (item) =>
              item.status !== EpiDeliveryItemStatus.REPLACED &&
              item.status !== EpiDeliveryItemStatus.RETURNED &&
              item.status !== EpiDeliveryItemStatus.CANCELLED &&
              item.quantity - item.returnedQuantity - item.cancelledQuantity >
                0,
          ),
      },
      evidence: facial
        ? {
            id: facial.id,
            type: facial.type,
            method: this.mapEvidenceMethod(facial.verificationStatus),
            statusLabel: this.mapEvidenceStatusLabel(
              facial.verificationStatus,
            ),
            capturedAt: facial.capturedAt.toISOString(),
            verificationStatus: facial.verificationStatus,
            matchDistance: facial.matchDistance ?? null,
            matchThreshold: facial.matchThreshold ?? null,
            faceEngine: facial.faceEngine ?? null,
            verifiedAt: facial.verifiedAt?.toISOString() ?? null,
            hasFile: Boolean(
              facial.filePath &&
                facial.deletionStatus !==
                  WorkerBiometricDeletionStatus.DELETED &&
                existsSync(resolveEvidenceAbsolutePath(facial.filePath)),
            ),
            deletionStatus: facial.deletionStatus as
              | 'NONE'
              | 'PENDING'
              | 'DELETED'
              | 'FAILED',
            fileRemovedByRetention:
              facial.deletionStatus === WorkerBiometricDeletionStatus.DELETED,
          }
        : null,
      consent: {
        accepted: Boolean(row.evidenceConsentAcceptedAt),
        acceptedAt: row.evidenceConsentAcceptedAt?.toISOString() ?? null,
        version: row.evidenceConsentVersion,
        text: row.evidenceConsentText,
        biometric: {
          status: row.biometricConsentStatus ?? null,
          version: row.biometricConsentVersion ?? null,
          grantedAt: row.biometricConsentGrantedAt?.toISOString() ?? null,
        },
      },
      declaration: {
        version: EPI_DELIVERY_DECLARATION_VERSION,
        text: EPI_DELIVERY_DECLARATION_TEXT,
      },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Cria entrega com baixa de estoque (ENTREGA) e matching biometrico automatico.
   * Descritor 128-d (face-api) comparado no backend; liveness MVP opcional via env.
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

    if (!isValidFaceDescriptor(payload.faceDescriptor)) {
      throw new BadRequestException(
        'Descritor facial da captura invalido. Detecte exatamente uma face e tente novamente.',
      );
    }

    const livenessRequired = isLivenessRequired(
      process.env.LIVENESS_REQUIRED,
      process.env.NODE_ENV,
    );
    const livenessChallenge = payload.livenessChallenge?.trim() ?? '';
    if (livenessRequired) {
      if (payload.livenessPassed !== true) {
        throw new BadRequestException(
          'Desafio de presenca obrigatorio. Complete o desafio (piscar/virar) e tente novamente.',
        );
      }
      if (!isLivenessChallengeType(livenessChallenge)) {
        throw new BadRequestException(
          'Tipo de desafio de presenca invalido.',
        );
      }
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

    const grantedConsent = await this.biometricConsent.getGrantedOrNull(
      organizationId,
      worker.id,
    );
    if (!grantedConsent) {
      throw new BadRequestException(
        'Trabalhador sem consentimento biometrico ativo. Solicite regularizacao a Consultoria.',
      );
    }

    const facialReference = await this.prisma.workerFacialReference.findFirst({
      where: {
        organizationId,
        servedClientId,
        workerId: worker.id,
        status: WorkerFacialReferenceStatus.ACTIVE,
      },
      select: {
        id: true,
        faceDescriptor: true,
        faceEngine: true,
        faceEngineVersion: true,
      },
    });
    if (!facialReference) {
      const needsReenroll =
        await this.prisma.workerFacialReference.findFirst({
          where: {
            organizationId,
            servedClientId,
            workerId: worker.id,
            status: WorkerFacialReferenceStatus.NEEDS_REENROLLMENT,
          },
          select: { id: true },
        });
      throw new BadRequestException(
        needsReenroll
          ? 'Biometria facial desatualizada (sem template). Solicite a Consultoria o recadastro antes da entrega.'
          : 'Trabalhador sem biometria facial cadastrada. Solicite a Consultoria o cadastro antes da entrega.',
      );
    }
    if (!isValidFaceDescriptor(facialReference.faceDescriptor)) {
      throw new BadRequestException(
        'Biometria facial desatualizada (sem template). Solicite a Consultoria o recadastro antes da entrega.',
      );
    }

    const matchThreshold = resolveFaceMatchThreshold(
      process.env.FACE_MATCH_THRESHOLD,
    );
    const match = decideFaceMatch(
      facialReference.faceDescriptor,
      payload.faceDescriptor,
      matchThreshold,
    );
    if (!match.matched) {
      throw new BadRequestException(
        'Face nao corresponde ao trabalhador selecionado.',
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
            category: true,
            usefulLifeValue: true,
            usefulLifeUnit: true,
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
            biometricConsentStatus: WorkerBiometricConsentStatus.GRANTED,
            biometricConsentVersion: grantedConsent.consentVersion,
            biometricConsentGrantedAt: grantedConsent.grantedAt,
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

          const needLife = resolveUsefulLife({
            name: req.epiNeed.name,
            category: req.epiNeed.category,
            value: req.epiNeed.usefulLifeValue,
            unit: req.epiNeed.usefulLifeUnit,
          });
          const resolvedLife = resolveUsefulLife({
            name: req.epiNeed.name,
            category: req.epiNeed.category,
            value:
              item.usefulLifeValue != null && item.usefulLifeValue > 0
                ? item.usefulLifeValue
                : epi.usefulLifeValue,
            unit:
              item.usefulLifeValue != null && item.usefulLifeValue > 0
                ? (item.usefulLifeUnit ?? EpiUsefulLifeUnit.DIAS)
                : (epi.usefulLifeUnit ?? needLife?.unit ?? null),
          }) ?? needLife;
          const lifeValue = resolvedLife?.value ?? null;
          const lifeUnit = resolvedLife?.unit ?? null;
          const intervalDays = resolveRestrictiveReplacementDays(
            intervalsByNeed.get(item.epiNeedId) ?? [],
          );

          const nextReplacementAt = computeNextReplacementAt({
            deliveredAt,
            replacementIntervalDays:
              lifeValue != null && lifeValue > 0 ? null : intervalDays,
            usefulLifeValue: lifeValue,
            usefulLifeUnit: lifeUnit,
            quantity: item.quantity,
          });

          const snapshotLifeValue =
            lifeValue != null && lifeValue > 0
              ? lifeValue
              : intervalDays != null && intervalDays > 0
                ? intervalDays
                : null;
          const snapshotLifeUnit =
            lifeValue != null && lifeValue > 0
              ? (lifeUnit ?? EpiUsefulLifeUnit.DIAS)
              : intervalDays != null && intervalDays > 0
                ? EpiUsefulLifeUnit.DIAS
                : null;

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
              usefulLifeValue: snapshotLifeValue,
              usefulLifeUnit: snapshotLifeUnit,
              usageDaysPerWeek: null,
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

        await tx.epiDeliveryItem.updateMany({
          where: {
            id: { notIn: createdItems.map((row) => row.id) },
            epiNeedId: { in: needIds },
            status: {
              in: [
                EpiDeliveryItemStatus.DELIVERED,
                EpiDeliveryItemStatus.PARTIALLY_RETURNED,
              ],
            },
            delivery: {
              organizationId,
              servedClientId,
              workerId: worker.id,
              status: {
                in: [
                  EpiDeliveryStatus.COMPLETED,
                  EpiDeliveryStatus.PARTIALLY_RETURNED,
                ],
              },
            },
          },
          data: {
            status: EpiDeliveryItemStatus.REPLACED,
            nextReplacementAt: null,
          },
        });

        await tx.deliveryEvidence.create({
          data: {
            deliveryId: delivery.id,
            type: DeliveryEvidenceType.FACIAL_CAPTURE,
            capturedAt: deliveredAt,
            filePath: savedFile!.relativePath,
            fileHash: savedFile!.fileHash,
            mimeType: savedFile!.mimeType,
            byteSize: savedFile!.byteSize,
            verificationStatus: DeliveryEvidenceVerificationStatus.MATCHED,
            matchDistance: match.distance,
            matchThreshold: match.threshold,
            faceEngine: payload.faceEngine?.trim() || FACE_ENGINE,
            verifiedAt: deliveredAt,
            livenessPassed:
              payload.livenessPassed === true ? true : payload.livenessPassed === false ? false : null,
            livenessChallenge: isLivenessChallengeType(livenessChallenge)
              ? livenessChallenge
              : null,
            retentionUntil: (() => {
              const until = new Date(deliveredAt);
              until.setFullYear(until.getFullYear() + 5);
              return until;
            })(),
            deletionStatus: WorkerBiometricDeletionStatus.NONE,
            metadata: {
              captureSource: 'portal_camera',
              consentVersion: FACIAL_EVIDENCE_CONSENT_VERSION,
              biometricMatch: true,
              faceEngineVersion:
                payload.faceEngineVersion?.trim() || FACE_ENGINE_VERSION,
              faceDetectionScore: payload.faceDetectionScore ?? null,
              workerFacialReferenceId: facialReference.id,
              livenessPassed: payload.livenessPassed === true,
              livenessChallenge: isLivenessChallengeType(livenessChallenge)
                ? livenessChallenge
                : null,
              note:
                payload.livenessPassed === true
                  ? 'Matching biometrico automatico aprovado (face-api) com desafio de presenca MVP.'
                  : 'Matching biometrico automatico aprovado (face-api descritor 128-d).',
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
          biometricMatched: true,
          matchDistance: match.distance,
          matchThreshold: match.threshold,
          consentVersion: FACIAL_EVIDENCE_CONSENT_VERSION,
          // Nao logar imagem, descritor, hash ou caminhos.
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
        if (item.status === EpiDeliveryItemStatus.REPLACED) continue;

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
            nextReplacementAt: null,
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
      if (
        item.status === EpiDeliveryItemStatus.REPLACED ||
        item.status === EpiDeliveryItemStatus.RETURNED ||
        item.status === EpiDeliveryItemStatus.CANCELLED
      ) {
        throw new BadRequestException(
          'Este item ja foi encerrado e nao pode ser devolvido.',
        );
      }
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
        const remainingQty =
          item.quantity - returnedQuantity - item.cancelledQuantity;
        const nextStatus = this.deriveItemStatus(
          item.quantity,
          returnedQuantity,
          item.cancelledQuantity,
        );
        const recomputedNext =
          remainingQty <= 0
            ? null
            : computeNextReplacementAt({
                deliveredAt: delivery.deliveredAt,
                usefulLifeValue: item.usefulLifeValue,
                usefulLifeUnit: item.usefulLifeUnit,
                quantity: remainingQty,
              });

        await tx.epiDeliveryItem.update({
          where: { id: item.id },
          data: {
            returnedQuantity,
            status: nextStatus,
            nextReplacementAt:
              remainingQty <= 0
                ? null
                : (recomputedNext ?? item.nextReplacementAt),
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

  /** Preview de matching biometrico (sem concluir entrega; nao expoe template). */
  async previewFacialMatch(
    organizationId: string,
    servedClientId: string,
    workerId: string,
    faceDescriptor: number[],
  ) {
    await this.requireClient(organizationId, servedClientId);
    if (!isValidFaceDescriptor(faceDescriptor)) {
      throw new BadRequestException('Descritor facial invalido.');
    }

    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, organizationId, servedClientId },
      select: { id: true },
    });
    if (!worker) {
      throw new NotFoundException('Trabalhador nao encontrado neste cliente.');
    }

    const facialReference = await this.prisma.workerFacialReference.findFirst({
      where: {
        organizationId,
        servedClientId,
        workerId: worker.id,
        status: WorkerFacialReferenceStatus.ACTIVE,
      },
      select: { faceDescriptor: true },
    });
    if (!facialReference || !isValidFaceDescriptor(facialReference.faceDescriptor)) {
      throw new BadRequestException(
        'Trabalhador sem biometria facial com template. Solicite o cadastro/recadastro na Consultoria.',
      );
    }

    const threshold = resolveFaceMatchThreshold(
      process.env.FACE_MATCH_THRESHOLD,
    );
    const match = decideFaceMatch(
      facialReference.faceDescriptor,
      faceDescriptor,
      threshold,
    );

    return {
      matched: match.matched,
      distance: Number(match.distance.toFixed(4)),
      threshold: match.threshold,
      status: match.matched
        ? ('MATCHED' as const)
        : ('REJECTED' as const),
      message: match.matched
        ? 'Face validada'
        : 'Face nao corresponde ao trabalhador selecionado.',
    };
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
      select: { filePath: true, mimeType: true, deletionStatus: true },
    });
    if (!evidence?.filePath || evidence.deletionStatus === WorkerBiometricDeletionStatus.DELETED) {
      throw new NotFoundException(
        'Evidencia facial nao disponivel (removida por retencao ou ausente).',
      );
    }

    const absolutePath = resolveEvidenceAbsolutePath(evidence.filePath);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException(
        'Arquivo de evidencia facial nao encontrado no storage. Verifique o volume DELIVERY_EVIDENCE_DIR.',
      );
    }

    return {
      absolutePath,
      mimeType: evidence.mimeType ?? 'image/jpeg',
    };
  }

  /** Referencia facial ACTIVE do trabalhador (portal; isolada por servedClientId). */
  async getWorkerFacialReferenceAbsolutePath(
    organizationId: string,
    servedClientId: string,
    workerId: string,
  ) {
    const client = await this.requireClient(organizationId, servedClientId);
    if (client.status !== 'ACTIVE') {
      throw new BadRequestException('Cliente inativo.');
    }

    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, organizationId, servedClientId },
      select: { id: true },
    });
    if (!worker) {
      throw new NotFoundException('Trabalhador nao encontrado neste cliente.');
    }

    const ref = await this.prisma.workerFacialReference.findFirst({
      where: {
        organizationId,
        servedClientId,
        workerId: worker.id,
        status: WorkerFacialReferenceStatus.ACTIVE,
        deletionStatus: { not: WorkerBiometricDeletionStatus.DELETED },
        filePath: { not: null },
      },
      select: { filePath: true, mimeType: true },
    });
    if (!ref?.filePath) {
      throw new NotFoundException(
        'Referencia facial ativa nao encontrada para este trabalhador.',
      );
    }

    const absolutePath = resolveWorkerFaceReferenceAbsolutePath(ref.filePath);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException(
        'Arquivo de referencia facial nao encontrado no storage.',
      );
    }

    return {
      absolutePath,
      mimeType: ref.mimeType ?? 'image/jpeg',
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
      case EpiDeliveryItemStatus.REPLACED:
        return 'Substituido na troca';
      default:
        return 'Entregue';
    }
  }

  private mapEvidenceStatusLabel(
    status: DeliveryEvidenceVerificationStatus,
  ):
    | 'FACIAL_CAPTURED'
    | 'HUMAN_CONFIRMED'
    | 'MATCHED'
    | 'REJECTED'
    | 'NO_FACE_DETECTED'
    | 'MULTIPLE_FACES_DETECTED'
    | 'NOT_VERIFIED' {
    switch (status) {
      case DeliveryEvidenceVerificationStatus.MATCHED:
        return 'MATCHED';
      case DeliveryEvidenceVerificationStatus.REJECTED:
        return 'REJECTED';
      case DeliveryEvidenceVerificationStatus.NO_FACE_DETECTED:
        return 'NO_FACE_DETECTED';
      case DeliveryEvidenceVerificationStatus.MULTIPLE_FACES_DETECTED:
        return 'MULTIPLE_FACES_DETECTED';
      case DeliveryEvidenceVerificationStatus.HUMAN_CONFIRMED:
        return 'HUMAN_CONFIRMED';
      case DeliveryEvidenceVerificationStatus.NOT_VERIFIED:
        return 'NOT_VERIFIED';
      default:
        return 'FACIAL_CAPTURED';
    }
  }

  private mapEvidenceMethod(
    status: DeliveryEvidenceVerificationStatus,
  ):
    | 'Facial capturada'
    | 'Conferencia visual confirmada'
    | 'Biometria facial aprovada'
    | 'Biometria facial rejeitada'
    | 'Sem verificacao' {
    if (status === DeliveryEvidenceVerificationStatus.MATCHED) {
      return 'Biometria facial aprovada';
    }
    if (status === DeliveryEvidenceVerificationStatus.REJECTED) {
      return 'Biometria facial rejeitada';
    }
    if (status === DeliveryEvidenceVerificationStatus.HUMAN_CONFIRMED) {
      return 'Conferencia visual confirmada';
    }
    if (status === DeliveryEvidenceVerificationStatus.NOT_VERIFIED) {
      return 'Sem verificacao';
    }
    return 'Facial capturada';
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
      method: facial
        ? facial.verificationStatus ===
          DeliveryEvidenceVerificationStatus.MATCHED
          ? ('Biometria facial aprovada' as const)
          : facial.verificationStatus ===
              DeliveryEvidenceVerificationStatus.HUMAN_CONFIRMED
            ? ('Conferencia visual confirmada' as const)
            : ('Facial capturada' as const)
        : ('Sem evidencia' as const),
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
