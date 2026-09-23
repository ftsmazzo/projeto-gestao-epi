import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientWorkSiteStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { resolveCsvImportInput } from '../common/csv-text-encoding';
import { validateCnpj } from '../common/cnpj';
import { PrismaService } from '../prisma/prisma.service';

const ENDING_SOON_DAYS = 15;

export type UpsertWorkSiteInput = {
  name: string;
  description?: string | null;
  cnpj?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
};

@Injectable()
export class WorkSitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async requireObrasMode(organizationId: string, servedClientId: string) {
    const client = await this.prisma.servedClient.findFirst({
      where: { id: servedClientId, organizationId },
      select: { id: true, obrasModeEnabled: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente nao encontrado.');
    }
    if (!client.obrasModeEnabled) {
      throw new ForbiddenException(
        'Modulo Obras nao esta liberado para este cliente.',
      );
    }
    return client;
  }

  async list(organizationId: string, servedClientId: string) {
    await this.requireObrasMode(organizationId, servedClientId);
    const rows = await this.prisma.clientWorkSite.findMany({
      where: { organizationId, servedClientId },
      orderBy: [{ status: 'asc' }, { plannedEndAt: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { assignments: { where: { endAt: null } } },
        },
      },
    });
    const now = startOfUtcDay(new Date());
    const soonLimit = addUtcDays(now, ENDING_SOON_DAYS);
    return rows.map((row) => this.toDto(row, now, soonLimit));
  }

  async listEndingSoon(organizationId: string, servedClientId: string) {
    const all = await this.list(organizationId, servedClientId);
    return all.filter((row) => row.endingSoon);
  }

  async create(
    organizationId: string,
    servedClientId: string,
    userId: string,
    dto: UpsertWorkSiteInput,
  ) {
    await this.requireObrasMode(organizationId, servedClientId);
    const fields = this.parseFields(dto);
    const site = await this.prisma.clientWorkSite.create({
      data: {
        organizationId,
        servedClientId,
        name: fields.name,
        description: fields.description,
        cnpj: fields.cnpj,
        addressLine: fields.addressLine,
        city: fields.city,
        state: fields.state,
        plannedStartAt: fields.plannedStartAt,
        plannedEndAt: fields.plannedEndAt,
        status: ClientWorkSiteStatus.ACTIVE,
      },
    });
    await this.audit.log({
      action: 'work_site.created',
      organizationId,
      userId,
      entityType: 'ClientWorkSite',
      entityId: site.id,
      metadata: { servedClientId, name: site.name },
    });
    return this.toDto(site);
  }

  async update(
    organizationId: string,
    servedClientId: string,
    userId: string,
    id: string,
    dto: UpsertWorkSiteInput,
  ) {
    await this.requireObrasMode(organizationId, servedClientId);
    const existing = await this.getSite(organizationId, servedClientId, id);
    if (existing.status === ClientWorkSiteStatus.FINISHED) {
      throw new BadRequestException(
        'Obra finalizada nao pode ser editada. Cadastre nova obra se necessario.',
      );
    }
    const fields = this.parseFields({
      name: dto.name ?? existing.name,
      description:
        dto.description !== undefined ? dto.description : existing.description,
      cnpj: dto.cnpj !== undefined ? dto.cnpj : existing.cnpj,
      addressLine:
        dto.addressLine !== undefined ? dto.addressLine : existing.addressLine,
      city: dto.city !== undefined ? dto.city : existing.city,
      state: dto.state !== undefined ? dto.state : existing.state,
      plannedStartAt:
        dto.plannedStartAt !== undefined
          ? dto.plannedStartAt
          : existing.plannedStartAt?.toISOString().slice(0, 10) ?? null,
      plannedEndAt:
        dto.plannedEndAt !== undefined
          ? dto.plannedEndAt
          : existing.plannedEndAt?.toISOString().slice(0, 10) ?? null,
    });
    const site = await this.prisma.clientWorkSite.update({
      where: { id },
      data: fields,
    });
    await this.audit.log({
      action: 'work_site.updated',
      organizationId,
      userId,
      entityType: 'ClientWorkSite',
      entityId: site.id,
      metadata: {
        servedClientId,
        name: site.name,
        plannedEndAt: site.plannedEndAt?.toISOString() ?? null,
      },
    });
    return this.toDto(site);
  }

  /**
   * Finaliza manualmente. Nao ha encerramento automatico por data.
   * Fecha assignments abertos com endAt = hoje.
   */
  async finish(
    organizationId: string,
    servedClientId: string,
    userId: string,
    id: string,
  ) {
    await this.requireObrasMode(organizationId, servedClientId);
    const existing = await this.getSite(organizationId, servedClientId, id);
    if (existing.status === ClientWorkSiteStatus.FINISHED) {
      return this.toDto(existing);
    }
    const finishedAt = startOfUtcDay(new Date());
    const site = await this.prisma.$transaction(async (tx) => {
      await tx.workerWorkAssignment.updateMany({
        where: {
          organizationId,
          servedClientId,
          workSiteId: id,
          endAt: null,
        },
        data: { endAt: finishedAt },
      });
      return tx.clientWorkSite.update({
        where: { id },
        data: {
          status: ClientWorkSiteStatus.FINISHED,
          finishedAt,
        },
      });
    });
    await this.audit.log({
      action: 'work_site.finished',
      organizationId,
      userId,
      entityType: 'ClientWorkSite',
      entityId: site.id,
      metadata: {
        servedClientId,
        name: site.name,
        finishedAt: finishedAt.toISOString(),
      },
    });
    return this.toDto(site);
  }

  async assignWorker(
    organizationId: string,
    servedClientId: string,
    userId: string,
    input: { workerId: string; workSiteId: string; startAt?: string },
  ) {
    await this.requireObrasMode(organizationId, servedClientId);
    const site = await this.getSite(
      organizationId,
      servedClientId,
      input.workSiteId,
    );
    if (site.status !== ClientWorkSiteStatus.ACTIVE) {
      throw new BadRequestException(
        'Nao e possivel vincular trabalhador a obra finalizada.',
      );
    }
    const worker = await this.prisma.worker.findFirst({
      where: {
        id: input.workerId,
        organizationId,
        servedClientId,
      },
      select: { id: true, name: true },
    });
    if (!worker) {
      throw new NotFoundException('Trabalhador nao encontrado neste cliente.');
    }

    const startAt = input.startAt
      ? parseDay(input.startAt, 'Data de inicio')
      : startOfUtcDay(new Date());

    const open = await this.prisma.workerWorkAssignment.findFirst({
      where: {
        organizationId,
        servedClientId,
        workerId: worker.id,
        endAt: null,
      },
      include: { workSite: { select: { id: true, name: true } } },
    });
    if (open && open.workSiteId === site.id) {
      return this.assignmentDto({
        ...open,
        workSite: {
          id: open.workSite.id,
          name: open.workSite.name,
          cnpj: site.cnpj,
          status: site.status,
        },
      });
    }
    if (open) {
      // Fecha a obra atual no dia anterior ao inicio da nova (1 obra por vez).
      const closeAt = addUtcDays(startAt, -1);
      if (closeAt < startOfUtcDay(open.startAt)) {
        throw new BadRequestException(
          `Trabalhador ja esta na obra "${open.workSite.name}". Informe inicio posterior ao vinculo atual.`,
        );
      }
      await this.prisma.workerWorkAssignment.update({
        where: { id: open.id },
        data: { endAt: closeAt < open.startAt ? open.startAt : closeAt },
      });
    }

    const overlap = await this.findOverlap(
      organizationId,
      servedClientId,
      worker.id,
      startAt,
      null,
    );
    if (overlap) {
      throw new BadRequestException(
        'Trabalhador ja possui vinculo de obra neste periodo. Um trabalhador so pode estar em uma obra por vez.',
      );
    }

    const created = await this.prisma.workerWorkAssignment.create({
      data: {
        organizationId,
        servedClientId,
        workerId: worker.id,
        workSiteId: site.id,
        startAt,
        endAt: null,
      },
      include: {
        worker: { select: { id: true, name: true, registration: true } },
        workSite: {
          select: { id: true, name: true, cnpj: true, status: true },
        },
      },
    });
    await this.audit.log({
      action: 'work_assignment.created',
      organizationId,
      userId,
      entityType: 'WorkerWorkAssignment',
      entityId: created.id,
      metadata: {
        servedClientId,
        workerId: worker.id,
        workSiteId: site.id,
        startAt: startAt.toISOString(),
      },
    });
    return this.assignmentDto(created);
  }

  async listWorkerAssignments(
    organizationId: string,
    servedClientId: string,
    workerId: string,
  ) {
    await this.requireObrasMode(organizationId, servedClientId);
    const rows = await this.prisma.workerWorkAssignment.findMany({
      where: { organizationId, servedClientId, workerId },
      orderBy: { startAt: 'desc' },
      include: {
        workSite: {
          select: { id: true, name: true, cnpj: true, status: true },
        },
      },
    });
    return rows.map((row) => this.assignmentDto(row));
  }

  /** Assignments que intersectam o periodo da ficha. */
  async assignmentsInPeriod(
    organizationId: string,
    servedClientId: string,
    workerId: string,
    from: Date | null,
    to: Date | null,
  ) {
    const rows = await this.prisma.workerWorkAssignment.findMany({
      where: {
        organizationId,
        servedClientId,
        workerId,
        ...(from || to
          ? {
              AND: [
                ...(to ? [{ startAt: { lte: to } }] : []),
                {
                  OR: [
                    { endAt: null },
                    ...(from ? [{ endAt: { gte: from } }] : []),
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: { startAt: 'asc' },
      include: {
        workSite: {
          select: { id: true, name: true, cnpj: true, status: true },
        },
      },
    });
    return rows;
  }

  importTemplateCsv() {
    return [
      'nome,descricao,cnpj,endereco,cidade,uf,inicio,fim',
      'Obra Exemplo,Canteiro central,12345678000199,Rua A 100,Sao Paulo,SP,2026-01-01,2026-12-31',
    ].join('\n');
  }

  async previewImport(
    organizationId: string,
    servedClientId: string,
    input: { csvText?: string; csvBase64?: string },
  ) {
    await this.requireObrasMode(organizationId, servedClientId);
    const text = resolveCsvImportInput(input);
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length < 2) {
      throw new BadRequestException(
        'Planilha vazia. Inclua cabecalho e ao menos uma obra.',
      );
    }
    const header = splitCsvLine(lines[0]).map((h) =>
      foldHeader(h),
    );
    const idx = {
      name: findCol(header, ['nome', 'obra', 'name']),
      description: findCol(header, ['descricao', 'description', 'desc']),
      cnpj: findCol(header, ['cnpj']),
      addressLine: findCol(header, ['endereco', 'address', 'logradouro']),
      city: findCol(header, ['cidade', 'city']),
      state: findCol(header, ['uf', 'estado', 'state']),
      plannedStartAt: findCol(header, ['inicio', 'start', 'data_inicio']),
      plannedEndAt: findCol(header, ['fim', 'end', 'data_fim', 'termino']),
    };
    if (idx.name < 0) {
      throw new BadRequestException(
        'Coluna obrigatória "nome" nao encontrada no cabecalho.',
      );
    }
    const rows = lines.slice(1).map((line, i) => {
      const cols = splitCsvLine(line);
      const name = (cols[idx.name] ?? '').trim();
      const description =
        idx.description >= 0 ? emptyToNull(cols[idx.description]) : null;
      const cnpjRaw = idx.cnpj >= 0 ? emptyToNull(cols[idx.cnpj]) : null;
      const addressLine =
        idx.addressLine >= 0 ? emptyToNull(cols[idx.addressLine]) : null;
      const city = idx.city >= 0 ? emptyToNull(cols[idx.city]) : null;
      const state = idx.state >= 0 ? emptyToNull(cols[idx.state]) : null;
      const startRaw =
        idx.plannedStartAt >= 0 ? emptyToNull(cols[idx.plannedStartAt]) : null;
      const endRaw =
        idx.plannedEndAt >= 0 ? emptyToNull(cols[idx.plannedEndAt]) : null;
      const errors: string[] = [];
      if (!name || name.length < 2) errors.push('Nome obrigatorio.');
      let cnpj: string | null = null;
      if (cnpjRaw) {
        const validated = validateCnpj(cnpjRaw);
        if (!validated.ok) errors.push(validated.message);
        else cnpj = validated.normalized;
      }
      let plannedStartAt: string | null = null;
      let plannedEndAt: string | null = null;
      try {
        if (startRaw) plannedStartAt = parseDay(startRaw, 'Inicio').toISOString().slice(0, 10);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Inicio invalido.');
      }
      try {
        if (endRaw) plannedEndAt = parseDay(endRaw, 'Fim').toISOString().slice(0, 10);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Fim invalido.');
      }
      if (plannedStartAt && plannedEndAt && plannedStartAt > plannedEndAt) {
        errors.push('Inicio nao pode ser depois do fim.');
      }
      return {
        rowNumber: i + 2,
        name,
        description,
        cnpj,
        addressLine,
        city,
        state: state ? state.toUpperCase().slice(0, 2) : null,
        plannedStartAt,
        plannedEndAt,
        errors,
      };
    });
    return {
      totalRows: rows.length,
      validRows: rows.filter((r) => r.errors.length === 0).length,
      invalidRows: rows.filter((r) => r.errors.length > 0).length,
      rows,
    };
  }

  async confirmImport(
    organizationId: string,
    servedClientId: string,
    userId: string,
    input: { csvText?: string; csvBase64?: string },
  ) {
    const preview = await this.previewImport(
      organizationId,
      servedClientId,
      input,
    );
    if (preview.invalidRows > 0) {
      throw new BadRequestException(
        `Corrija ${preview.invalidRows} linha(s) invalida(s) antes de confirmar.`,
      );
    }
    const created = [];
    for (const row of preview.rows) {
      const site = await this.create(organizationId, servedClientId, userId, {
        name: row.name,
        description: row.description,
        cnpj: row.cnpj,
        addressLine: row.addressLine,
        city: row.city,
        state: row.state,
        plannedStartAt: row.plannedStartAt,
        plannedEndAt: row.plannedEndAt,
      });
      created.push(site);
    }
    return { created: created.length, sites: created };
  }

  private async getSite(
    organizationId: string,
    servedClientId: string,
    id: string,
  ) {
    const site = await this.prisma.clientWorkSite.findFirst({
      where: { id, organizationId, servedClientId },
    });
    if (!site) throw new NotFoundException('Obra nao encontrada.');
    return site;
  }

  private async findOverlap(
    organizationId: string,
    servedClientId: string,
    workerId: string,
    startAt: Date,
    endAt: Date | null,
  ) {
    return this.prisma.workerWorkAssignment.findFirst({
      where: {
        organizationId,
        servedClientId,
        workerId,
        startAt: { lte: endAt ?? new Date('9999-12-31') },
        OR: [{ endAt: null }, { endAt: { gte: startAt } }],
      },
    });
  }

  private parseFields(dto: UpsertWorkSiteInput) {
    const name = (dto.name ?? '').trim();
    if (!name || name.length < 2) {
      throw new BadRequestException('Nome da obra e obrigatorio.');
    }
    let cnpj: string | null = emptyToNull(dto.cnpj ?? null);
    if (cnpj) {
      const validated = validateCnpj(cnpj);
      if (!validated.ok) throw new BadRequestException(validated.message);
      cnpj = validated.normalized;
    }
    const plannedStartAt = dto.plannedStartAt
      ? parseDay(dto.plannedStartAt, 'Inicio previsto')
      : null;
    const plannedEndAt = dto.plannedEndAt
      ? parseDay(dto.plannedEndAt, 'Fim previsto')
      : null;
    if (plannedStartAt && plannedEndAt && plannedStartAt > plannedEndAt) {
      throw new BadRequestException(
        'Inicio previsto nao pode ser depois do fim previsto.',
      );
    }
    const state = emptyToNull(dto.state ?? null);
    return {
      name,
      description: emptyToNull(dto.description ?? null),
      cnpj,
      addressLine: emptyToNull(dto.addressLine ?? null),
      city: emptyToNull(dto.city ?? null),
      state: state ? state.toUpperCase().slice(0, 2) : null,
      plannedStartAt,
      plannedEndAt,
    };
  }

  private toDto(
    row: {
      id: string;
      organizationId: string;
      servedClientId: string;
      name: string;
      description: string | null;
      cnpj: string | null;
      addressLine: string | null;
      city: string | null;
      state: string | null;
      plannedStartAt: Date | null;
      plannedEndAt: Date | null;
      status: ClientWorkSiteStatus;
      finishedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      _count?: { assignments: number };
    },
    now = startOfUtcDay(new Date()),
    soonLimit = addUtcDays(startOfUtcDay(new Date()), ENDING_SOON_DAYS),
  ) {
    const endingSoon =
      row.status === ClientWorkSiteStatus.ACTIVE &&
      row.plannedEndAt != null &&
      row.plannedEndAt >= now &&
      row.plannedEndAt <= soonLimit;
    return {
      id: row.id,
      organizationId: row.organizationId,
      servedClientId: row.servedClientId,
      name: row.name,
      description: row.description,
      cnpj: row.cnpj,
      addressLine: row.addressLine,
      city: row.city,
      state: row.state,
      plannedStartAt: row.plannedStartAt?.toISOString() ?? null,
      plannedEndAt: row.plannedEndAt?.toISOString() ?? null,
      status: row.status,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      endingSoon,
      openAssignmentsCount: row._count?.assignments,
    };
  }

  private assignmentDto(row: {
    id: string;
    workerId: string;
    workSiteId: string;
    startAt: Date;
    endAt: Date | null;
    worker?: { id: string; name: string; registration: string | null };
    workSite?: {
      id: string;
      name: string;
      cnpj: string | null;
      status: ClientWorkSiteStatus;
    };
  }) {
    return {
      id: row.id,
      workerId: row.workerId,
      workSiteId: row.workSiteId,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt?.toISOString() ?? null,
      worker: row.worker,
      workSite: row.workSite,
    };
  }
}

function emptyToNull(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseDay(value: string, label: string) {
  const raw = value.trim();
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let y: number;
  let m: number;
  let d: number;
  if (br) {
    d = Number(br[1]);
    m = Number(br[2]);
    y = Number(br[3]);
  } else if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    throw new BadRequestException(
      `${label} deve estar em AAAA-MM-DD ou DD/MM/AAAA.`,
    );
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new BadRequestException(`${label} invalido.`);
  }
  return date;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if ((ch === ',' || ch === ';') && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function foldHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}

function findCol(header: string[], aliases: string[]) {
  for (const alias of aliases) {
    const idx = header.findIndex((h) => h === alias || h.includes(alias));
    if (idx >= 0) return idx;
  }
  return -1;
}
