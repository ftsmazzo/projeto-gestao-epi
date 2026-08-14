import {
  OccupationalRiskCategory,
  PgroExtractionAliasKind,
  Prisma,
} from '@prisma/client';
import type { ConfirmPgroImportDto } from './dto/pgro-import.dto';
import { normalizeTextKey, type PgroExtraAliasPack } from './pgro-parser';

type AliasRow = {
  kind: PgroExtractionAliasKind;
  rawNormalized: string;
  canonicalName: string;
  category: OccupationalRiskCategory | null;
};

export function buildExtraAliasPack(rows: AliasRow[]): PgroExtraAliasPack {
  const pack: PgroExtraAliasPack = {
    sectors: [],
    jobFunctions: [],
    risks: [],
    epiNeeds: [],
  };

  for (const row of rows) {
    const entry = {
      raw: row.rawNormalized,
      canonical: row.canonicalName,
    };
    switch (row.kind) {
      case PgroExtractionAliasKind.SECTOR:
        pack.sectors!.push(entry);
        break;
      case PgroExtractionAliasKind.JOB_FUNCTION:
        pack.jobFunctions!.push(entry);
        break;
      case PgroExtractionAliasKind.RISK:
        pack.risks!.push({
          ...entry,
          category: row.category,
        });
        break;
      case PgroExtractionAliasKind.EPI_NEED:
        pack.epiNeeds!.push(entry);
        break;
      default:
        break;
    }
  }
  return pack;
}

function shouldLearn(raw: string | null | undefined, canonical: string): boolean {
  const rawKey = normalizeTextKey(raw ?? '');
  const canKey = normalizeTextKey(canonical);
  if (!canKey || canKey.length < 2) return false;
  if (!rawKey || rawKey.length < 2) return false;
  return rawKey !== canKey;
}

async function upsertAlias(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    kind: PgroExtractionAliasKind;
    raw: string;
    canonical: string;
    category?: OccupationalRiskCategory | null;
    sourceRunId?: string | null;
  },
) {
  const rawNormalized = normalizeTextKey(input.raw);
  const canonicalName = input.canonical.trim();
  if (!rawNormalized || !canonicalName) return;

  await tx.pgroExtractionAlias.upsert({
    where: {
      organizationId_kind_rawNormalized: {
        organizationId: input.organizationId,
        kind: input.kind,
        rawNormalized,
      },
    },
    create: {
      organizationId: input.organizationId,
      kind: input.kind,
      rawNormalized,
      canonicalName,
      category: input.category ?? null,
      sourceRunId: input.sourceRunId ?? null,
      hitCount: 1,
      lastSeenAt: new Date(),
    },
    update: {
      canonicalName,
      category: input.category ?? undefined,
      sourceRunId: input.sourceRunId ?? undefined,
      hitCount: { increment: 1 },
      lastSeenAt: new Date(),
    },
  });
}

function asStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

/**
 * Persiste correcoes humanas do confirm para o proximo PGR da mesma org.
 */
export async function learnFromConfirm(
  tx: Prisma.TransactionClient,
  organizationId: string,
  runId: string,
  dto: ConfirmPgroImportDto,
  preview: {
    sectors?: Array<{ tempId?: string; name?: string; rawText?: string }> | null;
    functions?: Array<{
      tempId?: string;
      name?: string;
      rawText?: string;
    }> | null;
    risks?: Array<{
      tempId?: string;
      name?: string;
      rawText?: string;
    }> | null;
    epiNeeds?: Array<{
      tempId?: string;
      suggestedName?: string;
      extractedText?: string;
      matchedEpiNeedId?: string | null;
    }> | null;
  },
) {
  const sectorByTemp = new Map(
    (preview.sectors ?? []).map((s) => [s.tempId ?? '', s]),
  );
  const functionByTemp = new Map(
    (preview.functions ?? []).map((f) => [f.tempId ?? '', f]),
  );
  const riskByTemp = new Map(
    (preview.risks ?? []).map((r) => [r.tempId ?? '', r]),
  );
  const epiByTemp = new Map(
    (preview.epiNeeds ?? []).map((e) => [e.tempId ?? '', e]),
  );

  for (const sector of dto.sectors ?? []) {
    if (!sector.included) continue;
    const prev = sectorByTemp.get(sector.tempId);
    const raw = prev?.rawText || prev?.name || '';
    if (shouldLearn(raw, sector.name)) {
      await upsertAlias(tx, {
        organizationId,
        kind: PgroExtractionAliasKind.SECTOR,
        raw,
        canonical: sector.name,
        sourceRunId: runId,
      });
    }
  }

  for (const fn of dto.functions ?? []) {
    if (!fn.included) continue;
    const prev = functionByTemp.get(fn.tempId);
    const raw = prev?.rawText || prev?.name || '';
    if (shouldLearn(raw, fn.name)) {
      await upsertAlias(tx, {
        organizationId,
        kind: PgroExtractionAliasKind.JOB_FUNCTION,
        raw,
        canonical: fn.name,
        sourceRunId: runId,
      });
    }
  }

  for (const risk of dto.risks ?? []) {
    if (!risk.included) continue;
    const prev = riskByTemp.get(risk.tempId);
    const raw = prev?.rawText || prev?.name || '';
    if (shouldLearn(raw, risk.name)) {
      await upsertAlias(tx, {
        organizationId,
        kind: PgroExtractionAliasKind.RISK,
        raw,
        canonical: risk.name,
        category: risk.category,
        sourceRunId: runId,
      });
    }

    const existingRisk = await tx.occupationalRisk.findFirst({
      where: {
        organizationId,
        isActive: true,
        name: { equals: risk.name, mode: 'insensitive' },
      },
      select: { id: true, aliases: true },
    });
    if (existingRisk && raw && shouldLearn(raw, risk.name)) {
      const aliases = asStringArray(existingRisk.aliases);
      const rawTrim = raw.trim();
      if (
        rawTrim &&
        !aliases.some((a) => normalizeTextKey(a) === normalizeTextKey(rawTrim))
      ) {
        await tx.occupationalRisk.update({
          where: { id: existingRisk.id },
          data: {
            aliases: [...aliases, rawTrim] as Prisma.InputJsonValue,
          },
        });
      }
    }
  }

  for (const epi of dto.epiNeeds ?? []) {
    if (!epi.included) continue;
    const prev = epiByTemp.get(epi.tempId);
    const raw =
      prev?.extractedText || prev?.suggestedName || epi.suggestedName || '';
    const canonical = epi.suggestedName;
    if (shouldLearn(raw, canonical)) {
      await upsertAlias(tx, {
        organizationId,
        kind: PgroExtractionAliasKind.EPI_NEED,
        raw,
        canonical,
        sourceRunId: runId,
      });
    }

    const needId = epi.matchedEpiNeedId || prev?.matchedEpiNeedId;
    if (needId && raw && shouldLearn(raw, canonical)) {
      const need = await tx.epiNeed.findFirst({
        where: { id: needId, organizationId },
        select: { id: true, aliases: true },
      });
      if (need) {
        const aliases = asStringArray(need.aliases);
        const rawTrim = raw.trim();
        if (
          rawTrim &&
          !aliases.some(
            (a) => normalizeTextKey(a) === normalizeTextKey(rawTrim),
          )
        ) {
          await tx.epiNeed.update({
            where: { id: need.id },
            data: {
              aliases: [...aliases, rawTrim] as Prisma.InputJsonValue,
            },
          });
        }
      }
    }
  }
}

export { shouldLearn as shouldLearnAliasForTest };
