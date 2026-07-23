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
  /(descricao da atividade|descricao do ambiente|funcao descricao|executar outras tarefas|de acordo com a gravidade|a funcao e as caracteristicas|notifique o superior|de sua natureza|caracterizacao do ghe|aprho do ghe|medida de controle|potencial de risco|agente nocivo|quando necessario|conforme|metodolog|responsaveis em|esta sob as responsabilidades)/i;

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
  'seu',
  'sua',
  'i',
  'ii',
  'iii',
  'iv',
]);

const JOB_HINT_RE =
  /\b(auxiliar|assistente|encarregado|operador|motorista|vendedor|tecnico|técnico|analista|supervisor|coordenador|gerente|servente|faxineir|limpeza|mecanico|mecânico|eletricista|soldador|pedreiro|pintor|almoxarife|recepcionista|secretario|secretário)\b/i;

const ACTIVITY_START_RE =
  /\b(executar|realizar|classificar|operar|controlar|efetuar|desenvolver|auxiliar nas|responsaveis em|esta sob as responsabilidades)\b/i;

const SECTOR_HINT_RE =
  /^(produc|classific|administr|vendas|transporte|apoio|torref|manutenc|qualidade|logistica|expedicao|almoxarif)/i;

export function normalizeTextKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normaliza nome de função para dedupe: espaços, caixa e variação I,II,III. */
export function normalizeFunctionKey(value: string): string {
  return normalizeTextKey(value)
    .replace(/\bi\s*,?\s*ii\s*,?\s*iii\b/g, 'i ii iii')
    .replace(/\bi\s*,?\s*ii\b/g, 'i ii')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSectorKey(value: string): string {
  return normalizeTextKey(value);
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Normaliza exibição de função SEM expandir I,II,III em cargos distintos.
 * Ex.: "AUXILIAR DE PRODUÇÃO I,II,III" → "AUXILIAR DE PRODUÇÃO (I, II, III)"
 */
export function normalizeFunctionDisplayName(value: string): string {
  let name = cleanLine(value).replace(/\s+/g, ' ').trim();

  // Preferir numerais longos primeiro (III antes de I) para não fragmentar.
  const romanList =
    /\(?\s*((?:III|II|IV|V|I)(?:\s*,\s*(?:III|II|IV|V|I))+)\s*\)?/i;
  const match = name.match(romanList);
  if (match) {
    const parts = match[1]
      .split(/\s*,\s*/)
      .map((n) => n.toUpperCase().trim())
      .filter(Boolean);
    const wrapped = `(${parts.join(', ')})`;
    name = `${name.slice(0, match.index).trim()} ${wrapped}`.trim();
  }

  return name.toUpperCase().replace(/\s+/g, ' ').trim();
}

function uniqueBySectorAndFunction(
  items: PgroExtractedFunction[],
): PgroExtractedFunction[] {
  const seen = new Set<string>();
  const out: PgroExtractedFunction[] = [];
  for (const item of items) {
    const key = `${normalizeSectorKey(item.sectorName ?? '')}::${normalizeFunctionKey(item.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
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

function extractCompany(text: string, warnings: string[]): PgroCompanyData {
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
      city = cleanLine(
        cityOnly.replace(/\bEstado\b.*$/i, '').replace(/\bUF\b.*$/i, ''),
      );
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
  if (cnaeMatch) cnae = cleanLine(cnaeMatch[1]);

  let riskGrade: string | null = null;
  const riskMatch = text.match(/Grau\s+de\s+[Rr]isco\s*[:\-]?\s*([1-4])\b/);
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
  if (/^(?:i|ii|iii|iv|v)(?:\s*,\s*(?:i|ii|iii|iv|v))*$/i.test(key)) return true;
  return false;
}

function looksLikeJobTitle(name: string): boolean {
  return JOB_HINT_RE.test(name) || /\([IVX,\s]+\)/i.test(name) || /\b[IVX]+\b/i.test(name);
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
    /\b(executar|realizar|atividade|ambiente|conforme|quando|outras|tarefas|responsaveis|responsabilidades)\b/i.test(
      cleaned,
    )
  ) {
    return false;
  }
  // Cabeçalho que é nome de função não vira setor
  if (looksLikeJobTitle(cleaned) && !SECTOR_HINT_RE.test(normalizeTextKey(cleaned))) {
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
    /\b(executar|realizar|outras tarefas|de acordo|gravidade|natureza|notifique|superior|imediat|caracteristicas|descricao|riscos?|medidas?|aprho|protetor auricular|respirador|botina de|oculos de|óculos de|luva de|cinta lombar|avental de|responsaveis em|esta sob as responsabilidades)\b/i.test(
      cleaned,
    )
  ) {
    return false;
  }
  if ((cleaned.match(/,/g) ?? []).length >= 2 && !/[IVX]+/i.test(cleaned)) {
    return false;
  }
  if (/[:;]/.test(cleaned)) return false;
  if (!/[A-Za-zÀ-ÿ]{3,}/.test(cleaned)) return false;

  const key = normalizeTextKey(cleaned);
  for (const seed of DEFAULT_OCCUPATIONAL_RISK_SEEDS) {
    if (normalizeTextKey(seed.name) === key) return false;
    if (seed.aliases.some((a) => normalizeTextKey(a) === key)) return false;
  }
  for (const seed of DEFAULT_EPI_NEED_SEEDS) {
    if (normalizeTextKey(seed.name) === key) return false;
  }
  if (!looksLikeJobTitle(cleaned) && words.length <= 2 && !/[IVX]/i.test(cleaned)) {
    return false;
  }
  return true;
}

/**
 * Normaliza/separa funções SEM expandir I,II,III em cargos distintos.
 */
export function expandFunctionNames(raw: string): string[] {
  const chunks = raw
    .split(/\n|;|\|/)
    .flatMap((part) => (part.includes('/') ? part.split('/') : [part]))
    .map((part) => cleanLine(part.replace(/^[-•*]\s*/, '')))
    .filter(Boolean);

  const out: string[] = [];
  for (const chunk of chunks) {
    const normalized = normalizeFunctionDisplayName(chunk);
    if (isValidFunctionName(normalized)) out.push(normalized);
  }
  return [...new Set(out)];
}

type SectorFunctionPair = {
  sectorName: string | null;
  functionName: string;
  activity: string | null;
  environment: string | null;
  rawText: string;
};

type GheBlock = {
  gheNumber: string;
  gheName: string;
  headerLabel: string;
  pairs: SectorFunctionPair[];
  body: string;
};

function extractGheBlocks(text: string): GheBlock[] {
  const blocks: GheBlock[] = [];
  const headerRe =
    /Caracteriza[cç][aã]o\s+do\s+GHE\s*(\d+)\s*[–\-:]\s*([^\n]{2,200})/gi;
  const headers: Array<{ index: number; number: string; label: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(text)) != null) {
    headers.push({
      index: match.index,
      number: match[1].padStart(2, '0'),
      label: cleanLine(match[2]),
    });
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

    const pairs = extractSectorFunctionPairsFromGheBody(body, header.label);
    blocks.push({
      gheNumber: header.number,
      gheName: `GHE ${header.number} – ${header.label}`,
      headerLabel: header.label,
      pairs,
      body,
    });
  }

  return blocks;
}

/**
 * Extrai pares setor→função dentro de um bloco de caracterização.
 * Suporta múltiplas linhas lógicas e herança de setor.
 */
function extractSectorFunctionPairsFromGheBody(
  body: string,
  headerLabel: string,
): SectorFunctionPair[] {
  const pairs: SectorFunctionPair[] = [];
  const lines = body
    .split(/\n/)
    .map((l) => cleanLine(l))
    .filter(Boolean)
    .filter(
      (line) =>
        !/^Caracteriza/i.test(line) &&
        !/^APRHO\b/i.test(line) &&
        !/^Setor\s+Cargo/i.test(line) &&
        !/^Cargo\/?Fun[cç][aã]o\s+Descri/i.test(line),
    );

  let currentSector: string | null = null;
  let sawTableFunction = false;

  for (const line of lines) {
    if (ACTIVITY_START_RE.test(line) && line.length > 35) break;
    if (/^Descri[cç][aã]o\s+da\s+Atividade\b/i.test(line)) break;
    if (/^Descri[cç][aã]o\s+do\s+Ambiente\b/i.test(line)) break;

    // "Setor: PRODUÇÃO" ou "Setor PRODUÇÃO"
    const sectorLabel = line.match(/^(?:Setor)\s*[:\-–]?\s*(.+)$/i);
    if (sectorLabel) {
      const candidate = cleanLine(sectorLabel[1]).toUpperCase();
      if (isValidSectorName(candidate)) currentSector = candidate;
      continue;
    }

    // "Função: ..." / "Cargo: ..." / "Cargo/Função: ..."
    const functionLabel = line.match(
      /^(?:Cargo\/?Fun[cç][aã]o|Cargo|Fun[cç][aã]o)\s*[:\-–]?\s*(.+)$/i,
    );
    if (functionLabel) {
      const names = expandFunctionNames(functionLabel[1]);
      if (names.length > 0) {
        sawTableFunction = true;
        for (const fn of names) {
          pairs.push({
            sectorName: currentSector,
            functionName: fn,
            activity: null,
            environment: null,
            rawText: line,
          });
        }
      }
      continue;
    }

    // Linha só com setor (ALL CAPS, curto, sem cara de cargo)
    if (
      isValidSectorName(line) &&
      line === line.toUpperCase() &&
      line.length <= 30 &&
      !looksLikeJobTitle(line)
    ) {
      currentSector = line.toUpperCase();
      continue;
    }

    // Linha só com função — herda setor atual
    if (isValidFunctionName(line) && looksLikeJobTitle(line)) {
      const names = expandFunctionNames(line);
      if (names.length > 0) {
        sawTableFunction = true;
        for (const fn of names) {
          pairs.push({
            sectorName: currentSector,
            functionName: fn,
            activity: null,
            environment: null,
            rawText: line,
          });
        }
      }
      continue;
    }
  }

  // Fallback: cabeçalho do GHE como função só se a tabela não trouxe funções
  if (!sawTableFunction && headerLabel) {
    const headerFns = expandFunctionNames(headerLabel);
    if (headerFns.length > 0 && headerFns.every(looksLikeJobTitle)) {
      for (const fn of headerFns) {
        pairs.push({
          sectorName: currentSector,
          functionName: fn,
          activity: null,
          environment: null,
          rawText: headerLabel,
        });
      }
    } else if (
      isValidSectorName(headerLabel) &&
      !looksLikeJobTitle(headerLabel) &&
      !currentSector
    ) {
      currentSector = headerLabel.toUpperCase();
    }
  }

  // Aplicar setor herdado/cabeçalho nas funções sem setor
  if (currentSector) {
    for (const pair of pairs) {
      if (!pair.sectorName) pair.sectorName = currentSector;
    }
  }

  // GHE 06: cabeçalho = função, tabela = setor, sem linha de função
  if (
    pairs.length === 0 &&
    currentSector &&
    looksLikeJobTitle(headerLabel) &&
    isValidFunctionName(normalizeFunctionDisplayName(headerLabel))
  ) {
    for (const fn of expandFunctionNames(headerLabel)) {
      pairs.push({
        sectorName: currentSector,
        functionName: fn,
        activity: null,
        environment: null,
        rawText: headerLabel,
      });
    }
  }

  // Se tabela trouxe funções, não duplicar a partir do cabeçalho
  // (já coberto por sawTableFunction)

  const seen = new Set<string>();
  const deduped: SectorFunctionPair[] = [];
  for (const pair of pairs) {
    if (!pair.functionName) continue;
    const key = `${normalizeSectorKey(pair.sectorName ?? '')}::${normalizeFunctionKey(pair.functionName)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(pair);
  }
  return deduped;
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
        confidence: 'high',
        extractionSource,
        gheName,
      });
    }
  };

  if (blocks.length > 0) {
    for (const block of blocks) {
      const aprhoRe = new RegExp(
        `APRHO\\s+do\\s+GHE\\s*0*${Number(block.gheNumber)}[\\s\\S]{0,4000}`,
        'i',
      );
      const aprho = fullText.match(aprhoRe)?.[0] ?? block.body;
      const fnNames = block.pairs.map((p) => p.functionName);
      pushSeedHits(
        aprho,
        fnNames.length > 0 ? fnNames : allFunctionNames,
        block.gheName,
        'GHE',
      );
    }
  } else {
    pushSeedHits(fullText, allFunctionNames, null, 'KEYWORD');
  }

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
      if (
        seen.has(normalizeTextKey(seed.name)) &&
        extractionSource === 'GLOBAL'
      ) {
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
        included: associated,
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
        block.pairs.map((p) => p.functionName),
        block.gheName,
        block.pairs.length > 0 ? 'GHE' : 'GLOBAL',
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
      byName.set(key, {
        ...item,
        functionNames: existing.functionNames,
        included: item.included,
      });
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
    for (const pair of block.pairs) {
      if (pair.sectorName && isValidSectorName(pair.sectorName)) {
        sectorItems.push({
          tempId: randomUUID(),
          name: pair.sectorName.toUpperCase(),
          rawText: pair.sectorName,
          included: true,
          confidence: 'high',
          source: 'GHE',
          gheName: block.gheName,
        });
      }

      if (!isValidFunctionName(pair.functionName)) {
        ignoredCandidates.push(`Funcao ignorada: ${pair.functionName}`);
        continue;
      }

      functionItems.push({
        tempId: randomUUID(),
        name: pair.functionName,
        sectorName: pair.sectorName,
        activityDescription: pair.activity,
        environmentDescription: pair.environment,
        gheName: block.gheName,
        rawText: pair.rawText,
        included: true,
        confidence: 'high',
        source: 'GHE',
      });
    }
  }

  const sectors = uniqueByName(sectorItems);
  const functions = uniqueBySectorAndFunction(functionItems);

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
