import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
  rowsRead: number;
  certificatesCreated: number;
  certificatesUpdated: number;
  normsCreated: number;
  rowsSkipped: number;
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

@Injectable()
export class CaepiService {
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

  async findByCaNumber(caNumberRaw: string) {
    const caNumber = normalizeCaNumber(caNumberRaw);
    if (!caNumber) {
      throw new BadRequestException('Informe um numero de CA valido.');
    }

    const certificate = await this.prisma.caCertificate.findUnique({
      where: { caNumber },
      include: {
        norms: {
          orderBy: [{ standard: 'asc' }, { reportNumber: 'asc' }],
        },
      },
    });

    if (!certificate) {
      return {
        found: false as const,
        certificate: null,
        message: `CA ${caNumber} nao encontrado na base CAEPI local.`,
      };
    }

    return {
      found: true as const,
      certificate,
      message: null,
    };
  }

  async importFromBuffer(
    buffer: Buffer,
    options: {
      organizationId: string;
      userId: string;
      membershipRole: string;
      originalName?: string;
    },
  ): Promise<CaepiImportResult> {
    this.assertCanImport(options.membershipRole);

    const startedAt = new Date();
    let parsed;
    try {
      parsed = await parseCaepiFile(buffer, options.originalName);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Arquivo invalido.',
      );
    }

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
      rowsRead: 0,
      certificatesCreated: 0,
      certificatesUpdated: 0,
      normsCreated: 0,
      rowsSkipped: 0,
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

    for (const [, group] of grouped) {
      const upserted = await this.upsertCertificateGroup(
        group.certificate,
        group.norms,
        startedAt,
      );
      if (upserted.created) {
        result.certificatesCreated += 1;
      } else {
        result.certificatesUpdated += 1;
      }
      result.normsCreated += upserted.normsCreated;
    }

    const finishedAt = new Date();
    result.finishedAt = finishedAt.toISOString();

    await this.audit.log({
      action: 'caepi.imported',
      organizationId: options.organizationId,
      userId: options.userId,
      entityType: 'CaCertificate',
      metadata: {
        originalName: options.originalName ?? null,
        sheetName: parsed.sheetName ?? null,
        ...result,
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
