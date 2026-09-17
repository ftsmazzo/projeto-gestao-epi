import { randomUUID } from 'crypto';
import { OccupationalRiskCategory } from '@prisma/client';
import {
  isPgroStructureWeak,
  normalizeTextKey,
  type PgroCompanyData,
  type PgroExtractedEpiNeed,
  type PgroExtractedFunction,
  type PgroExtractedRisk,
  type PgroExtractedSector,
  type PgroParseResult,
} from './pgro-parser';
import { clampPgroName } from './pgro-limits';
import {
  collapseExtractedEpiLabels,
} from '../epi-needs/epi-need-canonical';
import {
  PgroResponseTooLargeError,
  readResponseTextWithLimit,
} from './pgro-http-response';

const RISK_CATEGORIES = new Set<string>(Object.values(OccupationalRiskCategory));
const MAX_MODEL_ITEMS = 500;
const MAX_EPI_LABELS_PER_ITEM = 20;
const MAX_EXTRACTED_EPIS = 500;
const MAX_ASSOCIATIONS_PER_ITEM = 100;
const MAX_MODEL_RESPONSE_BYTES = 2_000_000;

type LlmCompany = Partial<PgroCompanyData>;
type LlmSector = { name?: string };
type LlmFunction = {
  name?: string;
  sectorName?: string | null;
  activityDescription?: string | null;
  environmentDescription?: string | null;
};
type LlmRisk = {
  name?: string;
  category?: string;
  exposure?: string | null;
  source?: string | null;
  functionNames?: string[];
};
type LlmEpi = {
  name?: string;
  extractedText?: string;
  functionNames?: string[];
  riskNames?: string[];
};

type LlmPayload = {
  company?: LlmCompany;
  sectors?: LlmSector[];
  functions?: LlmFunction[];
  risks?: LlmRisk[];
  epiNeeds?: LlmEpi[];
  warnings?: string[];
};

type PgroLlmSourceKind = 'PDF' | 'DOCX' | 'DOC';

function sanitizeExtractedEpiNeeds(
  epi: PgroExtractedEpiNeed,
): PgroExtractedEpiNeed[] {
  return collapseExtractedEpiLabels([epi.suggestedName])
    .slice(0, MAX_EPI_LABELS_PER_ITEM)
    .map((suggestedName, index) => ({
      ...epi,
      tempId: index === 0 ? epi.tempId : randomUUID(),
      suggestedName,
    }));
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
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function pickText(payload: unknown, fallback: string | null): string | null {
  return asTrimmedString(payload) ?? fallback;
}

function pickTextForLlm(rawText: string, maxChars = 70_000): string {
  const text = rawText.replace(/\r/g, '\n');
  if (text.length <= maxChars) return text;
  const head = text.slice(0, Math.floor(maxChars * 0.55));
  const tailBudget = maxChars - head.length;
  const interesting = text.match(
    /[\s\S]{0,800}(?:GHE|APRHO|SETOR|FUN[CÇ][AÃ]O|CARGO|EPI|RISCO|CA\b)[\s\S]{0,1200}/gi,
  );
  const mid = (interesting ?? []).join('\n---\n').slice(0, Math.floor(tailBudget * 0.7));
  const tail = text.slice(-Math.max(2000, tailBudget - mid.length));
  return `${head}\n\n[...]\n\n${mid}\n\n[...]\n\n${tail}`;
}

function asCategory(value: string | undefined): OccupationalRiskCategory {
  const raw = (value ?? '').toUpperCase().trim();
  if (RISK_CATEGORIES.has(raw)) {
    return raw as OccupationalRiskCategory;
  }
  return OccupationalRiskCategory.ACIDENTE;
}

function llmToParseResult(
  payload: LlmPayload,
  base: PgroParseResult,
): PgroParseResult {
  const sectors: PgroExtractedSector[] = (payload.sectors ?? [])
    .slice(0, MAX_MODEL_ITEMS)
    .map((s) => (s.name ?? '').trim())
    .filter((name) => name.length >= 2)
    .map((name) => ({
      tempId: randomUUID(),
      name: name.toUpperCase(),
      rawText: name,
      included: true,
      confidence: 'low' as const,
      source: 'KEYWORD' as const,
      gheName: null,
    }));

  const functions: PgroExtractedFunction[] = (payload.functions ?? [])
    .slice(0, MAX_MODEL_ITEMS)
    .map((fn) => ({
      tempId: randomUUID(),
      name: (fn.name ?? '').trim(),
      sectorName: fn.sectorName?.trim() || null,
      activityDescription: fn.activityDescription?.trim() || null,
      environmentDescription: fn.environmentDescription?.trim() || null,
      gheName: null,
      rawText: (fn.name ?? '').trim(),
      included: true,
      confidence: 'low' as const,
      source: 'KEYWORD' as const,
    }))
    .filter((fn) => fn.name.length >= 2);

  const risks: PgroExtractedRisk[] = (payload.risks ?? [])
    .slice(0, MAX_MODEL_ITEMS)
    .map((risk) => {
      const name = clampPgroName((risk.name ?? '').trim());
      return {
      tempId: randomUUID(),
      name,
      category: asCategory(risk.category),
      exposure: risk.exposure?.trim() || null,
      source: risk.source?.trim() || null,
      possibleDamage: null,
      riskLevel: null,
      functionNames: Array.isArray(risk.functionNames)
        ? risk.functionNames
            .filter((n) => typeof n === 'string' && n.trim())
            .slice(0, MAX_ASSOCIATIONS_PER_ITEM)
        : [],
      rawText: (risk.name ?? '').trim(),
      included: true,
      confidence: 'low' as const,
      extractionSource: 'KEYWORD' as const,
      gheName: null,
    };
    })
    .filter((r) => r.name.length >= 2);

  const epiNeeds: PgroExtractedEpiNeed[] = [];
  for (const epi of (payload.epiNeeds ?? []).slice(0, MAX_MODEL_ITEMS)) {
    if (epiNeeds.length >= MAX_EXTRACTED_EPIS) break;
    const extractedText = (epi.extractedText ?? epi.name ?? '').trim();
    const names = collapseExtractedEpiLabels([
      (epi.name ?? epi.extractedText ?? '').trim(),
    ]).slice(0, MAX_EPI_LABELS_PER_ITEM);
    for (const name of names) {
      if (epiNeeds.length >= MAX_EXTRACTED_EPIS) break;
      epiNeeds.push({
        tempId: randomUUID(),
        extractedText: extractedText || name,
        suggestedName: name,
        matchedEpiNeedId: null,
        matchedEpiNeedName: null,
        createNew: true,
        functionNames: Array.isArray(epi.functionNames)
          ? epi.functionNames
              .filter((n) => typeof n === 'string' && n.trim())
              .slice(0, MAX_ASSOCIATIONS_PER_ITEM)
          : [],
        riskNames: Array.isArray(epi.riskNames)
          ? epi.riskNames
              .filter((n) => typeof n === 'string' && n.trim())
              .slice(0, MAX_ASSOCIATIONS_PER_ITEM)
          : [],
        included: true,
        confidence: 'low' as const,
        extractionSource: 'KEYWORD' as const,
        gheName: null,
      });
    }
  }

  const company: PgroCompanyData = {
    legalName: pickText(payload.company?.legalName, base.company.legalName),
    tradeName: pickText(payload.company?.tradeName, base.company.tradeName),
    cnpj: pickText(payload.company?.cnpj, base.company.cnpj),
    addressLine: pickText(
      payload.company?.addressLine,
      base.company.addressLine,
    ),
    city: pickText(payload.company?.city, base.company.city),
    state: pickText(payload.company?.state, base.company.state),
    cnae: pickText(payload.company?.cnae, base.company.cnae),
    riskGrade: pickText(payload.company?.riskGrade, base.company.riskGrade),
    employeeCount: (() => {
      const fromLlm = asNullableNumber(payload.company?.employeeCount);
      return fromLlm ?? base.company.employeeCount;
    })(),
    rawText: base.company.rawText,
  };

  return {
    company,
    sectors,
    functions,
    risks,
    epiNeeds,
    warnings: [
      ...(payload.warnings ?? []),
      'Extracao complementada por IA (texto do PDF). Revise antes de confirmar.',
    ],
    ignoredCandidates: [],
    textExtractable: base.textExtractable,
    textLength: base.textLength,
    layout: base.layout,
    parseMethod: 'HEURISTIC_PLUS_LLM',
    structureWeak: false,
  };
}

/**
 * Preenche buracos da heuristica com resultado LLM.
 * Nao remove itens high-confidence ja encontrados — salvo quando
 * preferLlmStructure=true (heuristic duvidosa: troca estrutura pela IA).
 */
export function mergePgroParseResults(
  heuristic: PgroParseResult,
  llm: PgroParseResult,
  options?: { preferLlmStructure?: boolean },
): PgroParseResult {
  const preferLlm = Boolean(options?.preferLlmStructure);

  const dropLevelSectors = (sectors: PgroExtractedSector[]) =>
    sectors.filter((s) => !/\b(j[uú]nior|junior|pleno|s[eê]nior|senior)\b/i.test(s.name));

  let sectors: PgroExtractedSector[];
  let functions: PgroExtractedFunction[];

  if (preferLlm && llm.sectors.length > 0) {
    sectors = dropLevelSectors(llm.sectors);
    functions =
      llm.functions.length > 0 ? llm.functions : heuristic.functions;
  } else {
    const sectorKeys = new Set(
      heuristic.sectors.map((s) => normalizeTextKey(s.name)),
    );
    sectors = dropLevelSectors([
      ...heuristic.sectors,
      ...llm.sectors.filter((s) => !sectorKeys.has(normalizeTextKey(s.name))),
    ]);

    const fnKeys = new Set(
      heuristic.functions.map(
        (f) =>
          `${normalizeTextKey(f.sectorName ?? '')}::${normalizeTextKey(f.name)}`,
      ),
    );
    functions = [
      ...heuristic.functions,
      ...llm.functions.filter(
        (f) =>
          !fnKeys.has(
            `${normalizeTextKey(f.sectorName ?? '')}::${normalizeTextKey(f.name)}`,
          ),
      ),
    ];
  }

  const riskByName = new Map(
    heuristic.risks.map((r) => [normalizeTextKey(r.name), r] as const),
  );
  for (const risk of llm.risks) {
    const key = normalizeTextKey(risk.name);
    const existing = riskByName.get(key);
    if (!existing) {
      riskByName.set(key, risk);
      continue;
    }
    existing.functionNames = [
      ...new Set([...existing.functionNames, ...risk.functionNames]),
    ].slice(0, MAX_ASSOCIATIONS_PER_ITEM);
    if (!existing.source && risk.source) existing.source = risk.source;
    if (!existing.exposure && risk.exposure) existing.exposure = risk.exposure;
  }
  const risks = [...riskByName.values()];

  const epiByName = new Map<string, PgroExtractedEpiNeed>();
  for (const rawEpi of heuristic.epiNeeds) {
    for (const epi of sanitizeExtractedEpiNeeds(rawEpi)) {
      epiByName.set(normalizeTextKey(epi.suggestedName), epi);
    }
  }
  for (const rawEpi of llm.epiNeeds) {
    for (const epi of sanitizeExtractedEpiNeeds(rawEpi)) {
      const key = normalizeTextKey(epi.suggestedName);
      const existing = epiByName.get(key);
      if (!existing) {
        epiByName.set(key, epi);
        continue;
      }
      existing.functionNames = [
        ...new Set([...existing.functionNames, ...epi.functionNames]),
      ].slice(0, MAX_ASSOCIATIONS_PER_ITEM);
      existing.riskNames = [
        ...new Set([...(existing.riskNames ?? []), ...(epi.riskNames ?? [])]),
      ].slice(0, MAX_ASSOCIATIONS_PER_ITEM);
    }
  }
  const epiNeeds = [...epiByName.values()];

  const company: PgroCompanyData = {
    legalName: heuristic.company.legalName ?? llm.company.legalName,
    tradeName: heuristic.company.tradeName ?? llm.company.tradeName,
    cnpj: heuristic.company.cnpj ?? llm.company.cnpj,
    addressLine: heuristic.company.addressLine ?? llm.company.addressLine,
    city: heuristic.company.city ?? llm.company.city,
    state: heuristic.company.state ?? llm.company.state,
    cnae: heuristic.company.cnae ?? llm.company.cnae,
    riskGrade: heuristic.company.riskGrade ?? llm.company.riskGrade,
    employeeCount:
      heuristic.company.employeeCount ?? llm.company.employeeCount,
    rawText: heuristic.company.rawText ?? llm.company.rawText,
  };

  const merged: PgroParseResult = {
    company,
    sectors,
    functions,
    risks,
    epiNeeds,
    warnings: [
      ...heuristic.warnings,
      ...llm.warnings.filter((w) => !heuristic.warnings.includes(w)),
    ],
    ignoredCandidates: heuristic.ignoredCandidates,
    textExtractable: heuristic.textExtractable,
    textLength: heuristic.textLength,
    layout: heuristic.layout,
    parseMethod: 'HEURISTIC_PLUS_LLM',
    structureWeak: false,
  };
  merged.structureWeak = isPgroStructureWeak(merged);
  return merged;
}

function resolveLlmConfig(sourceKind?: PgroLlmSourceKind):
  | {
      provider: 'openrouter' | 'openai';
      endpoint: string;
      model: string;
      headers: Record<string, string>;
    }
  | null {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    const model =
      (sourceKind === 'PDF'
        ? process.env.OPENROUTER_PGR_MODEL_PDF?.trim()
        : null) ||
      process.env.OPENROUTER_PGR_MODEL?.trim() ||
      'mistralai/mistral-small-3.2-24b-instruct:free';
    const endpoint =
      process.env.OPENROUTER_BASE_URL?.trim() ||
      'https://openrouter.ai/api/v1/chat/completions';
    const referer =
      process.env.PUBLIC_WEB_URL?.trim() ||
      process.env.CLIENT_PORTAL_URL?.trim() ||
      'https://prontepi.local';
    return {
      provider: 'openrouter',
      endpoint,
      model,
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': referer,
        'X-Title': 'ProntEPI PGRO Extractor',
      },
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openAiKey) return null;
  return {
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: process.env.OPENAI_PGR_MODEL?.trim() || 'gpt-4o-mini',
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
  };
}

function extractTextContent(
  content: unknown,
): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return asTrimmedString((part as { text?: unknown }).text) ?? '';
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '{}';
}

/**
 * Extracao via LLM (OpenRouter preferencial; OpenAI como fallback) quando
 * houver chave configurada.
 */
export async function extractPgroWithOpenAiText(
  rawText: string,
  base: PgroParseResult,
  options?: { sourceKind?: PgroLlmSourceKind },
): Promise<PgroParseResult | null> {
  const llm = resolveLlmConfig(options?.sourceKind);
  if (!llm) return null;

  const excerpt = pickTextForLlm(rawText);

  const body = {
    model: llm.model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Voce extrai estrutura de um PGR/PGRO brasileiro (setores, funcoes/cargos, riscos ocupacionais e EPIs). Responda so JSON valido. Ignore empresa elaboradora/consultoria SST; foque na empresa CONTRATADA/cliente. Nomes em portugues. IMPORTANTE: setor e a area/departamento (ex.: ACM, Caldeiraria Leve, Almoxarifado). Nunca coloque Junior/Pleno/Senior no nome do setor — isso pertence ao cargo/funcao. Em epiNeeds, inclua SOMENTE equipamentos de protecao individual vestiveis ou entregaveis ao trabalhador. Nunca classifique como EPI procedimentos, comandos, treinamento, manutencao, sinalizacao, EPC, protecao coletiva, componente de maquina, acao preventiva ou medida administrativa, mesmo quando estiverem na mesma celula. Se uma celula misturar medidas e EPIs, extraia somente cada EPI real. PDF impresso de Word e valido (tem texto).',
      },
      {
        role: 'user',
        content: `Extraia do texto do PGR:
- company: legalName, tradeName, cnpj, city, state, cnae, riskGrade, employeeCount
- sectors: [{name}]
- functions: [{name, sectorName, activityDescription, environmentDescription}]
- risks: [{name, category (FISICO|QUIMICO|BIOLOGICO|ERGONOMICO|ACIDENTE|MECANICO|PSICOSSOCIAL), exposure, source, functionNames[]}]
- epiNeeds: [{name, extractedText, functionNames[], riskNames[]}]
- warnings: string[]

JSON no formato acima. Texto do PGR:
---
${excerpt}`,
      },
    ],
  };

  const res = await fetch(llm.endpoint, {
    method: 'POST',
    headers: llm.headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await readResponseTextWithLimit(
      res,
      MAX_MODEL_RESPONSE_BYTES,
    ).catch(() => '');
    return {
      ...base,
      warnings: [
        ...base.warnings,
        `Falha na leitura por IA (${llm.provider}, ${res.status}). ${errText.slice(0, 160)}`,
      ],
      parseMethod: 'HEURISTIC',
    };
  }

  let rawResponse: string;
  try {
    rawResponse = await readResponseTextWithLimit(
      res,
      MAX_MODEL_RESPONSE_BYTES,
    );
  } catch (error) {
    return {
      ...base,
      warnings: [
        ...base.warnings,
        error instanceof PgroResponseTooLargeError
          ? 'IA retornou resposta grande demais para o PGR.'
          : 'Nao foi possivel ler a resposta da IA para o PGR.',
      ],
      parseMethod: 'HEURISTIC',
    };
  }
  let json: {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  try {
    json = JSON.parse(rawResponse) as typeof json;
  } catch {
    return {
      ...base,
      warnings: [...base.warnings, 'IA retornou resposta HTTP invalida para o PGR.'],
      parseMethod: 'HEURISTIC',
    };
  }
  const content = extractTextContent(json.choices?.[0]?.message?.content);
  let parsed: LlmPayload;
  try {
    parsed = JSON.parse(content) as LlmPayload;
  } catch {
    return {
      ...base,
      warnings: [...base.warnings, 'IA retornou JSON invalido para o PGR.'],
      parseMethod: 'HEURISTIC',
    };
  }

  return llmToParseResult(parsed, base);
}
