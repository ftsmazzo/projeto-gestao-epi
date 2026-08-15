import {
  countCharacterizationHeaders,
  gheTableBlocksToExtracted,
  parseGheTableBlocks,
} from './pgro-ghe-tables';
import type {
  ExtractionSource,
  PgroExtractedEpiNeed,
  PgroExtractedFunction,
  PgroExtractedRisk,
  PgroExtractedSector,
} from './pgro-extract-types';
import { createHash, randomUUID } from 'crypto';
import { OccupationalRiskCategory } from '@prisma/client';
import { DEFAULT_EPI_NEED_SEEDS } from '../epi-needs/epi-need-suggest';
import {
  extractAprhoAgentDetails,
  inferOsRiskContext,
} from '../client-structure/risk-context';
import { DEFAULT_OCCUPATIONAL_RISK_SEEDS } from '../client-structure/risk-seeds';

export type {
  ExtractionConfidence,
  ExtractionSource,
  PgroExtractedEpiNeed,
  PgroExtractedFunction,
  PgroExtractedRisk,
  PgroExtractedSector,
} from './pgro-extract-types';

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

export type PgroCoverageStats = {
  gheHeaderCount: number;
  ghesWithFunctions: number;
  functionsWithSector: number;
  functionCount: number;
  sectorCount: number;
  riskRowCount: number;
  epiItemCount: number;
  coverageOk: boolean;
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
  layout: PgroLayoutKind;
  parseMethod: PgroParseMethod;
  structureWeak: boolean;
  /** Cobertura do motor tabular de GHE (quando aplicavel). */
  coverage?: PgroCoverageStats | null;
};

export type PgroLayoutKind = 'GHE_APRHO' | 'CARGO_TABLE' | 'UNKNOWN';
export type PgroParseMethod = 'HEURISTIC' | 'HEURISTIC_PLUS_LLM';

export type PgroExtraAliasPack = {
  sectors?: Array<{ raw: string; canonical: string }>;
  jobFunctions?: Array<{ raw: string; canonical: string }>;
  risks?: Array<{
    raw: string;
    canonical: string;
    category?: OccupationalRiskCategory | null;
  }>;
  epiNeeds?: Array<{ raw: string; canonical: string }>;
};

export type ParsePgroOptions = {
  extraAliases?: PgroExtraAliasPack;
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
  /\b(auxiliar|assistente|encarregado|operador|motorista|vendedor|tecnico|técnico|analista|supervisor|coordenador|gerente|diretor|diretora|ajudante|instalador|servente|faxineir|limpeza|mecanico|mecânico|eletricista|soldador|pedreiro|pintor|almoxarife|recepcionista|secretario|secretário|montador|solda|pedreir|carpinteiro|mestre de obras|servente|office boy|jovem aprendiz|engenheiro|enfermeir|medico|médico|tecnolog|inspetor|caldeireiro|tornero|fresador|embalador|separador|conferente|vigilante|porteiro|cozinheir|garcom|garçom|frentista|bombeiro|soldador|serralheiro)\b/i;

const ACTIVITY_START_RE =
  /\b(executar|realizar|classificar|operar|controlar|efetuar|desenvolver|auxiliar nas|responsaveis em|esta sob as responsabilidades|selecionam os|um vendedor|o auxiliar|o encarregado|realizacao de transporte|realização de transporte)\b/i;

const ENVIRONMENT_LINE_RE =
  /^(trabalham em|trabalhos externos|ambiente interno|ambiente administrativo|balc[aã]o de atendimento|interno e ventilado|interno e climatizado|em diversos locais)/i;

const SECTOR_HINT_RE =
  /^(produc|classific|administr|vendas|transporte|apoio|torref|manutenc|qualidade|logistica|expedicao|almoxarif|servic|extern|intern|obra|canteiro|campo|oficina|montag|caldeir|serraria|acm)/i;

/** Setores conhecidos do layout real (para split mesma linha e detecção). */
const KNOWN_SECTOR_RE =
  /^(PRODU[CÇ][AÃ]O|CLASSIFICA[CÇ][AÃ]O|ADMINISTRATIVO|VENDAS|TRANSPORTE|APOIO\s*ADM|TORREFA[CÇ][AÃ]O|MANUTEN[CÇ][AÃ]O|QUALIDADE|LOG[IÍ]STICA|EXPEDI[CÇ][AÃ]O|ALMOXARIFADO|SERVI[CÇ]OS?\s+EXTERNOS?|SERVI[CÇ]OS?\s+INTERNOS?|OBRAS?|CANTEIRO(?:\s+DE\s+OBRAS?)?|CALDEIRARIA(?:\s+(?:LEVE|PESADA))?|SERRARIA|ACM)\b/i;

const LEVEL_SUFFIX_RE =
  /\b(j[uú]nior|junior|pleno|s[eê]nior|senior)\b/i;

const PLACEHOLDER_RE =
  /^(?:[\s\-_*•.]+|\*{2,}|_{2,}|x{2,}|n\/a|s\/n|nao informado|não informado)$/i;

const ELABORADORA_HEAD_RE =
  /IDENTIFICA[CÇ][AÃ]O DA EMPRESA ELABORADORA|EMPRESA ELABORADORA(?:\s+DO\s+PGR)?/i;

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

function isNegatedAliasHit(textKey: string, alias: string): boolean {
  const index = textKey.indexOf(alias);
  if (index < 0) return false;
  const window = textKey.slice(
    Math.max(0, index - 48),
    index + alias.length + 48,
  );
  return /nao existente|inexistente|sem exposicao|n\/a\b/.test(window);
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

function firstValueLine(raw: string): string | null {
  for (const line of raw.split('\n').map((item) => cleanLine(item))) {
    if (!line || PLACEHOLDER_RE.test(line)) continue;
    if (
      /^(CNPJ|CEP|UF|CNAE|C\.N\.A\.E|MATRIZ|FILIAL|Complemento|Bairro|Endere[cç]o|Nome Empresarial|Nome de Fantasia|Raz[aã]o Social|Cidade|Munic[ií]pio(?:\s*\/\s*Estado)?|Identifica[cç][aã]o(?:\s+CONTRATADA)?|Grau de Risco|Descri[cç][aã]o CNAE)$/i.test(
        line,
      )
    ) {
      continue;
    }
    if (/^\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}$/.test(line)) continue;
    return line;
  }
  return null;
}

function isLikelyTocHit(text: string, index: number) {
  const newline = text.indexOf('\n', index);
  const line = text.slice(index, newline === -1 ? index + 180 : newline);
  return /\.{6,}|…{2,}|\.{3,}\s*\d+\s*$/.test(line);
}

function findNonTocIndex(text: string, re: RegExp): number {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const global = new RegExp(re.source, flags);
  let match: RegExpExecArray | null;
  while ((match = global.exec(text)) != null) {
    if (isLikelyTocHit(text, match.index)) continue;
    return match.index;
  }
  return -1;
}

/** Prefere o bloco da empresa contratada, nao o da consultoria que redigiu o PGR. */
function sliceClientCompanyBlock(text: string): string {
  const elaboradora = findNonTocIndex(text, ELABORADORA_HEAD_RE);
  const contracted = findNonTocIndex(text, /Identifica[cç][aã]o\s+CONTRATADA/i);
  const companyHead = findNonTocIndex(
    text,
    /IDENTIFICA[CÇ][AÃ]O DA EMPRESA(?!\s+ELABORADORA)/i,
  );

  const startCandidates = [contracted, companyHead].filter(
    (index) => index >= 0 && (elaboradora < 0 || index < elaboradora),
  );
  const start = startCandidates.length > 0 ? Math.min(...startCandidates) : -1;

  if (start >= 0) {
    const end =
      elaboradora > start
        ? elaboradora
        : Math.min(text.length, start + 3500);
    return text.slice(start, end);
  }
  if (elaboradora > 80) {
    return text.slice(0, elaboradora);
  }
  return text.slice(0, Math.min(text.length, 4500));
}

function fieldUntilStop(
  text: string,
  labels: string[],
  stopLabels: string[],
): string | null {
  for (const label of labels) {
    const stop = stopLabels.map((s) => s.replace(/\s+/g, '\\s+')).join('|');
    const re = new RegExp(
      `${label}\\s*[:\\-–]?\\s*([\\s\\S]{1,220}?)(?=${stop}|$)`,
      'i',
    );
    const match = text.match(re);
    if (match?.[1]) {
      const value = firstValueLine(match[1]) ?? cleanLine(match[1]);
      if (value && !PLACEHOLDER_RE.test(value)) return value;
    }
  }
  return null;
}

function isLikelyAddressLine(value: string | null): boolean {
  if (!value || PLACEHOLDER_RE.test(value)) return false;
  if (/^\d{2}\.?\d{3}\.?\d{3}/.test(value)) return false;
  if (!/[A-Za-zÀ-ÿ]{3,}/.test(value)) return false;
  if (/^(cnpj|matriz|filial|complemento)$/i.test(value)) return false;
  return true;
}

function cleanCompanyName(value: string | null): string | null {
  if (!value) return null;
  const name = cleanLine(value)
    .replace(/^\d{2}\.?\d{3}\.?\d{3}(?:\/\d{4}-?\d{2})?\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name || PLACEHOLDER_RE.test(name)) return null;
  if (/^(matriz|filial|cnpj|nome empresarial|razao social|razão social)$/i.test(name)) {
    return null;
  }
  if (name.length < 4) return null;
  return name;
}

function extractCompany(text: string, warnings: string[]): PgroCompanyData {
  const scope = sliceClientCompanyBlock(text);
  const cnpj = extractCnpj(scope) ?? extractCnpj(text);
  const legalNameRaw =
    firstValueLine(
      fieldUntilStop(
        scope,
        [
          'Nome Empresarial',
          'Razao Social',
          'Razão Social',
          'Nome da Empresa',
          'Empregador',
          'Identificacao CONTRATADA',
          'Identificação CONTRATADA',
        ],
        [
          'CNPJ',
          'Nome Fantasia',
          'Nome de Fantasia',
          'Endereco',
          'Endereço',
          'Municipio',
          'Município',
          'Cidade',
        ],
      ) ?? '',
    ) ??
    fieldUntilStop(
      scope,
      ['Razao Social', 'Razão Social', 'Nome da Empresa', 'Empregador'],
      ['CNPJ', 'Nome Fantasia', 'Endereco', 'Endereço', 'Municipio', 'Município'],
    ) ??
    null;
  const legalName = cleanCompanyName(legalNameRaw);

  const tradeNameRaw = fieldUntilStop(
    scope,
    ['Nome de Fantasia', 'Nome Fantasia', 'Fantasia'],
    [
      'CNPJ',
      'Endereco',
      'Endereço',
      'Municipio',
      'Município',
      'Cidade',
      'Razao',
      'Razão',
      'Complemento',
    ],
  );
  const tradeName =
    tradeNameRaw && !PLACEHOLDER_RE.test(tradeNameRaw) ? tradeNameRaw : null;

  let addressLine =
    fieldUntilStop(scope, ['Endereco', 'Endereço', 'Logradouro'], [
      'Municipio',
      'Município',
      'Cidade',
      'UF',
      'Estado',
      'CEP',
      'CNAE',
      'Complemento',
      'Bairro',
    ]) ?? null;
  if (!isLikelyAddressLine(addressLine)) {
    const street = scope.match(
      /\b(?:RUA|R\.|AV(?:ENIDA|\.)?|AL(?:AMEDA|\.)?|ROD(?:OVIA|\.)?|R)\s+[A-ZÀ-Ÿ][^\n]{4,80}/i,
    );
    addressLine = street ? cleanLine(street[0]) : null;
  }
  if (!isLikelyAddressLine(addressLine)) addressLine = null;

  let city: string | null = null;
  let state: string | null = null;

  const cityStateMatch = scope.match(
    /Munic[ií]pio\s*[:\-]?\s*([A-Za-zÀ-ÿ' .\-]+?)\s+(?:Estado|UF)\s*[:\-]?\s*([A-Za-z]{2})\b/i,
  );
  if (cityStateMatch) {
    city = cleanLine(cityStateMatch[1]);
    state = cityStateMatch[2].toUpperCase();
  } else {
    const cityOnly = fieldUntilStop(
      scope,
      ['Municipio', 'Município', 'Cidade'],
      ['Estado', 'UF', 'CEP', 'CNAE', 'Grau', 'Bairro', 'Complemento'],
    );
    if (cityOnly) {
      city = cleanLine(
        cityOnly.replace(/\bEstado\b.*$/i, '').replace(/\bUF\b.*$/i, ''),
      );
    }
    const ufMatch = scope.match(/\b(?:Estado|UF)\s*[:\-]?\s*([A-Za-z]{2})\b/i);
    if (ufMatch) state = ufMatch[1].toUpperCase();
  }

  if (city) {
    city = city
      .replace(/\bEstado\b.*$/i, '')
      .replace(/\bUF\b.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    const cityUf = city.match(/^([A-Za-zÀ-ÿ' .\-]+?)\s*[–\-]\s*([A-Za-z]{2})$/);
    if (cityUf) {
      city = cleanLine(cityUf[1]);
      if (!state) state = cityUf[2].toUpperCase();
    }
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
  const cnaeMatch = scope.match(
    /CNAE\s*[:\-]?\s*(\d{2}\.?\d{2}-?\d(?:-\d{2})?|\d{4,7}(?:-\d{1,2})?)/i,
  );
  if (cnaeMatch) cnae = cleanLine(cnaeMatch[1]);

  let riskGrade: string | null = null;
  const riskMatch = scope.match(/Grau\s+de\s+[Rr]isco\s*[:\-]?\s*([1-4])\b/);
  if (riskMatch) riskGrade = riskMatch[1];

  let employeeCount: number | null = null;
  const empMatch = scope.match(
    /(?:N[ºo°]\.?\s*(?:de\s*)?(?:Funcion[aá]rios|trabalhadores)|Numero\s+de\s+Funcionarios|Total\s+de\s+(?:funcion[aá]rios|trabalhadores)|Funcion[aá]rios por sexo)\s*[:\-]?\s*(\d{1,5})/i,
  );
  if (empMatch) employeeCount = Number(empMatch[1]);
  if (employeeCount == null) {
    const totalMatch = scope.match(
      /Total\s+de\s+funcion[aá]rios\s+(\d{1,5})/i,
    );
    if (totalMatch) employeeCount = Number(totalMatch[1]);
  }

  return {
    legalName,
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
  if (!key || key.length < 2) return true;
  if (STOP_WORDS.has(key)) return true;
  if (JUNK_NAME_RE.test(key)) return true;
  // Siglas de setor (ACM, QMA) — 2 a 5 letras — nao sao lixo.
  if (/^[a-z]{2,5}$/i.test(key)) return false;
  if (key.split(' ').length === 1 && key.length <= 3) return true;
  if (/^(?:i|ii|iii|iv|v)(?:\s*,\s*(?:i|ii|iii|iv|v))*$/i.test(key)) return true;
  return false;
}

function looksLikeSectorCode(name: string): boolean {
  const cleaned = cleanLine(name);
  return /^[A-ZÀ-Ÿ]{2,6}(?:\s*\([A-Z0-9/]+\))?$/u.test(cleaned);
}

/**
 * "Produção Senior" / "Almoxarifado Júnior" sao fragmento de cargo, nao setor.
 */
function hasJobLevelSuffix(name: string): boolean {
  return LEVEL_SUFFIX_RE.test(cleanLine(name));
}

/**
 * Aceita setor real (ACM, Caldeiraria Leve, PRODUÇÃO SERRARIA) e rejeita cargo disfarçado.
 */
function resolveSectorLine(line: string): string | null {
  const cleaned = cleanLine(line);
  if (!cleaned) return null;
  if (hasJobLevelSuffix(cleaned)) return null;
  if (looksLikeJobTitle(cleaned) && !KNOWN_SECTOR_RE.test(cleaned)) return null;

  if (looksLikeSectorCode(cleaned)) {
    return cleaned.toUpperCase();
  }

  const known = cleaned.match(KNOWN_SECTOR_RE);
  if (known && known.index === 0) {
    const rest = cleanLine(cleaned.slice(known[0].length));
    if (!rest) return known[0].toUpperCase().replace(/\s+/g, ' ').trim();
    if (hasJobLevelSuffix(rest)) return null;
    if (looksLikeJobTitle(rest)) return null;
    // Ex.: "Produção Serraria", "Qualidade (QMA)", "Caldeiraria Leve"
    if (rest.length <= 24 && rest.split(/\s+/).length <= 2) {
      return cleaned.toUpperCase().replace(/\s+/g, ' ').trim();
    }
    return known[0].toUpperCase().replace(/\s+/g, ' ').trim();
  }

  // Title Case departamento (Caldeiraria Leve / Caldeiraria Pesada)
  if (
    /^[A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ]+){0,2}$/u.test(cleaned) &&
    cleaned.length <= 35 &&
    cleaned.split(/\s+/).length <= 3 &&
    !isProseLine(cleaned) &&
    (SECTOR_HINT_RE.test(normalizeTextKey(cleaned)) ||
      /^(caldeiraria|serraria|pintura|solda|usinagem|montagem|adesivagem)/i.test(
        normalizeTextKey(cleaned),
      ))
  ) {
    return cleaned.toUpperCase().replace(/\s+/g, ' ').trim();
  }

  if (
    isValidSectorName(cleaned) &&
    !looksLikeJobTitle(cleaned) &&
    cleaned === cleaned.toUpperCase() &&
    cleaned.length <= 30
  ) {
    return cleaned.toUpperCase().replace(/\s+/g, ' ').trim();
  }

  return null;
}

function looksLikeJobTitle(name: string): boolean {
  return (
    JOB_HINT_RE.test(name) ||
    /\([IVX,\s]+\)/i.test(name) ||
    /\b(?:III|II|IV|V|I)\b/i.test(name)
  );
}

function isEnvironmentLine(line: string): boolean {
  const cleaned = cleanLine(line);
  if (ENVIRONMENT_LINE_RE.test(cleaned)) return true;
  if (/^TRABALHAM\b/i.test(cleaned)) return true;
  if (/^TRABALHOS\b/i.test(cleaned)) return true;
  return false;
}

function isProseLine(line: string): boolean {
  const cleaned = cleanLine(line);
  if (!cleaned) return false;
  if (isEnvironmentLine(cleaned)) return true;
  if (cleaned.length > 70) return true;
  if (ACTIVITY_START_RE.test(cleaned) && cleaned.split(/\s+/).length >= 6) {
    return true;
  }
  // Frases com pontuação / minúsculas longas = descrição
  if (/[.;:]/.test(cleaned) && cleaned.split(/\s+/).length >= 5) return true;
  if (
    /[a-zà-ÿ]/.test(cleaned) &&
    cleaned.split(/\s+/).length >= 8 &&
    !looksLikeJobTitle(cleaned)
  ) {
    return true;
  }
  return false;
}

function isIncompleteJobFragment(name: string): boolean {
  const cleaned = cleanLine(name);
  if (/\b(DE|DA|DO|DOS|DAS|E)$/i.test(cleaned)) return true;
  // Cargo sozinho demais curto sem complemento (ex.: AUXILIAR, TÉCNICO DE)
  const words = cleaned.split(/\s+/);
  if (
    words.length === 1 &&
    JOB_HINT_RE.test(cleaned) &&
    !/^(diretor|diretora|motorista|gerente|supervisor|coordenador|vendedor|pedreiro|pintor|soldador|eletricista|montador)$/i.test(
      cleaned,
    )
  ) {
    return true;
  }
  return false;
}

function canJoinJobContinuation(current: string, next: string): boolean {
  const a = cleanLine(current);
  const b = cleanLine(next);
  if (!a || !b) return false;
  if (isProseLine(b) || isEnvironmentLine(b)) return false;
  if (b.length > 45) return false;
  if (/[.;]/.test(b)) return false;

  // Se o atual já é um cargo completo, não colar o próximo cargo/setor
  // (exceto sufixo de especialidade: TÉCNICA, EXTERNO, etc.)
  const titleSuffix =
    /^(t[eé]cnica|t[eé]cnico|externo|externa|interno|carreteiro|geral|j[uú]nior|pleno|s[eê]nior)$/i;
    if (
      isValidFunctionName(normalizeFunctionDisplayName(a)) &&
      !isIncompleteJobFragment(a) &&
      (looksLikeJobTitle(b) || Boolean(resolveSectorLine(b))) &&
      !titleSuffix.test(b) &&
      !hasJobLevelSuffix(b)
    ) {
      return false;
    }

  // AJUDANTE DE INSTALAÇÃO + TÉCNICA / VENDEDOR + TÉCNICO
  if (
    looksLikeJobTitle(a) &&
    titleSuffix.test(b) &&
    a.split(/\s+/).length <= 5
  ) {
    return true;
  }

  const endsWithPrep = /\b(DE|DA|DO|DOS|DAS|E)$/i.test(a);
  const incomplete = isIncompleteJobFragment(a);
  const nextContinues =
    /^(DE|DA|DO|DOS|DAS|E)\b/i.test(b) ||
    /^(III|II|IV|V|I)\b/i.test(b) ||
    titleSuffix.test(b) ||
    // Title Case apos prep: "Auxiliar De" + "Produção Senior"
    (/^[A-Za-zÀ-ÿ0-9() ,./-]+$/u.test(b) &&
      b.split(/\s+/).length <= 4 &&
      !isProseLine(b) &&
      !/[.;:]/.test(b));

  // "TÉCNICO DE" + "MANUTENÇÃO" / "AUXILIAR" + "ADMINISTRATIVO"
  // permite juntar mesmo se a próxima palavra for setor conhecido.
  if ((endsWithPrep || incomplete) && nextContinues && looksLikeJobTitle(a)) {
    return true;
  }

  // Não juntar setor puro na sequência (exceto casos acima)
  if (
    resolveSectorLine(b) &&
    !looksLikeJobTitle(b) &&
    !hasJobLevelSuffix(b) &&
    b.split(/\s+/).length <= 2
  ) {
    return false;
  }

  if (incomplete && nextContinues) return true;

  // INSTALADOR + TÉCNICO
  if (
    looksLikeJobTitle(a) &&
    a.split(/\s+/).length <= 3 &&
    looksLikeJobTitle(b) &&
    b.split(/\s+/).length <= 2 &&
    !isValidFunctionName(normalizeFunctionDisplayName(a))
  ) {
    return true;
  }

  return false;
}

/**
 * Recompõe cargos quebrados em várias linhas do PDF.
 * Ex.: "ENCARREGADO" + "DE PRODUÇÃO" → "ENCARREGADO DE PRODUÇÃO"
 */
export function mergeBrokenJobTitleLines(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    let current = cleanLine(lines[i]);
    while (i + 1 < lines.length && canJoinJobContinuation(current, lines[i + 1])) {
      i += 1;
      current = `${current} ${cleanLine(lines[i])}`.replace(/\s+/g, ' ').trim();
    }
    out.push(current);
    i += 1;
  }
  return out;
}

/** "APOIO ADM AUXILIAR DE LIMPEZA" → setor + função. */
function splitSectorAndFunctionSameLine(
  line: string,
): { sector: string; functionName: string } | null {
  const cleaned = cleanLine(line);
  const sectorMatch = cleaned.match(KNOWN_SECTOR_RE);
  if (!sectorMatch || sectorMatch.index !== 0) return null;
  const sectorName = sectorMatch[0].toUpperCase().replace(/\s+/g, ' ').trim();
  const rest = cleanLine(cleaned.slice(sectorMatch[0].length));
  if (!rest || !looksLikeJobTitle(rest)) return null;
  if (!isValidFunctionName(normalizeFunctionDisplayName(rest))) return null;
  return { sector: sectorName, functionName: rest };
}

function isValidSectorName(name: string): boolean {
  const cleaned = cleanLine(name);
  if (hasJobLevelSuffix(cleaned)) return false;
  if (
    /^(fun[cç][aã]o(?:es)?|setor|ghe|cbo|anexo|descri[cç][aã]o(?:\s+do\s+cargo)?|local|epi|epc|servi[cç]os?|externos?|internos?|ambiente)$/i.test(
      cleaned,
    )
  ) {
    return false;
  }
  if (isJunkName(cleaned)) return false;
  if (isEnvironmentLine(cleaned)) return false;
  if (cleaned.length > 40) return false;
  const words = cleaned.split(/\s+/);
  if (words.length > 4) return false;
  if (/\d{3,}/.test(cleaned)) return false;
  if (/[.!?]/.test(cleaned)) return false;
  if (
    /\b(executar|realizar|atividade|ambiente|conforme|quando|outras|tarefas|responsaveis|responsabilidades|trabalham|trabalhos)\b/i.test(
      cleaned,
    )
  ) {
    return false;
  }
  // Cargo não vira setor (exceto se for nome de setor conhecido)
  if (looksLikeJobTitle(cleaned) && !SECTOR_HINT_RE.test(normalizeTextKey(cleaned))) {
    return false;
  }
  if (
    !SECTOR_HINT_RE.test(normalizeTextKey(cleaned)) &&
    !KNOWN_SECTOR_RE.test(cleaned) &&
    words.length > 2
  ) {
    return false;
  }
  return true;
}

function isValidFunctionName(name: string): boolean {
  const cleaned = cleanLine(name);
  if (isJunkName(cleaned)) return false;
  if (isEnvironmentLine(cleaned)) return false;
  if (isIncompleteJobFragment(cleaned)) return false;
  if (cleaned.length < 3 || cleaned.length > 80) return false;
  const words = cleaned.split(/\s+/);
  if (words.length > 8) return false;
  if (/[.!?]$/.test(cleaned)) return false;
  if (
    /\b(executar|realizar|outras tarefas|de acordo|gravidade|natureza|notifique|superior|imediat|caracteristicas|descricao|riscos?|medidas?|aprho|protetor auricular|respirador|botina de|oculos de|óculos de|luva de|cinta lombar|avental de|responsaveis em|esta sob as responsabilidades|trabalham em|selecionam os)\b/i.test(
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
  if (!looksLikeJobTitle(cleaned) && words.length <= 3) {
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
    .flatMap((part) => {
      if (/[IVX]+/i.test(part) && /,(?:\s*(?:III|II|IV|V|I)\b)/i.test(part)) {
        return [part];
      }
      if (/,/.test(part) && looksLikeJobTitle(part)) {
        return part.split(/\s*,\s*/);
      }
      return [part];
    })
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
    /Caracteriza[cç][aã]o\s+do\s+GHE\s*(\d+)\s*[–\-—:]?\s*([^\n]{0,200})/gi;
  const headers: Array<{ index: number; number: string; label: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(text)) != null) {
    let label = cleanLine(match[2] ?? '');
    if (!label || /^(SETOR|FUN[CÇ]|CARGO|CBO)\b/i.test(label)) {
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 240);
      const nextLine = after.split(/\n/).map((l) => cleanLine(l)).find((l) => l.length >= 3);
      if (nextLine && !/^APRHO\b/i.test(nextLine) && !/^Caracteriza/i.test(nextLine)) {
        label = nextLine.slice(0, 160);
      }
    }
    headers.push({
      index: match.index,
      number: match[1].padStart(2, '0'),
      label: label || `GHE ${match[1]}`,
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

  return mergeGheBlocks(blocks, extractCargoTableGheBlocks(text));
}

function mergeGheBlocks(primary: GheBlock[], extra: GheBlock[]): GheBlock[] {
  if (extra.length === 0) return primary;
  if (primary.length === 0) return extra;
  const byNumber = new Map<string, GheBlock>();
  for (const block of [...primary, ...extra]) {
    const existing = byNumber.get(block.gheNumber);
    if (!existing) {
      byNumber.set(block.gheNumber, block);
      continue;
    }
    existing.pairs = [...existing.pairs, ...block.pairs];
    existing.body = `${existing.body}\n${block.body}`;
  }
  return [...byNumber.values()];
}

function pickFirstValidSector(
  ...candidates: Array<string | null | undefined>
): string | null {
  const valid: string[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const cleaned = cleanLine(candidate);
    if (!isValidSectorName(cleaned)) continue;
    valid.push(cleaned.toUpperCase());
  }
  if (valid.length === 0) return null;
  valid.sort((a, b) => b.length - a.length);
  return valid[0];
}

function extractSetorField(slice: string): string | null {
  const labeled = [
    ...slice.matchAll(
      /(?:SETOR|AREA|ÁREA|DEPARTAMENTO|SETOR\s*\/\s*AREA|SETOR\s*\/\s*ÁREA)\s*[:\-]\s*([A-Za-zÀ-ÿ0-9 .\/-]{3,60})/gi,
    ),
  ];
  for (const match of labeled) {
    const raw = cleanLine(match[1].replace(/\s+GHE\s*[:.]?\s*\d+.*$/i, ''));
    if (isValidSectorName(raw)) return raw.toUpperCase();
  }
  return null;
}

/**
 * Layout tipo "TABELA DE DESCRIÇÃO DE CARGOS" / inventario (sem Caracterizacao do GHE).
 * Ex.: GHE 01 + Serviços Externos + FUNÇÃO Montador
 */
function extractCargoTableGheBlocks(text: string): GheBlock[] {
  const blocks: GheBlock[] = [];
  const headerRe = /\bGHE\s*0*(\d+)\b\s*[\n\r]+\s*([^\n]{3,80})/gi;
  const headers: Array<{ index: number; number: string; label: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(text)) != null) {
    const label = cleanLine(match[2]);
    if (/^P[aá]gina\b|^ANEXO\b|^FUN[CÇ]/i.test(label)) continue;
    headers.push({
      index: match.index,
      number: match[1].padStart(2, '0'),
      label,
    });
  }

  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i];
    const hardStop = text.slice(header.index).search(
      /\n\s*(ANEXO\s+[IVX]+|INVENT[AÁ]RIO DE RISCO|LEVANTAMENTO DE PERIGOS)/i,
    );
    const naturalEnd =
      hardStop > 0
        ? header.index + hardStop
        : (headers[i + 1]?.index ?? Math.min(text.length, header.index + 2200));
    const slice = text.slice(header.index, naturalEnd);
    const pairs: SectorFunctionPair[] = [];
    const sector = pickFirstValidSector(extractSetorField(slice), header.label);
    const fnMatches = [
      ...slice.matchAll(
        /(?:FUN[CÇ][AÃ]O(?:ES)?|CARGO(?:S)?)\s*[:\-]?\s*([A-Za-zÀ-ÿ0-9 ,.\-/]{3,80})/gi,
      ),
    ];
    for (const fn of fnMatches) {
      const rawName = firstValueLine(fn[1]) ?? cleanLine(fn[1]);
      if (/^(CBO|DESCRI|SETOR|GHE|N[ºo°])/i.test(rawName)) continue;
      for (const name of expandFunctionNames(rawName)) {
        pairs.push({
          sectorName: sector,
          functionName: name,
          activity: null,
          environment: null,
          rawText: rawName,
        });
      }
    }
    if (pairs.length === 0) continue;
    blocks.push({
      gheNumber: header.number,
      gheName: `GHE ${header.number} – ${header.label}`,
      headerLabel: header.label,
      pairs,
      body: slice.slice(0, 2500),
    });
  }
  return blocks;
}

/**
 * Extrai pares setor→função dentro de um bloco de caracterização.
 * Layout real PDF: tabela sem rótulos, cargos multilinha, funções após descrição.
 */
function extractSectorFunctionPairsFromGheBody(
  body: string,
  headerLabel: string,
): SectorFunctionPair[] {
  const pairs: SectorFunctionPair[] = [];
  const rawLines = body
    .split(/\n/)
    .map((l) => cleanLine(l))
    .filter(Boolean)
    .filter(
      (line) =>
        !/^Caracteriza/i.test(line) &&
        !/^APRHO\b/i.test(line) &&
        !/^Setor\s+Cargo/i.test(line) &&
        !/^Cargo\/?Fun[cç][aã]o\s+Descri/i.test(line) &&
        !/^PGR\b/i.test(line) &&
        !/^GRO\b/i.test(line) &&
        !/^PORTARIA\b/i.test(line) &&
        !/^Norma Regulamentadora\b/i.test(line) &&
        !/^Revis[aã]o\s+\d+/i.test(line) &&
        !/^INSEG\b/i.test(line) &&
        !/^\d{1,3}$/.test(line),
    );

  const lines = mergeBrokenJobTitleLines(rawLines);
  let currentSector: string | null = null;
  let sawTableFunction = false;
  let awaitingFunction = false;

  const pushFunction = (fnRaw: string, sector: string | null, rawText: string) => {
    const names = expandFunctionNames(fnRaw);
    for (const fn of names) {
      if (!isValidFunctionName(fn)) continue;
      sawTableFunction = true;
      pairs.push({
        sectorName: sector,
        functionName: fn,
        activity: null,
        environment: null,
        rawText,
      });
    }
  };

  for (const line of lines) {
    // Não abortar o bloco: pular prosa/ambiente e continuar até o APRHO
    if (isProseLine(line) || isEnvironmentLine(line)) continue;
    if (/^Descri[cç][aã]o\s+da\s+Atividade\b/i.test(line)) continue;
    if (/^Descri[cç][aã]o\s+do\s+Ambiente\b/i.test(line)) continue;

    const sectorLabel = line.match(/^(?:Setor)\s*[:\-–]?\s*(.+)$/i);
    if (sectorLabel) {
      const candidate = cleanLine(sectorLabel[1]).toUpperCase();
      const split = splitSectorAndFunctionSameLine(candidate);
      if (split) {
        currentSector = split.sector;
        pushFunction(split.functionName, currentSector, line);
      } else if (isValidSectorName(candidate)) {
        currentSector = candidate;
      }
      continue;
    }

    if (/^(?:Cargo\/?Fun[cç][aã]o|Cargo|Fun[cç][aã]o(?:es)?)\s*[:\-–]?\s*$/i.test(line)) {
      awaitingFunction = true;
      continue;
    }
    if (awaitingFunction) {
      awaitingFunction = false;
      if (
        !/^(CBO|DESCRI|SETOR|GHE|N[ºo°]|JORNADA|LOCAL)\b/i.test(line) &&
        (looksLikeJobTitle(line) || isValidFunctionName(line))
      ) {
        pushFunction(line, currentSector, line);
        continue;
      }
    }

    const functionLabel = line.match(
      /^(?:Cargo\/?Fun[cç][aã]o|Cargo|Fun[cç][aã]o(?:es)?)\s*[:\-–]?\s+(.+)$/i,
    );
    if (functionLabel) {
      pushFunction(functionLabel[1], currentSector, line);
      continue;
    }

    const sameLine = splitSectorAndFunctionSameLine(line);
    if (sameLine) {
      currentSector = sameLine.sector;
      pushFunction(sameLine.functionName, currentSector, line);
      continue;
    }

    const sectorResolved = resolveSectorLine(line);
    if (sectorResolved) {
      currentSector = sectorResolved;
      continue;
    }

    if (looksLikeJobTitle(line) || isValidFunctionName(line)) {
      pushFunction(line, currentSector, line);
      continue;
    }
  }

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

  if (pairs.length === 0 && currentSector && looksLikeJobTitle(headerLabel)) {
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

  if (currentSector) {
    for (const pair of pairs) {
      if (!pair.sectorName) pair.sectorName = currentSector;
    }
  }

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
  _allFunctionNames: string[],
  extraRiskAliases: Array<{
    raw: string;
    canonical: string;
    category?: OccupationalRiskCategory | null;
  }> = [],
): PgroExtractedRisk[] {
  const risks: PgroExtractedRisk[] = [];

  type RiskSeedLike = {
    name: string;
    category: OccupationalRiskCategory;
    aliases: string[];
  };

  const seeds: RiskSeedLike[] = [
    ...DEFAULT_OCCUPATIONAL_RISK_SEEDS.map((s) => ({
      name: s.name,
      category: s.category,
      aliases: [...s.aliases],
    })),
  ];
  for (const extra of extraRiskAliases) {
    const canonical = cleanLine(extra.canonical);
    if (!canonical) continue;
    const existing = seeds.find(
      (s) => normalizeTextKey(s.name) === normalizeTextKey(canonical),
    );
    if (existing) {
      existing.aliases.push(extra.raw, canonical);
      continue;
    }
    seeds.push({
      name: canonical,
      category: extra.category ?? OccupationalRiskCategory.ACIDENTE,
      aliases: [extra.raw, canonical],
    });
  }

  const pushSeedHits = (
    scopeText: string,
    functionNames: string[],
    gheName: string | null,
    extractionSource: ExtractionSource,
    pairs: SectorFunctionPair[] = [],
  ) => {
    const textKey = normalizeTextKey(scopeText);
    const activity = pairs
      .map((pair) => pair.activity)
      .filter((value): value is string => Boolean(value?.trim()))
      .join(' ');
    const environment =
      pairs.find((pair) => pair.environment?.trim())?.environment ?? null;
    const jobName = functionNames[0] ?? null;
    const sectorName = pairs.find((pair) => pair.sectorName)?.sectorName ?? null;
    for (const seed of seeds) {
      const aliases = [seed.name, ...seed.aliases].map(normalizeTextKey);
      const hit = aliases.some(
        (alias) =>
          alias.length >= 4 &&
          textKey.includes(alias) &&
          !isNegatedAliasHit(textKey, alias),
      );
      if (!hit) continue;
      const aprho = extractAprhoAgentDetails(scopeText, seed.name, seed.aliases);
      const inferred = inferOsRiskContext({
        agent: seed.name,
        category: seed.category,
        jobName,
        sectorName,
        activity,
        environment,
        extractedSource: aprho.source,
        extractedExposure: aprho.exposure,
        extractedQuantitative: aprho.quantitative,
      });
      risks.push({
        tempId: randomUUID(),
        name: seed.name,
        category: seed.category,
        exposure: inferred.exposure,
        source: inferred.source,
        possibleDamage: inferred.quantitative,
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
        `APRHO\\s+do\\s+GHE\\s*0*${Number(block.gheNumber)}[\\s\\S]{0,12000}`,
        'i',
      );
      const aprho = fullText.match(aprhoRe)?.[0] ?? block.body;
      const fnNames = block.pairs.map((p) => p.functionName);
      pushSeedHits(aprho, fnNames, block.gheName, 'GHE', block.pairs);
    }
  } else {
    // Sem GHE: detecta risco mas nao associa a todas as funcoes (payload enorme).
    pushSeedHits(fullText, [], null, 'KEYWORD');
  }

  // Passada global so para achar riscos faltantes — sem inflar functionNames.
  pushSeedHits(fullText, [], null, 'KEYWORD');

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
    if (!existing.source && risk.source) existing.source = risk.source;
    if (!existing.exposure && risk.exposure) existing.exposure = risk.exposure;
    if (!existing.possibleDamage && risk.possibleDamage) {
      existing.possibleDamage = risk.possibleDamage;
    }
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
  _allFunctionNames: string[],
  _riskNames: string[],
  warnings: string[],
  extraEpiAliases: Array<{ raw: string; canonical: string }> = [],
): PgroExtractedEpiNeed[] {
  const found: PgroExtractedEpiNeed[] = [];
  const seen = new Set<string>();

  type EpiSeedLike = { name: string; aliases: string[] };
  const seeds: EpiSeedLike[] = [
    ...DEFAULT_EPI_NEED_SEEDS.map((s) => ({
      name: s.name,
      aliases: [...s.aliases],
    })),
  ];
  for (const extra of extraEpiAliases) {
    const canonical = cleanLine(extra.canonical);
    if (!canonical) continue;
    const existing = seeds.find(
      (s) => normalizeTextKey(s.name) === normalizeTextKey(canonical),
    );
    if (existing) {
      existing.aliases.push(extra.raw, canonical);
      continue;
    }
    seeds.push({ name: canonical, aliases: [extra.raw, canonical] });
  }

  const scan = (
    scopeText: string,
    functionNames: string[],
    gheName: string | null,
    extractionSource: ExtractionSource,
  ) => {
    const textKey = normalizeTextKey(scopeText);
    for (const seed of seeds) {
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
        // Nao copia todas as funcoes/riscos — estoura o body no confirm (Maestralle ~100kb+).
        functionNames: associated ? [...functionNames] : [],
        riskNames: [],
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
        `APRHO\\s+do\\s+GHE\\s*0*${Number(block.gheNumber)}[\\s\\S]{0,12000}`,
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
    scan(fullText, [], null, 'GLOBAL');
  }

  scan(fullText, [], null, 'KEYWORD');

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

export function detectPgroLayout(rawText: string): PgroLayoutKind {
  const text = rawText.replace(/\r/g, '\n');
  if (/Caracteriza[cç][aã]o\s+do\s+GHE\s*\d+/i.test(text)) {
    return 'GHE_APRHO';
  }
  if (
    /\bGHE\s*0*\d+\b/i.test(text) &&
    /(?:FUN[CÇ][AÃ]O(?:ES)?|CARGO(?:S)?)\s*[:\-]?/i.test(text)
  ) {
    return 'CARGO_TABLE';
  }
  if (/APRHO\s+do\s+GHE/i.test(text)) {
    return 'GHE_APRHO';
  }
  return 'UNKNOWN';
}

export function isPgroStructureWeak(result: {
  layout: PgroLayoutKind;
  sectors: unknown[];
  functions: unknown[];
  textExtractable: boolean;
}): boolean {
  if (!result.textExtractable) return true;
  if (result.sectors.length === 0 || result.functions.length === 0) return true;
  if (result.layout === 'UNKNOWN' && result.functions.length < 2) return true;
  return false;
}

const LEVEL_NAME_RE =
  /\b(j[uú]nior|junior|pleno|s[eê]nior|senior)\b/i;

/**
 * Quando a heuristic “acha” muita coisa errada (Word/PDF impresso), ainda assim
 * vale chamar a IA — nao so quando vem vazio.
 */
export function shouldUsePgroLlmFallback(result: PgroParseResult): boolean {
  if (!result.textExtractable) return false;
  if (isPgroStructureWeak(result)) return true;
  if (result.layout === 'UNKNOWN') return true;

  const sectorLevelHits = result.sectors.filter((s) =>
    LEVEL_NAME_RE.test(s.name),
  ).length;
  if (sectorLevelHits >= 1) return true;

  const noSector = result.functions.filter(
    (f) => !f.sectorName || !f.sectorName.trim(),
  ).length;
  if (
    result.functions.length >= 8 &&
    noSector / result.functions.length >= 0.3
  ) {
    return true;
  }

  // Documento grande com poucos setores reais → heuristic provavelmente errou.
  if (result.functions.length >= 40 && result.sectors.length <= 4) {
    return true;
  }

  return false;
}

/**
 * So troca a estrutura heuristica pela IA quando a heuristic esta
 * claramente quebrada. Nunca quando ela ja achou muitos GHEs/funcoes —
 * o trecho enviado a LLM nao cabe um PGR grande (50+ GHEs).
 */
export function shouldPreferLlmStructure(
  heuristic: PgroParseResult,
  llm: PgroParseResult,
): boolean {
  const levelHits = heuristic.sectors.filter((s) =>
    LEVEL_NAME_RE.test(s.name),
  ).length;
  const heuristicBroken =
    isPgroStructureWeak(heuristic) ||
    levelHits >= 1 ||
    (heuristic.functions.length >= 40 && heuristic.sectors.length <= 4);

  if (!heuristicBroken) return false;

  // LLM precisa trazer pelo menos uma estrutura utilizavel.
  if (llm.functions.length === 0 && llm.sectors.length === 0) return false;

  // Se a heuristic ja tem massa grande (PGR completo), nao descartar por um
  // JSON parcial da IA.
  if (
    heuristic.functions.length >= 20 &&
    llm.functions.length < Math.floor(heuristic.functions.length * 0.6)
  ) {
    return false;
  }

  return true;
}

function emptyParseResult(
  warnings: string[],
  textLength: number,
  layout: PgroLayoutKind = 'UNKNOWN',
): PgroParseResult {
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
    warnings,
    ignoredCandidates: [],
    textExtractable: false,
    textLength,
    layout,
    parseMethod: 'HEURISTIC',
    structureWeak: true,
  };
}

function applyLearnedNameAliases<T extends { name: string }>(
  items: T[],
  aliases: Array<{ raw: string; canonical: string }>,
): T[] {
  if (aliases.length === 0) return items;
  return items.map((item) => {
    const key = normalizeTextKey(item.name);
    const hit = aliases.find(
      (a) =>
        normalizeTextKey(a.raw) === key ||
        normalizeTextKey(a.canonical) === key,
    );
    if (!hit) return item;
    return { ...item, name: hit.canonical };
  });
}

export function parsePgroText(
  rawText: string,
  options?: ParsePgroOptions,
): PgroParseResult {
  const warnings: string[] = [];
  const ignoredCandidates: string[] = [];
  const text = rawText.replace(/\r/g, '\n');
  const compact = text.replace(/[ \t]+/g, ' ').trim();
  const textExtractable = compact.replace(/\s/g, '').length >= 80;
  const layout = detectPgroLayout(text);
  const extra = options?.extraAliases;

  if (!textExtractable) {
    return emptyParseResult(
      [
        'Este PDF parece nao ter texto extraivel. Use um PDF gerado digitalmente ou uma versao OCR.',
      ],
      compact.length,
      layout,
    );
  }

  const company = extractCompany(text, warnings);
  if (!company.cnpj) {
    warnings.push('CNPJ da empresa nao encontrado com confianca.');
  }
  if (!company.legalName) {
    warnings.push('Razao social nao encontrada com confianca.');
  }

  // Motor tabular (DOCX/Word): Caracterizacao + APRHO por linha de tabela.
  const headerCount = countCharacterizationHeaders(text);
  const tableBlocks = parseGheTableBlocks(text);
  const tabular = gheTableBlocksToExtracted(tableBlocks);
  const tabularStrong =
    headerCount > 0 &&
    tabular.stats.ghesWithFunctions >=
      Math.max(1, Math.ceil(headerCount * 0.85));

  if (tabularStrong) {
    warnings.push(
      `Motor tabular: ${tabular.stats.ghesWithFunctions}/${tabular.stats.gheHeaderCount} GHE(s) com funcao; ${tabular.stats.functionCount} funcao(oes), ${tabular.stats.sectorCount} setor(es), ${tabular.stats.riskRowCount} linha(s) de risco, ${tabular.stats.epiItemCount} EPI(s).`,
    );
    if (!tabular.stats.coverageOk) {
      warnings.push(
        'Cobertura tabular incompleta — revise setores/funcoes antes de confirmar.',
      );
    }

    let sectors = uniqueByName(
      applyLearnedNameAliases(tabular.sectors, extra?.sectors ?? []),
    );
    let functions = uniqueBySectorAndFunction(
      applyLearnedNameAliases(
        tabular.functions,
        extra?.jobFunctions ?? [],
      ) as PgroExtractedFunction[],
    );
    if (extra?.sectors?.length) {
      functions = functions.map((fn) => {
        if (!fn.sectorName) return fn;
        const hit = extra.sectors!.find(
          (a) =>
            normalizeTextKey(a.raw) === normalizeTextKey(fn.sectorName!) ||
            normalizeTextKey(a.canonical) === normalizeTextKey(fn.sectorName!),
        );
        return hit ? { ...fn, sectorName: hit.canonical } : fn;
      });
    }

    let risks = tabular.risks;
    let epiNeeds = tabular.epiNeeds;
    if (extra?.risks?.length) {
      risks = applyLearnedNameAliases(risks, extra.risks) as PgroExtractedRisk[];
    }
    if (extra?.epiNeeds?.length) {
      epiNeeds = epiNeeds.map((item) => {
        const key = normalizeTextKey(item.suggestedName);
        const hit = extra.epiNeeds!.find(
          (a) =>
            normalizeTextKey(a.raw) === key ||
            normalizeTextKey(a.canonical) === key,
        );
        return hit
          ? { ...item, suggestedName: hit.canonical, extractedText: hit.canonical }
          : item;
      });
    }

    const result: PgroParseResult = {
      company,
      sectors,
      functions,
      risks,
      epiNeeds,
      warnings,
      ignoredCandidates: ignoredCandidates.slice(0, 40),
      textExtractable: true,
      textLength: compact.length,
      layout: 'GHE_APRHO',
      parseMethod: 'HEURISTIC',
      structureWeak: false,
      coverage: tabular.stats,
    };
    result.structureWeak =
      isPgroStructureWeak(result) || !tabular.stats.coverageOk;
    return result;
  }

  if (headerCount > 0 && !tabularStrong) {
    warnings.push(
      `Motor tabular incompleto (${tabular.stats.ghesWithFunctions}/${headerCount} GHE). Usando heuristic legado como fallback.`,
    );
  }

  const gheBlocks = extractGheBlocks(text);
  if (gheBlocks.length === 0) {
    warnings.push(
      'Blocos de GHE/estrutura nao detectados pelo parser heuristic; setores/funcoes podem ficar incompletos.',
    );
  } else {
    warnings.push(
      `${gheBlocks.length} bloco(s) de estrutura detectados (layout ${layout}).`,
    );
  }
  if (layout === 'UNKNOWN') {
    warnings.push(
      'Layout do PGR nao reconhecido automaticamente — revise a extracao com cuidado.',
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

  let sectors = uniqueByName(
    applyLearnedNameAliases(sectorItems, extra?.sectors ?? []),
  );
  let functions = uniqueBySectorAndFunction(
    applyLearnedNameAliases(
      functionItems,
      extra?.jobFunctions ?? [],
    ) as PgroExtractedFunction[],
  );

  if (extra?.sectors?.length) {
    functions = functions.map((fn) => {
      if (!fn.sectorName) return fn;
      const hit = extra.sectors!.find(
        (a) =>
          normalizeTextKey(a.raw) === normalizeTextKey(fn.sectorName!) ||
          normalizeTextKey(a.canonical) === normalizeTextKey(fn.sectorName!),
      );
      return hit ? { ...fn, sectorName: hit.canonical } : fn;
    });
  }

  if (sectors.length === 0) {
    warnings.push('Nenhum setor valido identificado nos blocos de estrutura.');
  }
  if (functions.length === 0) {
    warnings.push(
      'Nenhuma funcao/cargo valida identificada nos blocos de estrutura.',
    );
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
    extra?.risks ?? [],
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
    extra?.epiNeeds ?? [],
  );
  if (epiNeeds.length === 0) {
    warnings.push(
      'Nenhum EPI necessario identificado nas medidas de controle. Voce ainda pode importar setores, funcoes e riscos.',
    );
  }

  const result: PgroParseResult = {
    company,
    sectors,
    functions,
    risks,
    epiNeeds,
    warnings,
    ignoredCandidates: ignoredCandidates.slice(0, 40),
    textExtractable: true,
    textLength: compact.length,
    layout,
    parseMethod: 'HEURISTIC',
    structureWeak: false,
  };
  result.structureWeak = isPgroStructureWeak(result);
  return result;
}

export type ReminedJobCoverage = {
  sectorName: string;
  functionName: string;
  risks: PgroExtractedRisk[];
  epiNeeds: PgroExtractedEpiNeed[];
  matchedGheNames: string[];
};

function namesLooselyMatch(a: string | null | undefined, b: string): boolean {
  if (!a?.trim() || !b.trim()) return false;
  const left = normalizeTextKey(a);
  const right = normalizeTextKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  const leftFn = normalizeFunctionKey(a);
  const rightFn = normalizeFunctionKey(b);
  return Boolean(leftFn && rightFn && leftFn === rightFn);
}

function gheBlockMatchesJob(
  block: GheBlock,
  sectorName: string,
  functionName: string,
): boolean {
  for (const pair of block.pairs) {
    if (namesLooselyMatch(pair.functionName, functionName)) return true;
    if (
      namesLooselyMatch(pair.sectorName, sectorName) &&
      namesLooselyMatch(pair.functionName, functionName)
    ) {
      return true;
    }
  }
  const hay = normalizeTextKey(
    `${block.gheName}\n${block.headerLabel}\n${block.body}`,
  );
  const sectorKey = normalizeTextKey(sectorName);
  const functionKeyNorm = normalizeTextKey(functionName);
  if (functionKeyNorm && hay.includes(functionKeyNorm)) return true;
  if (
    sectorKey &&
    hay.includes(sectorKey) &&
    functionKeyNorm &&
    hay.includes(functionKeyNorm.split(/\s+/).slice(0, 2).join(' '))
  ) {
    return true;
  }
  return false;
}

/**
 * Validacao reversa: a partir de setor/funcao da planilha, reabre o texto do PGR
 * e remonta riscos + necessidades dos GHEs que batem com esses nomes.
 * Prefere o motor tabular (Caracterizacao + APRHO); fallback no heuristic legado.
 */
export function reminePgroCoverageForJobs(
  rawText: string,
  jobs: Array<{ sectorName: string; functionName: string }>,
  options?: ParsePgroOptions,
): ReminedJobCoverage[] {
  const text = rawText.replace(/\r/g, '\n');
  if (text.replace(/\s/g, '').length < 80) return [];

  const tableBlocks = parseGheTableBlocks(text);
  const tabularReady =
    tableBlocks.filter((b) => b.pairs.length > 0).length >=
    Math.max(1, Math.ceil(countCharacterizationHeaders(text) * 0.5));

  if (tabularReady) {
    const out: ReminedJobCoverage[] = [];
    for (const job of jobs) {
      const sectorName = job.sectorName.trim();
      const functionName = job.functionName.trim();
      if (sectorName.length < 2 || functionName.length < 2) continue;

      const sectorKey = normalizeTextKey(sectorName);
      const functionKey = normalizeTextKey(functionName);
      const relevant = tableBlocks.filter((block) =>
        block.pairs.some((pair) => {
          const pairFn = normalizeTextKey(pair.functionName);
          const pairSector = normalizeTextKey(pair.sectorName);
          if (pairFn !== functionKey) return false;
          return (
            !sectorKey ||
            pairSector === sectorKey ||
            pairSector.includes(sectorKey) ||
            sectorKey.includes(pairSector)
          );
        }),
      );

      if (relevant.length === 0) {
        out.push({
          sectorName,
          functionName,
          risks: [],
          epiNeeds: [],
          matchedGheNames: [],
        });
        continue;
      }

      const riskMap = new Map<string, PgroExtractedRisk>();
      const epiMap = new Map<string, PgroExtractedEpiNeed>();

      for (const block of relevant) {
        for (const row of block.risks) {
          const key = normalizeTextKey(row.agent);
          const existing = riskMap.get(key);
          if (!existing) {
            riskMap.set(key, {
              tempId: randomUUID(),
              name: row.agent,
              category: row.category,
              exposure: row.exposure,
              source: row.source,
              possibleDamage: row.possibleDamage,
              riskLevel: row.riskLevel,
              functionNames: [functionName],
              rawText: row.agent,
              included: true,
              confidence: 'high',
              extractionSource: 'GHE',
              gheName: block.gheName,
            });
          } else if (!existing.functionNames.includes(functionName)) {
            existing.functionNames.push(functionName);
          }

          for (const epi of row.epiTexts) {
            const epiKey = normalizeTextKey(epi);
            const prev = epiMap.get(epiKey);
            if (!prev) {
              epiMap.set(epiKey, {
                tempId: randomUUID(),
                extractedText: epi,
                suggestedName: epi,
                matchedEpiNeedId: null,
                matchedEpiNeedName: null,
                createNew: true,
                functionNames: [functionName],
                riskNames: [row.agent],
                included: true,
                confidence: 'high',
                extractionSource: 'GHE',
                gheName: block.gheName,
              });
            } else {
              if (!prev.functionNames.includes(functionName)) {
                prev.functionNames.push(functionName);
              }
              if (!prev.riskNames.includes(row.agent)) {
                prev.riskNames.push(row.agent);
              }
            }
          }
        }
      }

      let risks = [...riskMap.values()];
      let epiNeeds = [...epiMap.values()];
      if (options?.extraAliases?.risks?.length) {
        risks = applyLearnedNameAliases(
          risks,
          options.extraAliases.risks,
        ) as PgroExtractedRisk[];
      }
      if (options?.extraAliases?.epiNeeds?.length) {
        epiNeeds = epiNeeds.map((item) => {
          const key = normalizeTextKey(item.suggestedName);
          const hit = options.extraAliases!.epiNeeds!.find(
            (a) =>
              normalizeTextKey(a.raw) === key ||
              normalizeTextKey(a.canonical) === key,
          );
          return hit
            ? {
                ...item,
                suggestedName: hit.canonical,
                extractedText: hit.canonical,
              }
            : item;
        });
      }

      out.push({
        sectorName,
        functionName,
        risks,
        epiNeeds,
        matchedGheNames: [...new Set(relevant.map((b) => b.gheName))],
      });
    }
    return out;
  }

  const blocks = extractGheBlocks(text);
  const extra = options?.extraAliases;
  const out: ReminedJobCoverage[] = [];

  for (const job of jobs) {
    const sectorName = job.sectorName.trim();
    const functionName = job.functionName.trim();
    if (sectorName.length < 2 || functionName.length < 2) continue;

    const relevant = blocks.filter((block) =>
      gheBlockMatchesJob(block, sectorName, functionName),
    );
    if (relevant.length === 0) {
      out.push({
        sectorName,
        functionName,
        risks: [],
        epiNeeds: [],
        matchedGheNames: [],
      });
      continue;
    }

    const risks = extractRisksFromBlocks(
      text,
      relevant,
      [functionName],
      extra?.risks ?? [],
    ).map((risk) => ({
      ...risk,
      tempId: randomUUID(),
      functionNames: [...new Set([...risk.functionNames, functionName])],
      included: true,
    }));

    const epiNeeds = extractEpiNeedsFromBlocks(
      text,
      relevant,
      [functionName],
      risks.map((r) => r.name),
      [],
      extra?.epiNeeds ?? [],
    ).map((epi) => ({
      ...epi,
      tempId: randomUUID(),
      functionNames: [...new Set([...epi.functionNames, functionName])],
      included: true,
    }));

    out.push({
      sectorName,
      functionName,
      risks,
      epiNeeds,
      matchedGheNames: [...new Set(relevant.map((b) => b.gheName))],
    });
  }

  return out;
}

export function fingerprintText(text: string): string {
  return createHash('sha1').update(normalizeTextKey(text)).digest('hex');
}
