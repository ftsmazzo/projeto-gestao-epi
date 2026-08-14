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

const RISK_CATEGORIES = new Set<string>(Object.values(OccupationalRiskCategory));

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
    .map((risk) => ({
      tempId: randomUUID(),
      name: (risk.name ?? '').trim(),
      category: asCategory(risk.category),
      exposure: risk.exposure?.trim() || null,
      source: risk.source?.trim() || null,
      possibleDamage: null,
      riskLevel: null,
      functionNames: Array.isArray(risk.functionNames)
        ? risk.functionNames.filter((n) => typeof n === 'string' && n.trim())
        : [],
      rawText: (risk.name ?? '').trim(),
      included: true,
      confidence: 'low' as const,
      extractionSource: 'KEYWORD' as const,
      gheName: null,
    }))
    .filter((r) => r.name.length >= 2);

  const epiNeeds: PgroExtractedEpiNeed[] = (payload.epiNeeds ?? [])
    .map((epi) => {
      const name = (epi.name ?? epi.extractedText ?? '').trim();
      return {
        tempId: randomUUID(),
        extractedText: (epi.extractedText ?? name).trim() || name,
        suggestedName: name,
        matchedEpiNeedId: null,
        matchedEpiNeedName: null,
        createNew: true,
        functionNames: Array.isArray(epi.functionNames)
          ? epi.functionNames.filter((n) => typeof n === 'string' && n.trim())
          : [],
        riskNames: Array.isArray(epi.riskNames)
          ? epi.riskNames.filter((n) => typeof n === 'string' && n.trim())
          : [],
        included: true,
        confidence: 'low' as const,
        extractionSource: 'KEYWORD' as const,
        gheName: null,
      };
    })
    .filter((e) => e.suggestedName.length >= 2);

  const company: PgroCompanyData = {
    legalName: payload.company?.legalName?.trim() || base.company.legalName,
    tradeName: payload.company?.tradeName?.trim() || base.company.tradeName,
    cnpj: payload.company?.cnpj?.trim() || base.company.cnpj,
    addressLine: payload.company?.addressLine?.trim() || base.company.addressLine,
    city: payload.company?.city?.trim() || base.company.city,
    state: payload.company?.state?.trim() || base.company.state,
    cnae: payload.company?.cnae?.trim() || base.company.cnae,
    riskGrade: payload.company?.riskGrade?.trim() || base.company.riskGrade,
    employeeCount:
      payload.company?.employeeCount ?? base.company.employeeCount,
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
    ];
    if (!existing.source && risk.source) existing.source = risk.source;
    if (!existing.exposure && risk.exposure) existing.exposure = risk.exposure;
  }
  const risks = [...riskByName.values()];

  const epiByName = new Map(
    heuristic.epiNeeds.map((e) => [normalizeTextKey(e.suggestedName), e] as const),
  );
  for (const epi of llm.epiNeeds) {
    const key = normalizeTextKey(epi.suggestedName);
    const existing = epiByName.get(key);
    if (!existing) {
      epiByName.set(key, epi);
      continue;
    }
    existing.functionNames = [
      ...new Set([...existing.functionNames, ...epi.functionNames]),
    ];
    existing.riskNames = [
      ...new Set([...(existing.riskNames ?? []), ...(epi.riskNames ?? [])]),
    ];
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

/**
 * Extracao via OpenAI no texto do PDF quando OPENAI_API_KEY estiver configurada.
 */
export async function extractPgroWithOpenAiText(
  rawText: string,
  base: PgroParseResult,
): Promise<PgroParseResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const excerpt = pickTextForLlm(rawText);
  const model = process.env.OPENAI_PGR_MODEL?.trim() || 'gpt-4o-mini';

  const body = {
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Voce extrai estrutura de um PGR/PGRO brasileiro (setores, funcoes/cargos, riscos ocupacionais e EPIs). Responda so JSON valido. Ignore empresa elaboradora/consultoria SST; foque na empresa CONTRATADA/cliente. Nomes em portugues. IMPORTANTE: setor e a area/departamento (ex.: ACM, Caldeiraria Leve, Almoxarifado). Nunca coloque Junior/Pleno/Senior no nome do setor — isso pertence ao cargo/funcao. PDF impresso de Word e valido (tem texto).',
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

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return {
      ...base,
      warnings: [
        ...base.warnings,
        `Falha na leitura por IA (${res.status}). ${errText.slice(0, 160)}`,
      ],
      parseMethod: 'HEURISTIC',
    };
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? '{}';
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
