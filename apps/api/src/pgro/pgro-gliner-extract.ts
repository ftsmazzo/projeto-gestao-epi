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

function pickEntityTexts(value: unknown): string[] {
  return asList(value)
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      const obj = asObject(item);
      if (!obj) return null;
      return (
        asTrimmedString(obj.text) ??
        asTrimmedString(obj.value) ??
        asTrimmedString(obj.label)
      );
    })
    .filter((item): item is string => Boolean(item && item.length > 0));
}

function normalizeGlinerEndpoint(raw: string): string {
  const input = raw.trim();
  if (!input) return input;
  try {
    const url = new URL(input);
    const path = (url.pathname || '/').replace(/\/+$/, '') || '/';
    if (
      path === '/' ||
      path === '/health' ||
      path === '/docs' ||
      path === '/openapi.json' ||
      path === '/v1/info'
    ) {
      url.pathname = '/v1/extract';
      return url.toString();
    }
    return url.toString();
  } catch {
    if (input.endsWith('/health')) return input.replace(/\/health$/, '/v1/extract');
    if (input.endsWith('/docs')) return input.replace(/\/docs$/, '/v1/extract');
    if (input.endsWith('/openapi.json')) {
      return input.replace(/\/openapi\.json$/, '/v1/extract');
    }
    return input;
  }
}

function buildParseResultFromPayload(
  payloadRaw: unknown,
  base: PgroParseResult,
): PgroParseResult {
  const payload = asObject(payloadRaw) ?? {};
  const picked = pickFirstObject(payload);
  const entitiesObj = asObject(picked.entities);
  const companyObj = asObject(picked.company) ?? {};

  const sectorsRaw = [
    ...asList(picked.sectors).map((row) =>
      typeof row === 'string' ? row.trim() : asTrimmedString(asObject(row)?.name),
    ),
    ...pickEntityTexts(entitiesObj?.sector),
    ...pickEntityTexts(entitiesObj?.setor),
  ];
  const sectors: PgroExtractedSector[] = sectorsRaw
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
  const functionRows = [
    ...asList(picked.functions),
    ...pickEntityTexts(entitiesObj?.function).map((name) => ({ name })),
    ...pickEntityTexts(entitiesObj?.funcao).map((name) => ({ name })),
  ];
  for (const row of functionRows) {
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
  const riskRows = [
    ...asList(picked.risks),
    ...pickEntityTexts(entitiesObj?.risk).map((name) => ({ name })),
    ...pickEntityTexts(entitiesObj?.risco).map((name) => ({ name })),
  ];
  for (const row of riskRows) {
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
  const epiRows = [
    ...asList(picked.epiNeeds),
    ...pickEntityTexts(entitiesObj?.epi).map((name) => ({ name })),
  ];
  for (const row of epiRows) {
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
    legalName:
      asTrimmedString(companyObj.legalName) ??
      pickEntityTexts(entitiesObj?.company)[0] ??
      base.company.legalName,
    tradeName: asTrimmedString(companyObj.tradeName) ?? base.company.tradeName,
    cnpj:
      asTrimmedString(companyObj.cnpj) ??
      pickEntityTexts(entitiesObj?.cnpj)[0] ??
      base.company.cnpj,
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
  const endpointRaw = process.env.GLINER_PGR_ENDPOINT?.trim();
  if (!endpointRaw) return null;
  const endpoint = normalizeGlinerEndpoint(endpointRaw);
  const enabled = process.env.GLINER_PGR_ENABLED?.trim().toLowerCase();
  if (enabled === 'false') return null;

  const timeoutMs = Number(process.env.GLINER_PGR_TIMEOUT_MS ?? '25000');
  const apiKey = process.env.GLINER_PGR_API_KEY?.trim();
  const excerpt = pickTextForGliner(rawText);
  const body = {
    entities: {
      sector: 'Setor/departamento do trabalhador no PGR',
      function: 'Cargo ou funcao de trabalho no PGR',
      risk: 'Agente de risco ocupacional citado no PGR',
      epi: 'EPI citado nas medidas de controle',
      company: 'Razao social da empresa cliente',
      cnpj: 'CNPJ da empresa cliente',
      cnae: 'CNAE da atividade principal',
      city: 'Cidade da empresa cliente',
      state: 'UF da empresa cliente',
      risk_grade: 'Grau de risco da atividade',
      employee_count: 'Quantidade de trabalhadores',
    },
    include_spans: false,
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
