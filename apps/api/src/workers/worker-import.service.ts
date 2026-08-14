import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkerStatus } from '@prisma/client';
import type {
  WorkerImportConfirmResponse,
  WorkerImportConfirmRowInput,
  WorkerImportMatchBy,
  WorkerImportNormalizedPayload,
  WorkerImportPreviewResponse,
  WorkerImportPreviewRow,
  WorkerImportRowAction,
} from '@gestao-epi/shared';
import { AuditService } from '../audit/audit.service';
import { resolveCsvImportInput } from '../common/csv-text-encoding';
import { cpfAuditMeta, isValidCpf, stripCpf } from '../common/cpf';
import { PrismaService } from '../prisma/prisma.service';
import {
  mapWorkerCsvRecord,
  normalizeMatchName,
  normalizeOptionalText,
  parseAdmissionDateInput,
  parseCsvText,
  parseWorkerStatus,
} from './worker-import.utils';

type StructureContext = {
  units: Array<{ id: string; name: string; match: string }>;
  sectors: Array<{
    id: string;
    name: string;
    match: string;
    operationalUnitId: string | null;
    isActive: boolean;
  }>;
  jobs: Array<{
    id: string;
    name: string;
    match: string;
    sectorId: string;
    sectorName: string;
    isActive: boolean;
    requiredEpiCount: number;
  }>;
};

type ExistingWorker = {
  id: string;
  cpf: string | null;
  registration: string | null;
  status: WorkerStatus;
  servedClientId?: string;
};

@Injectable()
export class WorkerImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async preview(
    organizationId: string,
    servedClientId: string,
    input: { csvText?: string; csvBase64?: string },
  ): Promise<WorkerImportPreviewResponse> {
    await this.assertClient(organizationId, servedClientId);

    let csvText: string;
    try {
      csvText = resolveCsvImportInput(input);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Envie o conteudo CSV para a previa.',
      );
    }

    const { headers, records } = parseCsvText(csvText);
    if (headers.length === 0) {
      throw new BadRequestException('CSV vazio ou sem cabecalho.');
    }
    if (records.length === 0) {
      throw new BadRequestException('CSV nao contem linhas de dados.');
    }

    const unknownSet = new Set<string>();
    const mappedRows = records.map((cells, index) => {
      const mapped = mapWorkerCsvRecord(headers, cells);
      mapped.unknownColumns.forEach((col) => unknownSet.add(col));
      return { rowNumber: index + 2, ...mapped };
    });

    const [structure, existingInClient, orgCpfWorkers, life] = await Promise.all([
      this.loadStructure(organizationId, servedClientId),
      this.prisma.worker.findMany({
        where: { organizationId, servedClientId },
        select: { id: true, cpf: true, registration: true, status: true },
      }),
      this.prisma.worker.findMany({
        where: {
          organizationId,
          cpf: { not: null },
        },
        select: {
          id: true,
          cpf: true,
          registration: true,
          status: true,
          servedClientId: true,
        },
      }),
      this.getLifeSnapshot(organizationId, servedClientId),
    ]);

    const byCpf = new Map<string, ExistingWorker & { servedClientId?: string }>();
    const byRegistration = new Map<string, ExistingWorker>();
    for (const worker of orgCpfWorkers) {
      if (worker.cpf) byCpf.set(worker.cpf, worker);
    }
    for (const worker of existingInClient) {
      if (worker.registration) {
        byRegistration.set(normalizeMatchName(worker.registration), worker);
      }
    }

    const seenCpfs = new Map<string, number>();
    const seenRegs = new Map<string, number>();

    let slotUsed = life.used;
    const rows: WorkerImportPreviewRow[] = [];

    for (const row of mappedRows) {
      const errors: string[] = [];
      const warnings: string[] = [];
      let action: WorkerImportRowAction | null = null;
      let matchBy: WorkerImportMatchBy | null = null;
      let existingWorkerId: string | null = null;
      let exceedsQuota = false;
      let payload: WorkerImportNormalizedPayload | null = null;
      const resolved = {
        unitName: null as string | null,
        sectorName: null as string | null,
        jobFunctionName: null as string | null,
        requiredEpiCount: 0,
      };

      const name = normalizeOptionalText(row.mapped.name);
      if (!name || name.length < 2) {
        errors.push('Nome e obrigatorio (minimo 2 caracteres).');
      }

      let cpf: string | null = null;
      const cpfRaw = normalizeOptionalText(row.mapped.cpf);
      if (cpfRaw) {
        const digits = stripCpf(cpfRaw);
        if (!isValidCpf(digits)) {
          errors.push('CPF invalido.');
        } else {
          cpf = digits;
          const first = seenCpfs.get(cpf);
          if (first !== undefined) {
            errors.push(`CPF duplicado neste arquivo (linha ${first}).`);
          } else {
            seenCpfs.set(cpf, row.rowNumber);
          }
        }
      }

      const registration = normalizeOptionalText(row.mapped.registration);
      if (registration) {
        const regKey = normalizeMatchName(registration);
        const first = seenRegs.get(regKey);
        if (first !== undefined) {
          errors.push(`Matricula duplicada neste arquivo (linha ${first}).`);
        } else {
          seenRegs.set(regKey, row.rowNumber);
        }
      }

      const status = parseWorkerStatus(row.mapped.status);
      if (!status) {
        errors.push('Status invalido. Use ACTIVE/INACTIVE (ou Ativo/Inativo).');
      }

      const admission = parseAdmissionDateInput(row.mapped.admissionDate);
      if (admission.error) {
        errors.push(admission.error);
      }

      const unitNameRaw = normalizeOptionalText(row.mapped.unit);
      const sectorNameRaw = normalizeOptionalText(row.mapped.sector);
      const jobNameRaw = normalizeOptionalText(row.mapped.jobFunction);

      if (!sectorNameRaw) {
        errors.push('Setor e obrigatorio.');
      }
      if (!jobNameRaw) {
        errors.push('Funcao e obrigatoria.');
      }

      let unitId: string | null = null;
      let sectorId: string | null = null;
      let jobId: string | null = null;

      if (unitNameRaw) {
        const unit = structure.units.find(
          (item) => item.match === normalizeMatchName(unitNameRaw),
        );
        if (!unit) {
          errors.push(`Unidade "${unitNameRaw}" nao encontrada neste cliente.`);
        } else {
          unitId = unit.id;
          resolved.unitName = unit.name;
        }
      }

      if (sectorNameRaw) {
        const sectorMatches = structure.sectors.filter(
          (item) => item.match === normalizeMatchName(sectorNameRaw),
        );
        let sector = sectorMatches.find((item) => item.isActive) ?? sectorMatches[0];
        if (unitId && sectorMatches.length > 1) {
          const byUnit = sectorMatches.find(
            (item) => item.operationalUnitId === unitId && item.isActive,
          );
          if (byUnit) sector = byUnit;
        }
        if (!sector) {
          errors.push(`Setor "${sectorNameRaw}" nao encontrado neste cliente.`);
        } else {
          sectorId = sector.id;
          resolved.sectorName = sector.name;
        }
      }

      if (jobNameRaw && sectorId) {
        const jobMatches = structure.jobs.filter(
          (item) =>
            item.sectorId === sectorId &&
            item.match === normalizeMatchName(jobNameRaw),
        );
        const job = jobMatches.find((item) => item.isActive) ?? jobMatches[0];
        if (!job) {
          errors.push(
            `Funcao "${jobNameRaw}" nao encontrada no setor "${sectorNameRaw}".`,
          );
        } else {
          jobId = job.id;
          resolved.jobFunctionName = job.name;
          resolved.requiredEpiCount = job.requiredEpiCount;
        }
      } else if (jobNameRaw && !sectorId) {
        // setor ausente ja gerou erro
      }

      let existing: ExistingWorker | undefined;
      if (cpf && byCpf.has(cpf)) {
        const hit = byCpf.get(cpf)!;
        if (
          'servedClientId' in hit &&
          hit.servedClientId &&
          hit.servedClientId !== servedClientId
        ) {
          errors.push(
            'CPF ja cadastrado em outro cliente desta organizacao.',
          );
        } else {
          existing = hit;
          matchBy = 'cpf';
        }
      } else if (registration) {
        existing = byRegistration.get(normalizeMatchName(registration));
        if (existing) matchBy = 'registration';
      }

      if (existing) {
        action = 'update';
        existingWorkerId = existing.id;
        if (
          cpf &&
          byCpf.has(cpf) &&
          byCpf.get(cpf)!.id !== existing.id
        ) {
          errors.push('CPF ja pertence a outro trabalhador nesta organizacao.');
        }
      } else if (errors.length === 0) {
        action = 'create';
        if (
          registration &&
          byRegistration.has(normalizeMatchName(registration))
        ) {
          errors.push('Matricula ja cadastrada neste cliente.');
        }
      }

      if (errors.length === 0 && name && status) {
        payload = {
          name,
          cpf,
          registration,
          email: normalizeOptionalText(row.mapped.email),
          phone: normalizeOptionalText(row.mapped.phone),
          admissionDate: admission.iso,
          status,
          operationalUnitId: unitId,
          clientSectorId: sectorId,
          clientJobFunctionId: jobId,
          department: resolved.sectorName,
          role: resolved.jobFunctionName,
        };

        const wasActive = existing?.status === WorkerStatus.ACTIVE;
        const willBeActive = status === 'ACTIVE';
        if (willBeActive && !wasActive) {
          if (slotUsed >= life.allocated) {
            exceedsQuota = true;
            errors.push(
              `Cota de vidas esgotada (${life.allocated}). Nao e possivel ativar este trabalhador.`,
            );
            payload = null;
          } else {
            slotUsed += 1;
          }
        } else if (!willBeActive && wasActive) {
          slotUsed = Math.max(0, slotUsed - 1);
        }
      }

      const hasErrors = errors.length > 0;
      rows.push({
        rowNumber: row.rowNumber,
        status: hasErrors ? 'error' : 'valid',
        action: hasErrors ? null : action,
        matchBy: hasErrors ? null : matchBy,
        existingWorkerId: hasErrors ? null : existingWorkerId,
        exceedsQuota,
        errors,
        warnings,
        raw: row.raw,
        payload: hasErrors ? null : payload,
        resolved,
      });
    }

    const validRows = rows.filter((row) => row.status === 'valid');
    const activeDelta = slotUsed - life.used;

    const warnings: string[] = [];
    if (unknownSet.size > 0) {
      warnings.push(
        `Colunas ignoradas: ${Array.from(unknownSet).sort().join(', ')}.`,
      );
    }

    return {
      warnings,
      totals: {
        rowsRead: rows.length,
        valid: validRows.length,
        withErrors: rows.length - validRows.length,
        creates: validRows.filter((row) => row.action === 'create').length,
        updates: validRows.filter((row) => row.action === 'update').length,
        exceedQuota: rows.filter((row) => row.exceedsQuota).length,
      },
      lifeImpact: {
        allocated: life.allocated,
        currentlyUsed: life.used,
        availableBefore: life.available,
        activeDelta,
        availableAfter: Math.max(0, life.allocated - slotUsed),
      },
      rows,
    };
  }

  async confirm(
    organizationId: string,
    userId: string,
    servedClientId: string,
    rows: WorkerImportConfirmRowInput[],
  ): Promise<WorkerImportConfirmResponse> {
    await this.assertClient(organizationId, servedClientId);

    if (!rows?.length) {
      throw new BadRequestException('Nenhuma linha valida para confirmar.');
    }

    const structure = await this.loadStructure(organizationId, servedClientId);
    const [existingInClient, orgCpfWorkers] = await Promise.all([
      this.prisma.worker.findMany({
        where: { organizationId, servedClientId },
        select: { id: true, cpf: true, registration: true, status: true },
      }),
      this.prisma.worker.findMany({
        where: { organizationId, cpf: { not: null } },
        select: {
          id: true,
          cpf: true,
          registration: true,
          status: true,
          servedClientId: true,
        },
      }),
    ]);
    const byCpf = new Map(
      orgCpfWorkers
        .filter((w) => w.cpf)
        .map((w) => [w.cpf as string, w] as const),
    );
    const byRegistration = new Map(
      existingInClient
        .filter((w) => w.registration)
        .map(
          (w) =>
            [normalizeMatchName(w.registration as string), w] as const,
        ),
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ rowNumber: number; message: string }> = [];

    for (const row of rows) {
      try {
        const payload = this.revalidatePayload(
          row.payload,
          structure,
          byCpf,
          byRegistration,
        );

        const life = await this.getLifeSnapshot(organizationId, servedClientId);
        const cpfHit = payload.cpf ? byCpf.get(payload.cpf) : undefined;
        if (cpfHit && cpfHit.servedClientId !== servedClientId) {
          throw new BadRequestException(
            'CPF ja cadastrado em outro cliente desta organizacao.',
          );
        }
        const existing =
          (cpfHit && cpfHit.servedClientId === servedClientId
            ? cpfHit
            : undefined) ??
          (payload.registration
            ? byRegistration.get(normalizeMatchName(payload.registration))
            : undefined);

        if (existing) {
          const becomingActive =
            payload.status === 'ACTIVE' &&
            existing.status !== WorkerStatus.ACTIVE;
          if (becomingActive && life.used >= life.allocated) {
            throw new BadRequestException(
              `Cota de vidas esgotada (${life.allocated}).`,
            );
          }

          const worker = await this.prisma.worker.update({
            where: { id: existing.id },
            data: {
              name: payload.name,
              cpf: payload.cpf,
              registration: payload.registration,
              email: payload.email,
              phone: payload.phone,
              admissionDate: payload.admissionDate
                ? new Date(`${payload.admissionDate}T00:00:00.000Z`)
                : null,
              status: payload.status,
              operationalUnitId: payload.operationalUnitId,
              clientSectorId: payload.clientSectorId,
              clientJobFunctionId: payload.clientJobFunctionId,
              department: payload.department,
              role: payload.role,
            },
          });

          await this.audit.log({
            action: 'worker.import_updated',
            organizationId,
            userId,
            entityType: 'Worker',
            entityId: worker.id,
            metadata: {
              servedClientId,
              rowNumber: row.rowNumber,
              status: worker.status,
              registration: worker.registration,
              ...cpfAuditMeta(worker.cpf),
            },
          });

          byCpf.delete(existing.cpf ?? '');
          if (existing.registration) {
            byRegistration.delete(normalizeMatchName(existing.registration));
          }
          if (worker.cpf) byCpf.set(worker.cpf, worker);
          if (worker.registration) {
            byRegistration.set(normalizeMatchName(worker.registration), worker);
          }
          updated += 1;
        } else {
          if (payload.status === 'ACTIVE' && life.used >= life.allocated) {
            throw new BadRequestException(
              `Cota de vidas esgotada (${life.allocated}).`,
            );
          }

          const worker = await this.prisma.worker.create({
            data: {
              organizationId,
              servedClientId,
              name: payload.name,
              cpf: payload.cpf,
              registration: payload.registration,
              email: payload.email,
              phone: payload.phone,
              admissionDate: payload.admissionDate
                ? new Date(`${payload.admissionDate}T00:00:00.000Z`)
                : null,
              status: payload.status,
              operationalUnitId: payload.operationalUnitId,
              clientSectorId: payload.clientSectorId,
              clientJobFunctionId: payload.clientJobFunctionId,
              department: payload.department,
              role: payload.role,
            },
          });

          await this.audit.log({
            action: 'worker.import_created',
            organizationId,
            userId,
            entityType: 'Worker',
            entityId: worker.id,
            metadata: {
              servedClientId,
              rowNumber: row.rowNumber,
              status: worker.status,
              registration: worker.registration,
              ...cpfAuditMeta(worker.cpf),
            },
          });

          if (worker.cpf) byCpf.set(worker.cpf, worker);
          if (worker.registration) {
            byRegistration.set(normalizeMatchName(worker.registration), worker);
          }
          created += 1;
        }
      } catch (error) {
        skipped += 1;
        errors.push({
          rowNumber: row.rowNumber,
          message:
            error instanceof Error
              ? error.message
              : 'Falha ao importar a linha.',
        });
      }
    }

    await this.audit.log({
      action: 'worker.import_confirmed',
      organizationId,
      userId,
      entityType: 'ServedClient',
      entityId: servedClientId,
      metadata: {
        created,
        updated,
        skipped,
        errorCount: errors.length,
      },
    });

    const lifeSummary = await this.getLifeSnapshot(organizationId, servedClientId);
    const totalWorkers = await this.prisma.worker.count({
      where: { organizationId, servedClientId },
    });

    return {
      created,
      updated,
      skipped,
      errors,
      lifeSummary: {
        allocated: lifeSummary.allocated,
        used: lifeSummary.used,
        available: lifeSummary.available,
        activeWorkers: lifeSummary.used,
        totalWorkers,
      },
    };
  }

  private revalidatePayload(
    payload: WorkerImportNormalizedPayload,
    structure: StructureContext,
    byCpf: Map<string, ExistingWorker>,
    byRegistration: Map<string, ExistingWorker>,
  ): WorkerImportNormalizedPayload {
    const name = normalizeOptionalText(payload.name);
    if (!name || name.length < 2) {
      throw new BadRequestException('Nome invalido.');
    }

    let cpf: string | null = null;
    if (payload.cpf) {
      const digits = stripCpf(payload.cpf);
      if (!isValidCpf(digits)) {
        throw new BadRequestException('CPF invalido.');
      }
      cpf = digits;
    }

    const registration = normalizeOptionalText(payload.registration);
    const status = payload.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

    if (!payload.clientSectorId) {
      throw new BadRequestException('Setor e obrigatorio.');
    }
    if (!payload.clientJobFunctionId) {
      throw new BadRequestException('Funcao e obrigatoria.');
    }

    const sector = structure.sectors.find(
      (item) => item.id === payload.clientSectorId,
    );
    if (!sector) {
      throw new BadRequestException('Setor invalido para este cliente.');
    }

    const job = structure.jobs.find(
      (item) =>
        item.id === payload.clientJobFunctionId &&
        item.sectorId === sector.id,
    );
    if (!job) {
      throw new BadRequestException('Funcao invalida para o setor informado.');
    }

    let unitId: string | null = null;
    if (payload.operationalUnitId) {
      const unit = structure.units.find(
        (item) => item.id === payload.operationalUnitId,
      );
      if (!unit) {
        throw new BadRequestException('Unidade invalida para este cliente.');
      }
      unitId = unit.id;
    }

    const existingByCpf = cpf ? byCpf.get(cpf) : undefined;
    const existingByReg = registration
      ? byRegistration.get(normalizeMatchName(registration))
      : undefined;

    if (
      existingByCpf &&
      existingByReg &&
      existingByCpf.id !== existingByReg.id
    ) {
      throw new BadRequestException(
        'CPF e matricula apontam para trabalhadores diferentes.',
      );
    }

    const admission = parseAdmissionDateInput(payload.admissionDate);
    if (admission.error) {
      throw new BadRequestException(admission.error);
    }

    return {
      name,
      cpf,
      registration,
      email: normalizeOptionalText(payload.email),
      phone: normalizeOptionalText(payload.phone),
      admissionDate: admission.iso,
      status,
      operationalUnitId: unitId,
      clientSectorId: sector.id,
      clientJobFunctionId: job.id,
      department: sector.name,
      role: job.name,
    };
  }

  private async loadStructure(
    organizationId: string,
    servedClientId: string,
  ): Promise<StructureContext> {
    const [units, sectors, jobs] = await Promise.all([
      this.prisma.operationalUnit.findMany({
        where: { organizationId, servedClientId },
        select: { id: true, name: true },
      }),
      this.prisma.clientSector.findMany({
        where: { organizationId, servedClientId },
        select: {
          id: true,
          name: true,
          operationalUnitId: true,
          isActive: true,
        },
      }),
      this.prisma.clientJobFunction.findMany({
        where: { organizationId, servedClientId },
        select: {
          id: true,
          name: true,
          sectorId: true,
          isActive: true,
          sector: { select: { name: true } },
          epiRequirements: {
            where: { isActive: true },
            select: { epiNeedId: true },
          },
        },
      }),
    ]);

    return {
      units: units.map((unit) => ({
        id: unit.id,
        name: unit.name,
        match: normalizeMatchName(unit.name),
      })),
      sectors: sectors.map((sector) => ({
        id: sector.id,
        name: sector.name,
        match: normalizeMatchName(sector.name),
        operationalUnitId: sector.operationalUnitId,
        isActive: sector.isActive,
      })),
      jobs: jobs.map((job) => {
        const needIds = new Set(
          job.epiRequirements.map((req) => req.epiNeedId),
        );
        return {
          id: job.id,
          name: job.name,
          match: normalizeMatchName(job.name),
          sectorId: job.sectorId,
          sectorName: job.sector.name,
          isActive: job.isActive,
          requiredEpiCount: needIds.size,
        };
      }),
    };
  }

  private async getLifeSnapshot(
    organizationId: string,
    servedClientId: string,
  ) {
    const client = await this.assertClient(organizationId, servedClientId);
    const used = await this.prisma.worker.count({
      where: {
        organizationId,
        servedClientId,
        status: WorkerStatus.ACTIVE,
      },
    });
    return {
      allocated: client.allocatedLifeQuota,
      used,
      available: Math.max(0, client.allocatedLifeQuota - used),
    };
  }

  private async assertClient(organizationId: string, servedClientId: string) {
    const client = await this.prisma.servedClient.findFirst({
      where: { id: servedClientId, organizationId },
      select: { id: true, allocatedLifeQuota: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente atendido nao encontrado.');
    }
    return client;
  }
}
