import { createHash, randomUUID } from 'crypto';
import { OccupationalRiskCategory } from '@prisma/client';
import { DEFAULT_EPI_NEED_SEEDS } from '../epi-needs/epi-need-suggest';
import { DEFAULT_OCCUPATIONAL_RISK_SEEDS } from '../client-structure/risk-seeds';

export type ExtractionConfidence = 'high' | 'low';
export type ExtractionSource = 'GHE' | 'KEYWORD' | 'GLOBAL';

export type PgroCompanyData = {
  legalName: string | null;
  tradeName: string | null;
  cnpj: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  cnae: string | null;
  riskGrade: string | null;
  employeeCount: number | null;
  rawText: string | null;
};

export type PgroExtractedSector = {
  tempId: string;
  name: string;
  rawText: string;
  included: boolean;
  confidence: ExtractionConfidence;
  source: ExtractionSource;
  gheName: string | null;
};

export type PgroExtractedFunction = {
  tempId: string;
  name: string;
  sectorName: string | null;
  activityDescription: string | null;
  environmentDescription: string | null;
  gheName: string | null;
  rawText: string;
  included: boolean;
  confidence: ExtractionConfidence;
  source: ExtractionSource;
};

export type PgroExtractedRisk = {
  tempId: string;
  name: string;
  category: OccupationalRiskCategory;
  exposure: string | null;
  source: string | null;
  possibleDamage: string | null;
  riskLevel: string | null;
  functionNames: string[];
  rawText: string;
  included: boolean;
  confidence: ExtractionConfidence;
  extractionSource: ExtractionSource;
  gheName: string | null;
};

export type PgroExtractedEpiNeed = {
  tempId: string;
  extractedText: string;
  suggestedName: string;
  matchedEpiNeedId: string | null;
  matchedEpiNeedName: string | null;
  createNew: boolean;
  functionNames: string[];
  riskNames: string[];
  included: boolean;
  confidence: ExtractionConfidence;
  extractionSource: ExtractionSource;
  gheName: string | null;
};

export type PgroParseResult = {
  company: PgroCompanyData;
  sectors: PgroExtractedSector[];
  functions: PgroExtractedFunction[];
  risks: PgroExtractedRisk[];
  epiNeeds: PgroExtractedEpiNeed[];
  warnings: string[];
  ignoredCandidates: string[];
  textExtractable: boolean;
  textLength: number;
};

const BR_UFS = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]);

const JUNK_NAME_RE =
  /(descricao da atividade|descricao do ambiente|funcao descricao|executar outras tarefas|de acordo com a gravidade|a funcao e as caracteristicas|notifique o superior|de sua natureza|caracterizacao do ghe|aprho do ghe|medida de controle|potencial de risco|agente nocivo|quando necessario|conforme|metodolog)/i;

const STOP_WORDS = new Set([
  'es',
  'nos',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'a',
  'o',
  'as',
  'os',
  'em',
  'na',
  'no',
  'um',
  'uma',
  'para',
  'com',
  'por',
  'ao',
  'à',
  'seu',
  'sua',
]);

export function normalizeTextKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function titleCaseJob(value: string): string {
  return cleanLine(value)
    .split(' ')
    .map((word) => {
      if (/^[IVXLCDM]+$/i.test(word)) return word.toUpperCase();
      if (word.length <= 2) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ')
    .replace(/\bDe\b/g, 'de')
    .replace(/\bDa\b/g, 'da')
    .replace(/\bDo\b/g, 'do')
    .replace(/\bE\b/g, 'e');
}

function uniqueByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = normalizeTextKey(item.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function extractCnpj(text: string): string | null {
  const match = text.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/);
  if (!match) return null;
  return match[1].replace(/[^\dA-Za-z]/g, '').toUpperCase();
}

function fieldUntilStop(
  text: string,
  labels: string[],
  stopLabels: string[],
): string | null {
  for (const label of labels) {
    const stop = stopLabels.map((s) => s.replace(/\s+/g, '\\s+')).join('|');
    const re = new RegExp(
      `${label}\\s*[:\\-–]?\\s*([\\s\\S]{1,120}?)(?=${stop}|\\n\\s*\\n|$)`,
      'i',
    );
    const match = text.match(re);
    if (match?.[1]) {
      const value = cleanLine(match[1].split('\n')[0] ?? match[1]);
      if (value) return value;
    }
  }
  return null;
}

function extractCompany(
  text: string,
  warnings: string[],
): PgroCompanyData {
  const cnpj = extractCnpj(text);
  const legalName =
    fieldUntilStop(
      text,
      ['Razao Social', 'Razão Social', 'Nome da Empresa', 'Empregador'],
      ['CNPJ', 'Nome Fantasia', 'Endereco', 'Endereço', 'Municipio', 'Município'],
    ) ?? null;

  const tradeName =
    fieldUntilStop(text, ['Nome Fantasia', 'Fantasia'], [
      'CNPJ',
      'Endereco',
      'Endereço',
      'Municipio',
      'Município',
      'Razao',
      'Razão',
    ]) ?? null;

  const addressLine =
    fieldUntilStop(text, ['Endereco', 'Endereço', 'Logradouro'], [
      'Municipio',
      'Município',
      'Cidade',
      'UF',
      'Estado',
      'CEP',
      'CNAE',
    ]) ?? null;

  let city: string | null = null;
  let state: string | null = null;

  const cityStateMatch = text.match(
    /Munic[ií]pio\s*[:\-]?\s*([A-Za-zÀ-ÿ' .\-]+?)\s+(?:Estado|UF)\s*[:\-]?\s*([A-Za-z]{2})\b/i,
  );
  if (cityStateMatch) {
    city = cleanLine(cityStateMatch[1]);
    state = cityStateMatch[2].toUpperCase();
  } else {
    const cityOnly = fieldUntilStop(
      text,
      ['Municipio', 'Município', 'Cidade'],
      ['Estado', 'UF', 'CEP', 'CNAE', 'Grau'],
    );
    if (cityOnly) {
      const stripped = cityOnly
        .replace(/\bEstado\b.*$/i, '')
        .replace(/\bUF\b.*$/i, '')
        .trim();
      city = cleanLine(stripped);
    }
    const ufMatch = text.match(/\b(?:Estado|UF)\s*[:\-]?\s*([A-Za-z]{2})\b/i);
    if (ufMatch) state = ufMatch[1].toUpperCase();
  }

  if (city) {
    city = city
      .replace(/\bEstado\b.*$/i, '')
      .replace(/\bUF\b.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (state && !BR_UFS.has(state)) {
    warnings.push(
      `UF extraida "${state}" e invalida e foi descartada. Informe manualmente se necessario.`,
    );
    state = null;
  }
  if (!state) {
    warnings.push('UF nao encontrada com confianca.');
  }

  let cnae: string | null = null;
  const cnaeMatch = text.match(
    /CNAE\s*[:\-]?\s*(\d{2}\.?\d{2}-?\d(?:-\d{2})?|\d{4,7}(?:-\d{1,2})?)/i,
  );
  if (cnaeMatch) {
    cnae = cleanLine(cnaeMatch[1]);
  }

  let riskGrade: string | null = null;
  const riskMatch = text.match(
    /Grau\s+de\s+[Rr]isco\s*[:\-]?\s*([1-4])\b/,
  );
  if (riskMatch) riskGrade = riskMatch[1];

  let employeeCount: number | null = null;
  const empMatch = text.match(
    /(?:N[ºo°]\.?\s*(?:de\s*)?(?:Funcion[aá]rios|trabalhadores)|Numero\s+de\s+Funcionarios|Total\s+de\s+trabalhadores)\s*[:\-]?\s*(\d{1,5})/i,
  );
  if (empMatch) employeeCount = Number(empMatch[1]);

  return {
    legalName: legalName ? cleanLine(legalName) : null,
    tradeName: tradeName ? cleanLine(tradeName) : null,
    cnpj,
    addressLine,
    city,
    state,
    cnae,
    riskGrade,
    employeeCount,
    rawText: legalName,
  };
}

function isJunkName(value: string): boolean {
  const key = normalizeTextKey(value);
  if (!key || key.length < 3) return true;
  if (STOP_WORDS.has(key)) return true;
  if (JUNK_NAME_RE.test(key)) return true;
  if (key.split(' ').length === 1 && key.length <= 3) return true;
  return false;
}

function isValidSectorName(name: string): boolean {
  const cleaned = cleanLine(name);
  if (isJunkName(cleaned)) return false;
  if (cleaned.length > 40) return false;
  const words = cleaned.split(/\s+/);
  if (words.length > 4) return false;
  if (/\d{3,}/.test(cleaned)) return false;
  if (/[.!?]/.test(cleaned)) return false;
  if (
    /\b(executar|realizar|atividade|ambiente|conforme|quando|outras|tarefas)\b/i.test(
      cleaned,
    )
  ) {
    return false;
  }
  return true;
}

function isValidFunctionName(name: string): boolean {
  const cleaned = cleanLine(name);
  if (isJunkName(cleaned)) return false;
  if (cleaned.length < 3 || cleaned.length > 80) return false;
  const words = cleaned.split(/\s+/);
  if (words.length > 8) return false;
  if (/[.!?]$/.test(cleaned)) return false;
  if (
    /\b(executar|realizar|outras tarefas|de acordo|gravidade|natureza|notifique|superior|imediat|caracteristicas|descricao|riscos?|medidas?|aprho|protetor auricular|respirador|botina de|oculos de|óculos de|luva de|cinta lombar|avental de)\b/i.test(
      cleaned,
    )
  ) {
    return false;
  }
  // Listas "A, B, C" de riscos/EPIs nao sao cargos
  if ((cleaned.match(/,/g) ?? []).length >= 2 && !/[IVX]+/i.test(cleaned)) {
    return false;
  }
  if (/[:;]/.test(cleaned)) return false;
  // Prefer titles with letters, optionally roman numerals
  if (!/[A-Za-zÀ-ÿ]{3,}/.test(cleaned)) return false;

  // Rejeitar se for apenas nome de risco conhecido
  const key = normalizeTextKey(cleaned);
  for (const seed of DEFAULT_OCCUPATIONAL_RISK_SEEDS) {
    if (normalizeTextKey(seed.name) === key) return false;
    if (seed.aliases.some((a) => normalizeTextKey(a) === key)) return false;
  }
  for (const seed of DEFAULT_EPI_NEED_SEEDS) {
    if (normalizeTextKey(seed.name) === key) return false;
  }
  return true;
}

/** Expande "Auxiliar de Produção I,II,III" e separa por / e quebras. */
export function expandFunctionNames(raw: string): string[] {
  const chunks = raw
    .split(/\n|;|\|/)
    .flatMap((part) => part.split('/'))
    .map((part) => cleanLine(part.replace(/^[-•*]\s*/, '')))
    .filter(Boolean);

  const out: string[] = [];
  for (const chunk of chunks) {
    const romanList = chunk.match(
      /^(.+?)\s+((?:[IVX]+)(?:\s*,\s*[IVX]+)+)$/i,
    );
    if (romanList) {
      const base = cleanLine(romanList[1]);
      const numerals = romanList[2].split(/\s*,\s*/).map((n) => n.toUpperCase());
      for (const num of numerals) {
        out.push(titleCaseJob(`${base} ${num}`));
      }
      continue;
    }

    // "Auxiliar de Produção I, II e III"
    const romanAnd = chunk.match(
      /^(.+?)\s+((?:[IVX]+)(?:\s*,\s*[IVX]+)*(?:\s+e\s+[IVX]+)?)$/i,
    );
    if (romanAnd && /[IVX]+/i.test(romanAnd[2]) && romanAnd[2].includes(',')) {
      const base = cleanLine(romanAnd[1]);
      const numerals = romanAnd[2]
        .replace(/\s+e\s+/i, ',')
        .split(/\s*,\s*/)
        .map((n) => n.toUpperCase())
        .filter(Boolean);
      for (const num of numerals) {
        out.push(titleCaseJob(`${base} ${num}`));
      }
      continue;
    }

    out.push(titleCaseJob(chunk));
  }

  return [...new Set(out.map((n) => cleanLine(n)).filter(isValidFunctionName))];
}

type GheBlock = {
  gheNumber: string;
  gheName: string;
  sectorName: string | null;
  functionNames: string[];
  activity: string | null;
  environment: string | null;
  raw: string;
  body: string;
};

function extractGheBlocks(text: string): GheBlock[] {
  const blocks: GheBlock[] = [];
  const headerRe =
    /Caracteriza[cç][aã]o\s+do\s+GHE\s*(\d+)\s*[–\-:]\s*([^\n]{2,80})/gi;
  const headers: Array<{
    index: number;
    number: string;
    name: string;
    full: string;
  }> = [];

  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(text)) != null) {
    headers.push({
      index: match.index,
      number: match[1].padStart(2, '0'),
      name: cleanLine(match[2]),
      full: match[0],
    });
  }

  // Fallback: plain "GHE 01 – NOME" near characterization
  if (headers.length === 0) {
    const altRe = /\bGHE\s*(\d+)\s*[–\-:]\s*([A-ZÀ-Ÿ0-9 /-]{3,60})/g;
    while ((match = altRe.exec(text)) != null) {
      headers.push({
        index: match.index,
        number: match[1].padStart(2, '0'),
        name: cleanLine(match[2]),
        full: match[0],
      });
    }
  }

  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i];
    const start = header.index;
    const nextStart = headers[i + 1]?.index ?? text.length;
    const slice = text.slice(start, nextStart);

    const aprhoCut = slice.search(
      new RegExp(
        `APRHO\\s+do\\s+GHE\\s*0*${Number(header.number)}\\b`,
        'i',
      ),
    );
    const body =
      aprhoCut > 0 ? slice.slice(0, aprhoCut) : slice.slice(0, 2500);

    const parsed = parseGheCharacterizationTable(body, header.name);
    blocks.push({
      gheNumber: header.number,
      gheName: `GHE ${header.number} – ${header.name}`,
      sectorName: parsed.sectorName,
      functionNames: parsed.functionNames,
      activity: parsed.activity,
      environment: parsed.environment,
      raw: body.slice(0, 800),
      body,
    });
  }

  return blocks;
}

function parseGheCharacterizationTable(
  body: string,
  headerSectorHint: string,
): {
  sectorName: string | null;
  functionNames: string[];
  activity: string | null;
  environment: string | null;
} {
  const lines = body
    .split('\n')
    .map((line) => cleanLine(line))
    .filter(Boolean);

  // Remove header/label noise
  const contentLines = lines.filter(
    (line) =>
      !/^Caracteriza/i.test(line) &&
      !/^Setor$/i.test(line) &&
      !/^Cargo\/?Fun[cç][aã]o$/i.test(line) &&
      !/^Descri[cç][aã]o da Atividade$/i.test(line) &&
      !/^Descri[cç][aã]o do Ambiente$/i.test(line) &&
      !/^Setor\s+Cargo/i.test(line) &&
      !/^APRHO\b/i.test(line) &&
      !/^Riscos?\b/i.test(line) &&
      !/^Medidas?\b/i.test(line),
  );

  let sectorName: string | null = null;
  const functionCandidates: string[] = [];
  let activity: string | null = null;
  let environment: string | null = null;
  let pastJobs = false;

  // Pattern: first short UPPER/title sector line after labels
  for (const line of contentLines) {
    if (/^APRHO\b/i.test(line)) break;

    if (
      /\b(executar|realizar|auxiliar nas|operar|controlar|efetuar|desenvolver|classificar)\b/i.test(
        line,
      ) &&
      line.length > 35
    ) {
      pastJobs = true;
      if (!activity) activity = line.slice(0, 500);
      continue;
    }

    if (
      pastJobs &&
      /\b(ambiente|galpao|galpão|area|área|sala|piso|iluminacao|iluminação|escritorio|escritório)\b/i.test(
        line,
      )
    ) {
      if (!environment) environment = line.slice(0, 500);
      continue;
    }

    if (pastJobs) continue;

    if (!sectorName && isValidSectorName(line) && line.length <= 30) {
      const letters = line.replace(/[^A-Za-zÀ-ÿ]/g, '');
      const upperRatio =
        (letters.match(/[A-ZÀ-Ÿ]/g) ?? []).length / Math.max(1, letters.length);
      if (upperRatio >= 0.6 || /^[A-ZÀ-Ÿ0-9 /-]{3,30}$/.test(line)) {
        sectorName = line.toUpperCase();
        continue;
      }
    }

    if (
      isValidFunctionName(line) &&
      !/ambiente|atividade/i.test(line) &&
      line.length <= 70 &&
      line.split(/\s+/).length <= 7
    ) {
      functionCandidates.push(...expandFunctionNames(line));
    }
  }

  // Compact Word table dump: "PRODUÇÃO Encarregado de Produção Executar..."
  if (functionCandidates.length === 0) {
    const compact = cleanLine(body.replace(/\n/g, ' '));
    const afterLabels = compact.replace(
      /^.*?Setor\s+Cargo\/?Fun[cç][aã]o\s+Descri[cç][aã]o da Atividade\s+Descri[cç][aã]o do Ambiente\s*/i,
      '',
    );
    const sectorMatch = afterLabels.match(
      /^([A-ZÀ-Ÿ0-9][A-ZÀ-Ÿ0-9 /-]{1,28})\s+(.+)$/,
    );
    if (sectorMatch && isValidSectorName(sectorMatch[1])) {
      sectorName = sectorMatch[1].toUpperCase();
      // Take job titles before long activity verbs
      const rest = sectorMatch[2];
      const beforeActivity = rest.split(
        /\s(?=Executar|Realizar|Auxiliar nas|Operar|Controlar|Efetuar|Desenvolver)/i,
      )[0];
      functionCandidates.push(...expandFunctionNames(beforeActivity));
    }
  }

  if (!sectorName && isValidSectorName(headerSectorHint)) {
    sectorName = headerSectorHint.toUpperCase();
  }

  // Also pull slash-separated titles from any short line containing /
  for (const line of contentLines) {
    if (line.includes('/') && line.length <= 120) {
      functionCandidates.push(...expandFunctionNames(line));
    }
  }

  return {
    sectorName,
    functionNames: [...new Set(functionCandidates.filter(isValidFunctionName))],
    activity,
    environment,
  };
}

function extractRisksFromBlocks(
  fullText: string,
  blocks: GheBlock[],
  allFunctionNames: string[],
): PgroExtractedRisk[] {
  const risks: PgroExtractedRisk[] = [];

  const pushSeedHits = (
    scopeText: string,
    functionNames: string[],
    gheName: string | null,
    extractionSource: ExtractionSource,
  ) => {
    const textKey = normalizeTextKey(scopeText);
    for (const seed of DEFAULT_OCCUPATIONAL_RISK_SEEDS) {
      const aliases = [seed.name, ...seed.aliases].map(normalizeTextKey);
      // Require meaningful alias hit; avoid ultra-short false positives
      const hit = aliases.some(
        (alias) => alias.length >= 4 && textKey.includes(alias),
      );
      if (!hit) continue;
      risks.push({
        tempId: randomUUID(),
        name: seed.name,
        category: seed.category,
        exposure: null,
        source: null,
        possibleDamage: null,
        riskLevel: null,
        functionNames: [...functionNames],
        rawText: seed.name,
        included: true,
        confidence: extractionSource === 'GHE' ? 'high' : 'high',
        extractionSource,
        gheName,
      });
    }
  };

  if (blocks.length > 0) {
    for (const block of blocks) {
      // Prefer APRHO section for that GHE if present in full text
      const aprhoRe = new RegExp(
        `APRHO\\s+do\\s+GHE\\s*0*${Number(block.gheNumber)}[\\s\\S]{0,4000}`,
        'i',
      );
      const aprho = fullText.match(aprhoRe)?.[0] ?? block.body;
      pushSeedHits(
        aprho,
        block.functionNames.length > 0
          ? block.functionNames
          : allFunctionNames,
        block.gheName,
        'GHE',
      );
    }
  } else {
    pushSeedHits(fullText, allFunctionNames, null, 'KEYWORD');
  }

  // Merge same risk names, union function names
  const byName = new Map<string, PgroExtractedRisk>();
  for (const risk of risks) {
    const key = normalizeTextKey(risk.name);
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, risk);
      continue;
    }
    existing.functionNames = [
      ...new Set([...existing.functionNames, ...risk.functionNames]),
    ];
  }

  return [...byName.values()].filter(
    (risk) =>
      !isJunkName(risk.name) &&
      !/notifique|superior imediato/i.test(risk.name),
  );
}

function extractEpiNeedsFromBlocks(
  fullText: string,
  blocks: GheBlock[],
  allFunctionNames: string[],
  riskNames: string[],
  warnings: string[],
): PgroExtractedEpiNeed[] {
  const found: PgroExtractedEpiNeed[] = [];
  const seen = new Set<string>();

  const scan = (
    scopeText: string,
    functionNames: string[],
    gheName: string | null,
    extractionSource: ExtractionSource,
  ) => {
    const textKey = normalizeTextKey(scopeText);
    for (const seed of DEFAULT_EPI_NEED_SEEDS) {
      const aliases = [seed.name, ...seed.aliases].map(normalizeTextKey);
      const hit = aliases.some(
        (alias) => alias.length >= 4 && textKey.includes(alias),
      );
      if (!hit) continue;
      const key = `${normalizeTextKey(seed.name)}::${gheName ?? 'global'}`;
      if (seen.has(normalizeTextKey(seed.name)) && extractionSource === 'GLOBAL') {
        continue;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      seen.add(normalizeTextKey(seed.name));

      const associated = functionNames.length > 0;
      if (!associated && extractionSource === 'GLOBAL') {
        warnings.push(
          `EPI encontrado sem associacao confiavel a funcao: ${seed.name}`,
        );
      }

      found.push({
        tempId: randomUUID(),
        extractedText: seed.name,
        suggestedName: seed.name,
        matchedEpiNeedId: null,
        matchedEpiNeedName: null,
        createNew: true,
        functionNames: associated ? [...functionNames] : [...allFunctionNames],
        riskNames: [...riskNames],
        included: true,
        confidence: associated ? 'high' : 'low',
        extractionSource,
        gheName,
      });
    }
  };

  if (blocks.length > 0) {
    for (const block of blocks) {
      const aprhoRe = new RegExp(
        `APRHO\\s+do\\s+GHE\\s*0*${Number(block.gheNumber)}[\\s\\S]{0,5000}`,
        'i',
      );
      const aprho = fullText.match(aprhoRe)?.[0] ?? block.body;
      scan(
        aprho,
        block.functionNames,
        block.gheName,
        block.functionNames.length > 0 ? 'GHE' : 'GLOBAL',
      );
    }
  } else {
    scan(fullText, allFunctionNames, null, 'GLOBAL');
  }

  const byName = new Map<string, PgroExtractedEpiNeed>();
  for (const item of found) {
    const key = normalizeTextKey(item.suggestedName);
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, item);
      continue;
    }
    existing.functionNames = [
      ...new Set([...existing.functionNames, ...item.functionNames]),
    ];
    if (existing.confidence === 'low' && item.confidence === 'high') {
      byName.set(key, { ...item, functionNames: existing.functionNames });
    }
  }
  return [...byName.values()];
}

export function parsePgroText(rawText: string): PgroParseResult {
  const warnings: string[] = [];
  const ignoredCandidates: string[] = [];
  const text = rawText.replace(/\r/g, '\n');
  const compact = text.replace(/[ \t]+/g, ' ').trim();
  const textExtractable = compact.replace(/\s/g, '').length >= 80;

  if (!textExtractable) {
    return {
      company: {
        legalName: null,
        tradeName: null,
        cnpj: null,
        addressLine: null,
        city: null,
        state: null,
        cnae: null,
        riskGrade: null,
        employeeCount: null,
        rawText: null,
      },
      sectors: [],
      functions: [],
      risks: [],
      epiNeeds: [],
      warnings: [
        'Este PDF parece nao ter texto extraivel. Use um PDF gerado digitalmente ou uma versao OCR.',
      ],
      ignoredCandidates: [],
      textExtractable: false,
      textLength: compact.length,
    };
  }

  const company = extractCompany(text, warnings);
  if (!company.cnpj) {
    warnings.push('CNPJ da empresa nao encontrado com confianca.');
  }
  if (!company.legalName) {
    warnings.push('Razao social nao encontrada com confianca.');
  }

  const gheBlocks = extractGheBlocks(text);
  if (gheBlocks.length === 0) {
    warnings.push(
      'Blocos "Caracterizacao do GHE" nao detectados; setores/funcoes podem ficar incompletos.',
    );
  } else {
    warnings.push(
      `${gheBlocks.length} bloco(s) de GHE detectados para extracao de setores/funcoes.`,
    );
  }

  const sectorItems: PgroExtractedSector[] = [];
  const functionItems: PgroExtractedFunction[] = [];

  for (const block of gheBlocks) {
    if (block.sectorName && isValidSectorName(block.sectorName)) {
      sectorItems.push({
        tempId: randomUUID(),
        name: block.sectorName.toUpperCase(),
        rawText: block.sectorName,
        included: true,
        confidence: 'high',
        source: 'GHE',
        gheName: block.gheName,
      });
    } else if (block.sectorName) {
      ignoredCandidates.push(`Setor ignorado: ${block.sectorName}`);
    }

    for (const name of block.functionNames) {
      if (!isValidFunctionName(name)) {
        ignoredCandidates.push(`Funcao ignorada: ${name}`);
        continue;
      }
      functionItems.push({
        tempId: randomUUID(),
        name,
        sectorName: block.sectorName,
        activityDescription: block.activity,
        environmentDescription: block.environment,
        gheName: block.gheName,
        rawText: block.raw,
        included: true,
        confidence: 'high',
        source: 'GHE',
      });
    }
  }

  // Do NOT scan whole document for Setor:/Função: labels — that produced junk.

  const sectors = uniqueByName(sectorItems);
  const functions = uniqueByName(functionItems);

  if (sectors.length === 0) {
    warnings.push('Nenhum setor valido identificado nos blocos de GHE.');
  }
  if (functions.length === 0) {
    warnings.push('Nenhuma funcao/cargo valida identificada nos blocos de GHE.');
  }
  if (ignoredCandidates.length > 0) {
    warnings.push(
      `${ignoredCandidates.length} candidato(s) de setor/funcao ignorados por baixa confianca.`,
    );
  }

  const risks = extractRisksFromBlocks(
    text,
    gheBlocks,
    functions.map((f) => f.name),
  );
  if (risks.length === 0) {
    warnings.push('Nenhum risco ocupacional conhecido identificado no texto.');
  }

  const epiNeeds = extractEpiNeedsFromBlocks(
    text,
    gheBlocks,
    functions.map((f) => f.name),
    risks.map((r) => r.name),
    warnings,
  );
  if (epiNeeds.length === 0) {
    warnings.push(
      'Nenhum EPI necessario identificado nas medidas de controle. Voce ainda pode importar setores, funcoes e riscos.',
    );
  }

  return {
    company,
    sectors,
    functions,
    risks,
    epiNeeds,
    warnings,
    ignoredCandidates: ignoredCandidates.slice(0, 40),
    textExtractable: true,
    textLength: compact.length,
  };
}

export function fingerprintText(text: string): string {
  return createHash('sha1').update(normalizeTextKey(text)).digest('hex');
}
