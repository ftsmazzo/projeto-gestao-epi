import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CaCertificateStatus,
  EpiCategory,
  EpiUnitOfMeasure,
  EpiUsefulLifeUnit,
} from '@prisma/client';
import type {
  EpiImportConfirmResponse,
  EpiImportConfirmRowInput,
  EpiImportNormalizedPayload,
  EpiImportPreviewResponse,
  EpiImportPreviewRow,
  EpiImportRowAction,
  EpiImportRowMatchBy,
} from '@gestao-epi/shared';
import { AuditService } from '../audit/audit.service';
import { EpiNeedsService } from '../epi-needs/epi-needs.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildTechnicalNotesFromCaepi,
  clampImportText,
  EPI_IMPORT_FIELD_LIMITS,
  mapCategory,
  mapCsvRecord,
  mapUnitOfMeasure,
  mapUsefulLifeUnit,
  normalizeCaNumber,
  normalizeOptionalText,
  parseCsvText,
  parseOptionalBoolean,
  parseOptionalDate,
  parseOptionalFloat,
  parseOptionalNonNegativeInt,
  suggestCategoryFromEquipment,
  suggestUnitFromEquipment,
} from './epi-import.utils';

type CaCertForEnrich = {
  caNumber: string;
  status: CaCertificateStatus;
  expiresAt: Date | null;
  equipmentName: string | null;
  equipmentDescription: string | null;
  manufacturerName: string | null;
  reference: string | null;
  color: string | null;
  approvedFor: string | null;
  restriction: string | null;
  analysisNotes: string | null;
  norms: Array<{
    standard: string | null;
    reportNumber: string | null;
    laboratoryName: string | null;
  }>;
};

type ExistingEpi = {
  id: string;
  name: string;
  caNumber: string | null;
  externalCode: string | null;
};

@Injectable()
export class EpiImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly epiNeeds: EpiNeedsService,
  ) {}

  async preview(
    organizationId: string,
    csvText: string,
  ): Promise<EpiImportPreviewResponse> {
    if (!csvText?.trim()) {
      throw new BadRequestException('Envie o conteudo CSV para a previa.');
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
      const mapped = mapCsvRecord(headers, cells);
      mapped.unknownColumns.forEach((col) => unknownSet.add(col));
      return { rowNumber: index + 2, ...mapped };
    });

    const caNumbers = [
      ...new Set(
        mappedRows
          .map((row) => normalizeCaNumber(row.mapped.caNumber))
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const [certificates, existingEpis] = await Promise.all([
      caNumbers.length
        ? this.prisma.caCertificate.findMany({
            where: { caNumber: { in: caNumbers } },
            include: {
              norms: {
                select: {
                  standard: true,
                  reportNumber: true,
                  laboratoryName: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      this.prisma.epiItem.findMany({
        where: { organizationId },
        select: { id: true, name: true, caNumber: true, externalCode: true },
      }),
    ]);

    const certByCa = new Map<string, CaCertForEnrich>(
      certificates.map((cert) => [cert.caNumber, cert]),
    );
    const byExternal = new Map<string, ExistingEpi>();
    const byCa = new Map<string, ExistingEpi>();
    for (const epi of existingEpis) {
      if (epi.externalCode) {
        byExternal.set(epi.externalCode.toLowerCase(), epi);
      }
      if (epi.caNumber) {
        byCa.set(epi.caNumber, epi);
      }
    }

    const seenExternal = new Map<string, number>();
    const seenCa = new Map<string, number>();
    const rows: EpiImportPreviewRow[] = [];

    for (const row of mappedRows) {
      const built = this.buildPreviewRow({
        rowNumber: row.rowNumber,
        mapped: row.mapped,
        certByCa,
        byExternal,
        byCa,
        seenExternal,
        seenCa,
      });
      rows.push(built);
    }

    const totals = {
      rowsRead: rows.length,
      valid: rows.filter((r) => r.ok).length,
      withErrors: rows.filter((r) => !r.ok).length,
      withWarnings: rows.filter((r) => r.warnings.length > 0).length,
      enrichedFromCaepi: rows.filter((r) => r.enrichedFromCaepi).length,
      caNotFound: rows.filter((r) => r.caNotFound).length,
      conflicts: rows.filter((r) => r.action === 'update').length,
    };

    return {
      unknownColumns: [...unknownSet],
      rows,
      totals,
    };
  }

  async confirm(
    organizationId: string,
    userId: string,
    rows: EpiImportConfirmRowInput[],
  ): Promise<EpiImportConfirmResponse> {
    if (!rows?.length) {
      throw new BadRequestException(
        'Nenhuma linha valida para confirmar a importacao.',
      );
    }

    let created = 0;
    let updated = 0;
    let variantsCreated = 0;
    let failed = 0;
    const errors: Array<{ rowNumber: number; message: string }> = [];

    for (const row of rows) {
      try {
        const result = await this.persistRow(
          organizationId,
          userId,
          row.payload,
        );
        if (result.action === 'create') {
          created += 1;
        } else {
          updated += 1;
        }
        variantsCreated += result.variantsCreated;
      } catch (err) {
        failed += 1;
        errors.push({
          rowNumber: row.rowNumber,
          message:
            err instanceof Error
              ? err.message
              : 'Falha ao gravar a linha da importacao.',
        });
      }
    }

    await this.audit.log({
      action: 'epi_item.import_confirmed',
      organizationId,
      userId,
      entityType: 'EpiImport',
      entityId: organizationId,
      metadata: {
        created,
        updated,
        variantsCreated,
        failed,
        rowCount: rows.length,
      },
    });

    return { created, updated, variantsCreated, failed, errors };
  }

  private buildPreviewRow(input: {
    rowNumber: number;
    mapped: ReturnType<typeof mapCsvRecord>['mapped'];
    certByCa: Map<string, CaCertForEnrich>;
    byExternal: Map<string, ExistingEpi>;
    byCa: Map<string, ExistingEpi>;
    seenExternal: Map<string, number>;
    seenCa: Map<string, number>;
  }): EpiImportPreviewRow {
    const errors: string[] = [];
    const warnings: string[] = [];
    let enrichedFromCaepi = false;
    let caNotFound = false;
    let caStatus: CaCertificateStatus | null = null;

    const caNumber = normalizeCaNumber(input.mapped.caNumber);
    const externalCode = normalizeOptionalText(input.mapped.externalCode);

    const requiresParsed = parseOptionalBoolean(input.mapped.requiresCa);
    if (!requiresParsed.ok) {
      errors.push(requiresParsed.message);
    }

    const dateParsed = parseOptionalDate(input.mapped.caExpiresAt);
    if (!dateParsed.ok) {
      errors.push(dateParsed.message);
    }

    const lifeValueParsed = parseOptionalNonNegativeInt(
      input.mapped.usefulLifeValue,
      'Vida util',
    );
    if (!lifeValueParsed.ok) {
      errors.push(lifeValueParsed.message);
    }

    const lifeUnitParsed = mapUsefulLifeUnit(input.mapped.usefulLifeUnit);
    if (!lifeUnitParsed.ok) {
      errors.push(lifeUnitParsed.message);
    }

    const unitParsed = mapUnitOfMeasure(input.mapped.unitOfMeasure);
    if (!unitParsed.ok) {
      errors.push(unitParsed.message);
    }

    const categoryParsed = mapCategory(input.mapped.category);
    if (!categoryParsed.ok) {
      errors.push(categoryParsed.message);
    }

    const nrrParsed = parseOptionalFloat(input.mapped.nrr, 'NRR');
    if (!nrrParsed.ok) {
      errors.push(nrrParsed.message);
    }
    const nrrsfParsed = parseOptionalFloat(input.mapped.nrrsf, 'NRRsf');
    if (!nrrsfParsed.ok) {
      errors.push(nrrsfParsed.message);
    }

    let name = normalizeOptionalText(input.mapped.name) ?? '';
    let description = normalizeOptionalText(input.mapped.description);
    let manufacturerName = normalizeOptionalText(input.mapped.manufacturerName);
    let reference = normalizeOptionalText(input.mapped.reference);
    let color = normalizeOptionalText(input.mapped.color);
    let approvedFor = normalizeOptionalText(input.mapped.approvedFor);
    let restriction = normalizeOptionalText(input.mapped.restriction);
    let technicalNotes = normalizeOptionalText(input.mapped.technicalNotes);
    let caExpiresAt = dateParsed.ok ? dateParsed.value : null;
    let category = categoryParsed.ok ? categoryParsed.value ?? null : null;
    let unitOfMeasure =
      unitParsed.ok && unitParsed.value
        ? unitParsed.value
        : EpiUnitOfMeasure.UNIDADE;
    const unitWasProvided = Boolean(unitParsed.ok && unitParsed.value);

    const requiresCa =
      requiresParsed.ok && requiresParsed.value !== undefined
        ? requiresParsed.value
        : Boolean(caNumber);

    if (caNumber) {
      const cert = input.certByCa.get(caNumber);
      if (!cert) {
        caNotFound = true;
        warnings.push(
          `CA ${caNumber} nao encontrado na base CAEPI local. A linha pode ser importada sem enriquecimento.`,
        );
      } else {
        caStatus = cert.status;
        enrichedFromCaepi = true;
        if (
          cert.status === CaCertificateStatus.VENCIDO ||
          cert.status === CaCertificateStatus.CANCELADO ||
          cert.status === CaCertificateStatus.SUSPENSO
        ) {
          warnings.push(
            `CA ${caNumber} com situacao ${cert.status} na base CAEPI.`,
          );
        }

        if (!name && cert.equipmentName?.trim()) {
          name = cert.equipmentName.trim();
        }
        if (!description && cert.equipmentDescription?.trim()) {
          description = cert.equipmentDescription.trim();
        }
        if (!manufacturerName && cert.manufacturerName?.trim()) {
          manufacturerName = cert.manufacturerName.trim();
        }
        if (!reference && cert.reference?.trim()) {
          reference = cert.reference.trim();
        }
        if (!color && cert.color?.trim()) {
          color = cert.color.trim().replace(/\.$/, '');
        }
        if (!approvedFor && cert.approvedFor?.trim()) {
          approvedFor = cert.approvedFor.trim();
        }
        if (!restriction && cert.restriction?.trim()) {
          restriction = cert.restriction.trim();
        }
        if (!technicalNotes) {
          technicalNotes = buildTechnicalNotesFromCaepi(cert);
        }
        if (!caExpiresAt && cert.expiresAt) {
          caExpiresAt = cert.expiresAt.toISOString().slice(0, 10);
        }
        if (!category) {
          category = suggestCategoryFromEquipment(cert.equipmentName);
        }
        if (!unitWasProvided) {
          unitOfMeasure = suggestUnitFromEquipment(cert.equipmentName);
        }
      }
    }

    if (!name || name.length < 2) {
      errors.push(
        'Nome obrigatorio (min. 2 caracteres), ou informe um CA encontrado na base CAEPI para preencher o equipamento.',
      );
    }

    if (requiresCa && !caNumber) {
      errors.push('Este EPI exige CA. Informe a coluna ca/caNumber.');
    }

    if (externalCode) {
      const prev = input.seenExternal.get(externalCode.toLowerCase());
      if (prev) {
        errors.push(
          `codigo_externo duplicado no CSV (tambem na linha ${prev}).`,
        );
      } else {
        input.seenExternal.set(externalCode.toLowerCase(), input.rowNumber);
      }
    }

    if (caNumber) {
      const prev = input.seenCa.get(caNumber);
      if (prev) {
        errors.push(`CA duplicado no CSV (tambem na linha ${prev}).`);
      } else {
        input.seenCa.set(caNumber, input.rowNumber);
      }
    }

    let action: EpiImportRowAction | null = null;
    let matchBy: EpiImportRowMatchBy | null = null;
    let existingEpiId: string | null = null;

    const existingByCode = externalCode
      ? input.byExternal.get(externalCode.toLowerCase())
      : undefined;
    const existingByCaNumber = caNumber ? input.byCa.get(caNumber) : undefined;

    if (
      existingByCode &&
      existingByCaNumber &&
      existingByCode.id !== existingByCaNumber.id
    ) {
      errors.push(
        'Conflito: codigo_externo e CA apontam para EPIs diferentes neste tenant.',
      );
    } else if (existingByCode) {
      action = 'update';
      matchBy = 'externalCode';
      existingEpiId = existingByCode.id;
      warnings.push(
        `Sera atualizado o EPI existente "${existingByCode.name}" (mesmo codigo_externo).`,
      );
    } else if (existingByCaNumber) {
      action = 'update';
      matchBy = 'caNumber';
      existingEpiId = existingByCaNumber.id;
      warnings.push(
        `Sera atualizado o EPI existente "${existingByCaNumber.name}" (mesmo CA).`,
      );
    } else if (errors.length === 0) {
      action = 'create';
    }

    const usefulLifeValue = lifeValueParsed.ok ? lifeValueParsed.value : null;
    let usefulLifeUnit: EpiUsefulLifeUnit | null = null;
    if (usefulLifeValue != null) {
      usefulLifeUnit =
        lifeUnitParsed.ok && lifeUnitParsed.value
          ? lifeUnitParsed.value
          : EpiUsefulLifeUnit.DIAS;
    }

    const size = normalizeOptionalText(input.mapped.size);
    const model = normalizeOptionalText(input.mapped.model);
    const side = normalizeOptionalText(input.mapped.side);
    const variantNotes = normalizeOptionalText(input.mapped.variantNotes);

    const clampedName = clampImportText(
      name,
      EPI_IMPORT_FIELD_LIMITS.name,
      'Nome',
    );
    const clampedDescription = clampImportText(
      description,
      EPI_IMPORT_FIELD_LIMITS.description,
      'Descricao',
    );
    const clampedManufacturer = clampImportText(
      manufacturerName,
      EPI_IMPORT_FIELD_LIMITS.manufacturerName,
      'Fabricante',
    );
    const clampedReference = clampImportText(
      reference,
      EPI_IMPORT_FIELD_LIMITS.reference,
      'Referencia',
    );
    const clampedColor = clampImportText(
      color,
      EPI_IMPORT_FIELD_LIMITS.color,
      'Cor',
    );
    const clampedApprovedFor = clampImportText(
      approvedFor,
      EPI_IMPORT_FIELD_LIMITS.approvedFor,
      'Aprovado para',
    );
    const clampedRestriction = clampImportText(
      restriction,
      EPI_IMPORT_FIELD_LIMITS.restriction,
      'Restricao',
    );
    const clampedTechnicalNotes = clampImportText(
      technicalNotes,
      EPI_IMPORT_FIELD_LIMITS.technicalNotes,
      'Observacoes tecnicas',
    );
    const clampedExternalCode = clampImportText(
      externalCode,
      EPI_IMPORT_FIELD_LIMITS.externalCode,
      'Codigo externo',
    );
    const clampedSize = clampImportText(
      size,
      EPI_IMPORT_FIELD_LIMITS.size,
      'Tamanho',
    );
    const clampedModel = clampImportText(
      model,
      EPI_IMPORT_FIELD_LIMITS.model,
      'Modelo',
    );
    const clampedSide = clampImportText(
      side,
      EPI_IMPORT_FIELD_LIMITS.side,
      'Lado',
    );
    const clampedVariantNotes = clampImportText(
      variantNotes,
      EPI_IMPORT_FIELD_LIMITS.variantNotes,
      'Observacao da variacao',
    );

    for (const clamped of [
      clampedName,
      clampedDescription,
      clampedManufacturer,
      clampedReference,
      clampedColor,
      clampedApprovedFor,
      clampedRestriction,
      clampedTechnicalNotes,
      clampedExternalCode,
      clampedSize,
      clampedModel,
      clampedSide,
      clampedVariantNotes,
    ]) {
      if (clamped.warning) {
        warnings.push(clamped.warning);
      }
    }

    name = clampedName.value ?? '';
    description = clampedDescription.value;
    manufacturerName = clampedManufacturer.value;
    reference = clampedReference.value;
    color = clampedColor.value;
    approvedFor = clampedApprovedFor.value;
    restriction = clampedRestriction.value;
    technicalNotes = clampedTechnicalNotes.value;
    const finalExternalCode = clampedExternalCode.value;
    const finalSize = clampedSize.value;
    const finalModel = clampedModel.value;
    const finalSide = clampedSide.value;
    const finalVariantNotes = clampedVariantNotes.value;
    const variantColor = color;
    const hasVariant = Boolean(
      finalSize || finalModel || variantColor || finalSide || finalVariantNotes,
    );

    const ok = errors.length === 0;
    const payload: EpiImportNormalizedPayload | null = ok
      ? {
          name,
          description,
          requiresCa,
          caNumber,
          caExpiresAt,
          unitOfMeasure,
          usefulLifeValue,
          usefulLifeUnit,
          category,
          externalCode: finalExternalCode,
          manufacturerName,
          reference,
          color,
          approvedFor,
          restriction,
          technicalNotes,
          nrr:
            category === EpiCategory.AUDITIVA
              ? nrrParsed.ok
                ? nrrParsed.value
                : null
              : null,
          nrrsf:
            category === EpiCategory.AUDITIVA
              ? nrrsfParsed.ok
                ? nrrsfParsed.value
                : null
              : null,
          variant: hasVariant
            ? {
                size: finalSize,
                color: variantColor,
                model: finalModel,
                side: finalSide,
                notes: finalVariantNotes,
              }
            : null,
        }
      : null;

    return {
      rowNumber: input.rowNumber,
      ok,
      errors,
      warnings,
      enrichedFromCaepi,
      caNotFound,
      caStatus,
      action: ok ? action : null,
      matchBy: ok ? matchBy : null,
      existingEpiId: ok ? existingEpiId : null,
      payload,
    };
  }

  private async persistRow(
    organizationId: string,
    userId: string,
    payload: EpiImportNormalizedPayload,
  ): Promise<{ action: EpiImportRowAction; variantsCreated: number }> {
    this.assertPayload(payload);

    const existing = await this.findMatch(organizationId, payload);
    const caExpiresAt = payload.caExpiresAt
      ? new Date(`${payload.caExpiresAt}T12:00:00.000Z`)
      : null;

    if (existing) {
      if (
        payload.caNumber &&
        existing.caNumber &&
        payload.caNumber !== existing.caNumber
      ) {
        const clash = await this.prisma.epiItem.findFirst({
          where: {
            organizationId,
            caNumber: payload.caNumber,
            NOT: { id: existing.id },
          },
          select: { id: true },
        });
        if (clash) {
          throw new BadRequestException(
            'Ja existe outro EPI com este CA nesta organizacao.',
          );
        }
      }

      const item = await this.prisma.epiItem.update({
        where: { id: existing.id },
        data: {
          name: payload.name,
          description: payload.description,
          requiresCa: payload.requiresCa,
          caNumber: payload.caNumber,
          caExpiresAt,
          unitOfMeasure: payload.unitOfMeasure,
          usefulLifeValue: payload.usefulLifeValue,
          usefulLifeUnit: payload.usefulLifeUnit,
          category: payload.category,
          externalCode: payload.externalCode,
          manufacturerName: payload.manufacturerName,
          reference: payload.reference,
          color: payload.color,
          approvedFor: payload.approvedFor,
          restriction: payload.restriction,
          technicalNotes: payload.technicalNotes,
          nrr: payload.nrr,
          nrrsf: payload.nrrsf,
        },
      });

      const variantsCreated = await this.ensureVariant(
        organizationId,
        item.id,
        payload,
      );

      await this.audit.log({
        action: 'epi_item.import_updated',
        organizationId,
        userId,
        entityType: 'EpiItem',
        entityId: item.id,
        metadata: {
          caNumber: item.caNumber,
          externalCode: item.externalCode,
          variantsCreated,
        },
      });

      await this.epiNeeds.autoLinkClearMatch(organizationId, userId, item.id, {
        name: payload.name,
        description: payload.description ?? undefined,
        category: payload.category ?? undefined,
        reference: payload.reference ?? undefined,
        color: payload.color ?? undefined,
        technicalNotes: payload.technicalNotes ?? undefined,
      });

      return { action: 'update', variantsCreated };
    }

    if (payload.caNumber) {
      const clash = await this.prisma.epiItem.findFirst({
        where: { organizationId, caNumber: payload.caNumber },
        select: { id: true },
      });
      if (clash) {
        throw new BadRequestException(
          'Ja existe um EPI com este CA nesta organizacao.',
        );
      }
    }

    const item = await this.prisma.epiItem.create({
      data: {
        organizationId,
        name: payload.name,
        description: payload.description,
        requiresCa: payload.requiresCa,
        caNumber: payload.caNumber,
        caExpiresAt,
        unitOfMeasure: payload.unitOfMeasure,
        usefulLifeValue: payload.usefulLifeValue,
        usefulLifeUnit: payload.usefulLifeUnit,
        category: payload.category,
        externalCode: payload.externalCode,
        manufacturerName: payload.manufacturerName,
        reference: payload.reference,
        color: payload.color,
        approvedFor: payload.approvedFor,
        restriction: payload.restriction,
        technicalNotes: payload.technicalNotes,
        nrr: payload.nrr,
        nrrsf: payload.nrrsf,
        variants: payload.variant
          ? {
              create: [
                {
                  organizationId,
                  size: payload.variant.size,
                  color: payload.variant.color,
                  model: payload.variant.model,
                  side: payload.variant.side,
                  notes: payload.variant.notes,
                  isActive: true,
                },
              ],
            }
          : undefined,
      },
    });

    await this.audit.log({
      action: 'epi_item.import_created',
      organizationId,
      userId,
      entityType: 'EpiItem',
      entityId: item.id,
      metadata: {
        caNumber: item.caNumber,
        externalCode: item.externalCode,
        hasVariant: Boolean(payload.variant),
      },
    });

    await this.epiNeeds.autoLinkClearMatch(organizationId, userId, item.id, {
      name: payload.name,
      description: payload.description ?? undefined,
      category: payload.category ?? undefined,
      reference: payload.reference ?? undefined,
      color: payload.color ?? undefined,
      technicalNotes: payload.technicalNotes ?? undefined,
    });

    return {
      action: 'create',
      variantsCreated: payload.variant ? 1 : 0,
    };
  }

  private async findMatch(
    organizationId: string,
    payload: EpiImportNormalizedPayload,
  ) {
    if (payload.externalCode) {
      const byCode = await this.prisma.epiItem.findFirst({
        where: {
          organizationId,
          externalCode: {
            equals: payload.externalCode,
            mode: 'insensitive',
          },
        },
        select: { id: true, caNumber: true, externalCode: true, name: true },
      });
      if (byCode) {
        return byCode;
      }
    }
    if (payload.caNumber) {
      return this.prisma.epiItem.findFirst({
        where: { organizationId, caNumber: payload.caNumber },
        select: { id: true, caNumber: true, externalCode: true, name: true },
      });
    }
    return null;
  }

  private async ensureVariant(
    organizationId: string,
    epiItemId: string,
    payload: EpiImportNormalizedPayload,
  ): Promise<number> {
    if (!payload.variant) {
      return 0;
    }
    const v = payload.variant;
    const existing = await this.prisma.epiVariant.findFirst({
      where: {
        organizationId,
        epiItemId,
        size: v.size,
        color: v.color,
        model: v.model,
        side: v.side,
      },
      select: { id: true },
    });
    if (existing) {
      return 0;
    }
    await this.prisma.epiVariant.create({
      data: {
        organizationId,
        epiItemId,
        size: v.size,
        color: v.color,
        model: v.model,
        side: v.side,
        notes: v.notes,
        isActive: true,
      },
    });
    return 1;
  }

  private assertPayload(payload: EpiImportNormalizedPayload): void {
    if (!payload.name?.trim() || payload.name.trim().length < 2) {
      throw new BadRequestException('Nome do EPI invalido na confirmacao.');
    }
    if (payload.requiresCa && !payload.caNumber) {
      throw new BadRequestException(
        'Linha exige CA, mas o numero nao foi informado.',
      );
    }
    if (
      payload.usefulLifeValue != null &&
      (!Number.isInteger(payload.usefulLifeValue) ||
        payload.usefulLifeValue < 0)
    ) {
      throw new BadRequestException('Vida util invalida na confirmacao.');
    }
  }
}
