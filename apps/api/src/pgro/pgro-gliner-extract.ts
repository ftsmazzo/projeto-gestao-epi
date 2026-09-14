import { randomUUID } from 'crypto';
import { OccupationalRiskCategory } from '@prisma/client';
import {
  isPgroStructureWeak,
  type PgroCompanyData,
  type PgroExtractedEpiNeed,
  type PgroExtractedFunction,
  type PgroExtractedRisk,
  type PgroExtractedSector,
  type PgroParseResult,
} from './pgro-parser';
import { clampPgroName } from './pgro-limits';

const RISK_CATEGORIES = new Set<string>(Object.values(OccupationalRiskCategory));

type FlexiblePayload = Record<string, unknown>;

function asObject(value: unknown): FlexiblePayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as FlexiblePayload;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value === 'string') {
    const cleaned = value.trim();
    return cleaned || null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asStringList(value: unknown): string[] {
  return asList(value)
    .map((item) => asTrimmedString(item))
    .filter((item): item is string => Boolean(item));
}

function asCategory(value: unknown): OccupationalRiskCategory {
  const raw = (asTrimmedString(value) ?? '').toUpperCase();
  if (RISK_CATEGORIES.has(raw)) return raw as OccupationalRiskCategory;
  return OccupationalRiskCategory.ACIDENTE;
}

function pickFirstObject(input: FlexiblePayload): FlexiblePayload {
  return (
    asObject(input.result) ??
    asObject(input.data) ??
    asObject(input.output) ??
    input
  );
}

function buildParseResultFromPayload(
  payloadRaw: unknown,
  base: PgroParseResult,
): PgroParseResult {
  const payload = asObject(payloadRaw) ?? {};
  const picked = pickFirstObject(payload);
  const companyObj = asObject(picked.company) ?? {};

  const sectors: PgroExtractedSector[] = asList(picked.sectors)
    .map((row) => {
      if (typeof row === 'string') return row.trim();
      return asTrimmedString(asObject(row)?.name);
    })
    .filter((name): name is string => Boolean(name && name.length >= 2))
    .map((name) => ({
      tempId: randomUUID(),
      name: name.toUpperCase(),
      rawText: name,
      included: true,
      confidence: 'low' as const,
      source: 'KEYWORD' as const,
      gheName: null,
    }));

  const functions: PgroExtractedFunction[] = [];
  for (const row of asList(picked.functions)) {
    const obj = asObject(row) ?? {};
    const name = asTrimmedString(obj.name);
    if (!name) continue;
    functions.push({
      tempId: randomUUID(),
      name,
      sectorName: asTrimmedString(obj.sectorName),
      activityDescription: asTrimmedString(obj.activityDescription),
      environmentDescription: asTrimmedString(obj.environmentDescription),
      gheName: null,
      rawText: name,
      included: true,
      confidence: 'low',
      source: 'KEYWORD',
    });
  }

  const risks: PgroExtractedRisk[] = [];
  for (const row of asList(picked.risks)) {
    const obj = asObject(row) ?? {};
    const rawName = asTrimmedString(obj.name);
    const name = clampPgroName(rawName ?? '');
    if (!name) continue;
    risks.push({
      tempId: randomUUID(),
      name,
      category: asCategory(obj.category),
      exposure: asTrimmedString(obj.exposure),
      source: asTrimmedString(obj.source),
      possibleDamage: null,
      riskLevel: null,
      functionNames: asStringList(obj.functionNames),
      rawText: rawName ?? name,
      included: true,
      confidence: 'low',
      extractionSource: 'KEYWORD',
      gheName: null,
    });
  }

  const epiNeeds: PgroExtractedEpiNeed[] = [];
  for (const row of asList(picked.epiNeeds)) {
    const obj = asObject(row) ?? {};
    const name =
      asTrimmedString(obj.name) ?? asTrimmedString(obj.extractedText) ?? '';
    if (!name || name.length < 2) continue;
    epiNeeds.push({
      tempId: randomUUID(),
      extractedText: asTrimmedString(obj.extractedText) ?? name,
      suggestedName: name,
      matchedEpiNeedId: null,
      matchedEpiNeedName: null,
      createNew: true,
      functionNames: asStringList(obj.functionNames),
      riskNames: asStringList(obj.riskNames),
      included: true,
      confidence: 'low',
      extractionSource: 'KEYWORD',
      gheName: null,
    });
  }

  const company: PgroCompanyData = {
    legalName: asTrimmedString(companyObj.legalName) ?? base.company.legalName,
    tradeName: asTrimmedString(companyObj.tradeName) ?? base.company.tradeName,
    cnpj: asTrimmedString(companyObj.cnpj) ?? base.company.cnpj,
    addressLine:
      asTrimmedString(companyObj.addressLine) ?? base.company.addressLine,
    city: asTrimmedString(companyObj.city) ?? base.company.city,
    state: asTrimmedString(companyObj.state) ?? base.company.state,
    cnae: asTrimmedString(companyObj.cnae) ?? base.company.cnae,
    riskGrade: asTrimmedString(companyObj.riskGrade) ?? base.company.riskGrade,
    employeeCount:
      asNullableNumber(companyObj.employeeCount) ?? base.company.employeeCount,
    rawText: base.company.rawText,
  };

  const warnings = asStringList(picked.warnings);
  return {
    company,
    sectors,
    functions,
    risks,
    epiNeeds,
    warnings:
      warnings.length > 0
        ? warnings
        : ['Extracao complementada por GLiNER local. Revise antes de confirmar.'],
    ignoredCandidates: [],
    textExtractable: base.textExtractable,
    textLength: base.textLength,
    layout: base.layout,
    parseMethod: 'HEURISTIC_PLUS_LLM',
    structureWeak: false,
  };
}

function pickTextForGliner(rawText: string, maxChars = 120_000): string {
  const text = rawText.replace(/\r/g, '\n');
  if (text.length <= maxChars) return text;
  const head = text.slice(0, Math.floor(maxChars * 0.65));
  const tail = text.slice(-Math.floor(maxChars * 0.35));
  return `${head}\n\n[...]\n\n${tail}`;
}

export async function extractPgroWithGlinerText(
  rawText: string,
  base: PgroParseResult,
): Promise<PgroParseResult | null> {
  const endpoint = process.env.GLINER_PGR_ENDPOINT?.trim();
  if (!endpoint) return null;
  const enabled = process.env.GLINER_PGR_ENABLED?.trim().toLowerCase();
  if (enabled === 'false') return null;

  const timeoutMs = Number(process.env.GLINER_PGR_TIMEOUT_MS ?? '25000');
  const apiKey = process.env.GLINER_PGR_API_KEY?.trim();
  const excerpt = pickTextForGliner(rawText);
  const body = {
    task: 'pgro_extract',
    language: 'pt-BR',
    schema: {
      company: [
        'legalName',
        'tradeName',
        'cnpj',
        'city',
        'state',
        'cnae',
        'riskGrade',
        'employeeCount',
      ],
      sectors: [{ name: 'string' }],
      functions: [
        {
          name: 'string',
          sectorName: 'string',
          activityDescription: 'string',
          environmentDescription: 'string',
        },
      ],
      risks: [
        {
          name: 'string',
          category:
            'FISICO|QUIMICO|BIOLOGICO|ERGONOMICO|ACIDENTE|MECANICO|PSICOSSOCIAL',
          exposure: 'string',
          source: 'string',
          functionNames: ['string'],
        },
      ],
      epiNeeds: [
        {
          name: 'string',
          extractedText: 'string',
          functionNames: ['string'],
          riskNames: ['string'],
        },
      ],
      warnings: ['string'],
    },
    text: excerpt,
    model: process.env.GLINER_PGR_MODEL?.trim() || null,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        ...base,
        warnings: [
          ...base.warnings,
          `GLiNER indisponivel (${res.status}). ${errText.slice(0, 160)}`,
        ],
        parseMethod: 'HEURISTIC',
      };
    }

    const payload = (await res.json()) as unknown;
    const parsed = buildParseResultFromPayload(payload, base);
    parsed.structureWeak = isPgroStructureWeak(parsed);
    return parsed;
  } catch (err) {
    return {
      ...base,
      warnings: [
        ...base.warnings,
        `GLiNER indisponivel na extracao: ${
          err instanceof Error ? err.message : String(err)
        }`,
      ],
      parseMethod: 'HEURISTIC',
    };
  } finally {
    clearTimeout(timer);
  }
}
