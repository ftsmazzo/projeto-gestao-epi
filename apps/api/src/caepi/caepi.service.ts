import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  CaCertificateSource,
  CaCertificateStatus,
  MembershipRole,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CAEPI_HEADER_ALIASES,
  CAEPI_IMPORT_MAX_ERRORS,
  isBlankRow,
  normalizeCaNumber,
  normalizeHeaderKey,
  normalizeOptionalText,
  normalizeUniqueKey,
  parseCaepiDateValue,
  parseCaepiFile,
} from './caepi-import.utils';

export type CaepiImportError = {
  row: number;
  message: string;
};

export type CaepiImportResult = {
  fileName: string | null;
  sheetName: string | null;
  rowsRead: number;
  certificatesCreated: number;
  certificatesUpdated: number;
  normsCreated: number;
  rowsSkipped: number;
  certificatesTotalAfter: number;
  normsTotalAfter: number;
  errors: CaepiImportError[];
  startedAt: string;
  finishedAt: string;
};

type MappedRow = {
  caNumber: string;
  expiresAt: Date | null;
  status: CaCertificateStatus;
  processNumber: string | null;
  manufacturerCnpj: string | null;
  manufacturerName: string | null;
  nature: string | null;
  equipmentName: string | null;
  equipmentDescription: string | null;
  brand: string | null;
  reference: string | null;
  color: string | null;
  approvedFor: string | null;
  restriction: string | null;
  analysisNotes: string | null;
  laboratoryCnpj: string;
  laboratoryName: string | null;
  reportNumber: string;
  standard: string;
};

type CertificateDraft = Omit<
  MappedRow,
  'laboratoryCnpj' | 'laboratoryName' | 'reportNumber' | 'standard'
>;

type NormDraft = Pick<
  MappedRow,
  'laboratoryCnpj' | 'laboratoryName' | 'reportNumber' | 'standard'
>;

const REQUIRED_FIELDS = ['caNumber'] as const;
/** Abaixo disso consideramos a base vazia/incompleta para mensagens operacionais. */
export const CAEPI_BASE_INCOMPLETE_THRESHOLD = 1000;
const SEARCH_CANDIDATE_CAP = 120;
const UPSERT_BATCH_SIZE = 40;

@Injectable()
export class CaepiService {
  private readonly logger = new Logger(CaepiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  assertCanImport(membershipRole: string) {
    if (
      membershipRole !== MembershipRole.OWNER &&
      membershipRole !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Apenas OWNER ou ADMIN podem importar a base CAEPI.',
      );
    }
  }

  async getBaseCounts() {
    const [certificates, norms] = await Promise.all([
      this.prisma.caCertificate.count(),
      this.prisma.caCertificateNorm.count(),
    ]);
    return {
      certificates,
      norms,
      incomplete: certificates < CAEPI_BASE_INCOMPLETE_THRESHOLD,
    };
  }

  private incompleteBaseMessage(count: number) {
    if (count === 0) {
      return 'Base CAEPI local ainda nao importada ou incompleta. Acesse a tela Base CAEPI para atualizar a base oficial.';
    }
    if (count < CAEPI_BASE_INCOMPLETE_THRESHOLD) {
      return `Base CAEPI local ainda nao importada ou incompleta (${count} certificado(s)). Acesse a tela Base CAEPI para atualizar a base oficial.`;
    }
    return null;
  }

  async findByCaNumber(caNumberRaw: string) {
    const caNumber = normalizeCaNumber(caNumberRaw);
    if (!caNumber) {
      throw new BadRequestException('Informe um numero de CA valido.');
    }

    const [certificate, base] = await Promise.all([
      this.prisma.caCertificate.findUnique({
        where: { caNumber },
        include: {
          norms: {
            orderBy: [{ standard: 'asc' }, { reportNumber: 'asc' }],
          },
        },
      }),
      this.getBaseCounts(),
    ]);

    if (!certificate) {
      const incompleteMsg = this.incompleteBaseMessage(base.certificates);
      return {
        found: false as const,
        certificate: null,
        message:
          incompleteMsg ??
          `CA ${caNumber} nao encontrado na base CAEPI local.`,
        baseCertificateCount: base.certificates,
        baseIncomplete: base.incomplete,
      };
    }

    return {
      found: true as const,
      certificate,
      message: null,
      baseCertificateCount: base.certificates,
      baseIncomplete: base.incomplete,
    };
  }

  async searchCertificates(qRaw: string, limitRaw?: number) {
    const qTrimmed = (qRaw ?? '').trim();
    const qCa = normalizeCaNumber(qTrimmed);
    const limit = Math.min(
      Math.max(Number.isFinite(limitRaw) ? Number(limitRaw) : 10, 1),
      20,
    );

    const base = await this.getBaseCounts();

    if (qTrimmed.length < 3) {
      return {
        query: qTrimmed,
        items: [],
        baseCertificateCount: base.certificates,
        baseIncomplete: base.incomplete,
        message:
          'Informe ao menos 3 caracteres para buscar na base CAEPI local.',
      };
    }

    const incompleteMsg = this.incompleteBaseMessage(base.certificates);
    if (base.certificates === 0) {
      return {
        query: qTrimmed,
        items: [],
        baseCertificateCount: 0,
        baseIncomplete: true,
        message: incompleteMsg,
      };
    }

    const textTerm = qTrimmed;
    const candidates = await this.prisma.caCertificate.findMany({
      where: {
        OR: [
          { caNumber: { contains: qCa, mode: 'insensitive' } },
          { equipmentName: { contains: textTerm, mode: 'insensitive' } },
          { manufacturerName: { contains: textTerm, mode: 'insensitive' } },
          { reference: { contains: textTerm, mode: 'insensitive' } },
        ],
      },
      select: {
        caNumber: true,
        status: true,
        expiresAt: true,
        equipmentName: true,
        manufacturerName: true,
        reference: true,
        color: true,
        sourceImportedAt: true,
      },
      take: SEARCH_CANDIDATE_CAP,
    });

    const qCaLower = qCa.toLowerCase();
    const ranked = [...candidates].sort((a, b) => {
      const aExact = a.caNumber.toLowerCase() === qCaLower ? 0 : 1;
      const bExact = b.caNumber.toLowerCase() === qCaLower ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;

      const aPrefix = a.caNumber.toLowerCase().startsWith(qCaLower) ? 0 : 1;
      const bPrefix = b.caNumber.toLowerCase().startsWith(qCaLower) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;

      const aValid = a.status === CaCertificateStatus.VALIDO ? 0 : 1;
      const bValid = b.status === CaCertificateStatus.VALIDO ? 0 : 1;
      if (aValid !== bValid) return aValid - bValid;

      const aExp = a.expiresAt?.getTime() ?? 0;
      const bExp = b.expiresAt?.getTime() ?? 0;
      return bExp - aExp;
    });

    const items = ranked.slice(0, limit).map((item) => ({
      caNumber: item.caNumber,
      status: item.status,
      expiresAt: item.expiresAt,
      equipmentName: item.equipmentName,
      manufacturerName: item.manufacturerName,
      reference: item.reference,
      color: item.color,
      sourceImportedAt: item.sourceImportedAt,
    }));

    let message: string | null = null;
    if (items.length === 0) {
      message =
        incompleteMsg ??
        `Nenhum certificado encontrado para "${qTrimmed}" na base CAEPI local.`;
    } else if (incompleteMsg) {
      message = incompleteMsg;
    }

    return {
      query: qTrimmed,
      items,
      baseCertificateCount: base.certificates,
      baseIncomplete: base.incomplete,
      message,
    };
  }

  async importFromBuffer(
    buffer: Buffer,
    options: {
      organizationId: string | null;
      userId: string | null;
      membershipRole: string;
      originalName?: string;
      skipRoleCheck?: boolean;
      runId?: string;
      triggeredBy?: string;
      sourceUrl?: string | null;
    },
  ): Promise<CaepiImportResult> {
    if (!options.skipRoleCheck) {
      this.assertCanImport(options.membershipRole);
    }

    const startedAt = new Date();
    const fileName = options.originalName?.trim() || null;
    this.logger.log(
      `CAEPI import iniciado: file="${fileName ?? '(sem nome)'}" bytes=${buffer.length}`,
    );

    let parsed;
    try {
      parsed = await parseCaepiFile(buffer, options.originalName);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Arquivo invalido.',
      );
    }

    this.logger.log(
      `CAEPI arquivo lido: sheet="${parsed.sheetName ?? 'csv'}" dataRows=${parsed.rows.length}`,
    );

    let columnIndex: Map<string, number>;
    try {
      columnIndex = this.resolveColumnIndex(parsed.headers);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Cabecalho invalido na planilha CAEPI.',
      );
    }

    const result: CaepiImportResult = {
      fileName,
      sheetName: parsed.sheetName ?? null,
      rowsRead: 0,
      certificatesCreated: 0,
      certificatesUpdated: 0,
      normsCreated: 0,
      rowsSkipped: 0,
      certificatesTotalAfter: 0,
      normsTotalAfter: 0,
      errors: [],
      startedAt: startedAt.toISOString(),
      finishedAt: startedAt.toISOString(),
    };

    const grouped = new Map<
      string,
      { certificate: CertificateDraft; norms: NormDraft[] }
    >();

    const pushError = (row: number, message: string) => {
      result.rowsSkipped += 1;
      if (result.errors.length < CAEPI_IMPORT_MAX_ERRORS) {
        result.errors.push({ row, message });
      }
    };

    parsed.rows.forEach((cells, index) => {
      const rowNumber = index + 2;
      result.rowsRead += 1;

      if (isBlankRow(cells)) {
        pushError(rowNumber, 'Linha vazia ignorada.');
        return;
      }

      try {
        const mapped = this.mapRow(cells, columnIndex);
        if (!mapped.caNumber) {
          pushError(rowNumber, 'Linha sem NR Registro CA.');
          return;
        }

        const norm: NormDraft = {
          laboratoryCnpj: mapped.laboratoryCnpj,
          laboratoryName: mapped.laboratoryName,
          reportNumber: mapped.reportNumber,
          standard: mapped.standard,
        };

        const existing = grouped.get(mapped.caNumber);
        if (!existing) {
          grouped.set(mapped.caNumber, {
            certificate: {
              caNumber: mapped.caNumber,
              expiresAt: mapped.expiresAt,
              status: mapped.status,
              processNumber: mapped.processNumber,
              manufacturerCnpj: mapped.manufacturerCnpj,
              manufacturerName: mapped.manufacturerName,
              nature: mapped.nature,
              equipmentName: mapped.equipmentName,
              equipmentDescription: mapped.equipmentDescription,
              brand: mapped.brand,
              reference: mapped.reference,
              color: mapped.color,
              approvedFor: mapped.approvedFor,
              restriction: mapped.restriction,
              analysisNotes: mapped.analysisNotes,
            },
            norms: [norm],
          });
          return;
        }

        existing.norms.push(norm);
      } catch (error) {
        pushError(
          rowNumber,
          error instanceof Error ? error.message : 'Linha invalida.',
        );
      }
    });

    const groups = [...grouped.values()];
    this.logger.log(
      `CAEPI agrupado: uniqueCertificates=${groups.length} rowsRead=${result.rowsRead} skipped=${result.rowsSkipped}`,
    );

    for (let i = 0; i < groups.length; i += UPSERT_BATCH_SIZE) {
      const batch = groups.slice(i, i + UPSERT_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((group) =>
          this.upsertCertificateGroup(
            group.certificate,
            group.norms,
            startedAt,
          ),
        ),
      );
      for (const upserted of batchResults) {
        if (upserted.created) {
          result.certificatesCreated += 1;
        } else {
          result.certificatesUpdated += 1;
        }
        result.normsCreated += upserted.normsCreated;
      }

      if ((i + UPSERT_BATCH_SIZE) % 400 === 0 || i + UPSERT_BATCH_SIZE >= groups.length) {
        this.logger.log(
          `CAEPI upsert progresso: ${Math.min(i + UPSERT_BATCH_SIZE, groups.length)}/${groups.length}`,
        );
      }
    }

    const totals = await this.getBaseCounts();
    result.certificatesTotalAfter = totals.certificates;
    result.normsTotalAfter = totals.norms;

    const finishedAt = new Date();
    result.finishedAt = finishedAt.toISOString();

    this.logger.log(
      `CAEPI import concluido: file="${fileName}" rowsRead=${result.rowsRead} created=${result.certificatesCreated} updated=${result.certificatesUpdated} normsCreated=${result.normsCreated} totalCerts=${result.certificatesTotalAfter} totalNorms=${result.normsTotalAfter}`,
    );

    await this.audit.log({
      action: 'caepi.imported',
      organizationId: options.organizationId,
      userId: options.userId,
      entityType: 'CaCertificate',
      entityId: options.runId ?? null,
      metadata: {
        ...result,
        runId: options.runId ?? null,
        triggeredBy: options.triggeredBy ?? null,
        sourceUrl: options.sourceUrl ?? null,
        errorsTruncated: result.errors.length >= CAEPI_IMPORT_MAX_ERRORS,
      },
    });

    return result;
  }

  private resolveColumnIndex(headers: string[]) {
    const normalizedHeaders = headers.map((header) =>
      normalizeHeaderKey(header),
    );
    const indexByField = new Map<string, number>();

    for (const [field, aliases] of Object.entries(CAEPI_HEADER_ALIASES)) {
      const idx = normalizedHeaders.findIndex((header) =>
        aliases.includes(header),
      );
      if (idx >= 0) {
        indexByField.set(field, idx);
      }
    }

    for (const required of REQUIRED_FIELDS) {
      if (!indexByField.has(required)) {
        throw new BadRequestException(
          'Cabecalho invalido. Informe ao menos a coluna "NR Registro CA".',
        );
      }
    }

    return indexByField;
  }

  private mapRow(
    cells: string[],
    columnIndex: Map<string, number>,
  ): MappedRow {
    const get = (field: string) => {
      const idx = columnIndex.get(field);
      if (idx === undefined) {
        return null;
      }
      return normalizeOptionalText(cells[idx] ?? null);
    };

    const caNumberRaw = get('caNumber');
    const caNumber = caNumberRaw ? normalizeCaNumber(caNumberRaw) : '';
    const expiresRaw = get('expiresAt');
    const expiresAt = expiresRaw ? parseCaepiDateValue(expiresRaw) : null;
    if (expiresRaw && !expiresAt) {
      throw new Error(`Data de validade invalida: ${expiresRaw}`);
    }

    return {
      caNumber,
      expiresAt,
      status: this.mapStatus(get('status')),
      processNumber: get('processNumber'),
      manufacturerCnpj: get('manufacturerCnpj')
        ? normalizeCaNumber(get('manufacturerCnpj')!)
        : null,
      manufacturerName: get('manufacturerName'),
      nature: get('nature'),
      equipmentName: get('equipmentName'),
      equipmentDescription: get('equipmentDescription'),
      brand: get('brand'),
      reference: get('reference'),
      color: get('color'),
      approvedFor: get('approvedFor'),
      restriction: get('restriction'),
      analysisNotes: get('analysisNotes'),
      laboratoryCnpj: normalizeUniqueKey(
        get('laboratoryCnpj')
          ? normalizeCaNumber(get('laboratoryCnpj')!)
          : null,
      ),
      laboratoryName: get('laboratoryName'),
      reportNumber: normalizeUniqueKey(get('reportNumber')),
      standard: normalizeUniqueKey(get('standard')),
    };
  }

  private mapStatus(value: string | null): CaCertificateStatus {
    if (!value) {
      return CaCertificateStatus.DESCONHECIDO;
    }
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();

    switch (normalized) {
      case 'VALIDO':
        return CaCertificateStatus.VALIDO;
      case 'VENCIDO':
        return CaCertificateStatus.VENCIDO;
      case 'CANCELADO':
        return CaCertificateStatus.CANCELADO;
      case 'SUSPENSO':
        return CaCertificateStatus.SUSPENSO;
      default:
        return CaCertificateStatus.DESCONHECIDO;
    }
  }

  private async upsertCertificateGroup(
    certificate: CertificateDraft,
    norms: NormDraft[],
    importedAt: Date,
  ) {
    const data: Prisma.CaCertificateUncheckedCreateInput = {
      caNumber: certificate.caNumber,
      expiresAt: certificate.expiresAt,
      status: certificate.status,
      processNumber: certificate.processNumber,
      manufacturerCnpj: certificate.manufacturerCnpj,
      manufacturerName: certificate.manufacturerName,
      nature: certificate.nature,
      equipmentName: certificate.equipmentName,
      equipmentDescription: certificate.equipmentDescription,
      brand: certificate.brand,
      reference: certificate.reference,
      color: certificate.color,
      approvedFor: certificate.approvedFor,
      restriction: certificate.restriction,
      analysisNotes: certificate.analysisNotes,
      source: CaCertificateSource.CAEPI_OFICIAL,
      sourceImportedAt: importedAt,
    };

    const existing = await this.prisma.caCertificate.findUnique({
      where: { caNumber: certificate.caNumber },
      select: { id: true },
    });

    const saved = existing
      ? await this.prisma.caCertificate.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.caCertificate.create({ data });

    let normsCreated = 0;
    const uniqueNorms = new Map<string, NormDraft>();
    for (const norm of norms) {
      const key = `${norm.laboratoryCnpj}|${norm.reportNumber}|${norm.standard}`;
      if (!uniqueNorms.has(key)) {
        uniqueNorms.set(key, norm);
      }
    }

    for (const norm of uniqueNorms.values()) {
      try {
        await this.prisma.caCertificateNorm.create({
          data: {
            certificateId: saved.id,
            laboratoryCnpj: norm.laboratoryCnpj,
            laboratoryName: norm.laboratoryName,
            reportNumber: norm.reportNumber,
            standard: norm.standard,
          },
        });
        normsCreated += 1;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }

    return {
      created: !existing,
      normsCreated,
    };
  }
}
