import type { OccupationalRiskCategory } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  canonicalizeEpiNeedLabel,
  collapseExtractedEpiLabels,
} from '../epi-needs/epi-need-canonical';
import { stripCnpj, validateCnpj } from '../common/cnpj';
import type {
  PgroExtractedEpiNeed,
  PgroExtractedFunction,
  PgroExtractedRisk,
  PgroExtractedSector,
} from './pgro-extract-types';
import type { PgroExtraAliasPack, PgroParseResult } from './pgro-parser';
import { normalizeTextKey } from './pgro-parser';

/**
 * Perfil Cony / matriz EPI×GHE.
 * Isolado do motor tabular Inseg (Caracterizacao/APRHO).
 */

export function parseConyEpiMatrixText(
  rawText: string,
  options?: { extraAliases?: PgroExtraAliasPack },
): PgroParseResult {
  const warnings: string[] = [];
  const text = rawText.replace(/\r/g, '\n');
  const compact = text.replace(/[ \t]+/g, ' ').trim();
  const textExtractable = compact.replace(/\s/g, '').length >= 80;

  if (!textExtractable) {
    return {
      company: emptyCompany(),
      sectors: [],
      functions: [],
      risks: [],
      epiNeeds: [],
      warnings: [
        'Este arquivo parece nao ter texto extraivel. Preferir DOCX ou PDF com texto selecionavel.',
      ],
      ignoredCandidates: [],
      textExtractable: false,
      textLength: compact.length,
      layout: 'UNKNOWN',
      parseMethod: 'HEURISTIC',
      structureWeak: true,
      coverage: null,
    };
  }

  const company = extractConyCompany(text, warnings);
  const ghes = extractConyGhes(text);
  if (ghes.length === 0) {
    warnings.push(
      'Perfil Cony: nenhum GHE com cargos encontrado. Confira se o documento e do layout matriz EPI/GHE.',
    );
  }

  const sectors: PgroExtractedSector[] = [];
  const functions: PgroExtractedFunction[] = [];
  const sectorKeys = new Set<string>();

  for (const ghe of ghes) {
    const sectorName = ghe.sectorName || `GHE ${ghe.code}`;
    const sectorKey = normalizeTextKey(sectorName);
    if (!sectorKeys.has(sectorKey)) {
      sectorKeys.add(sectorKey);
      sectors.push({
        tempId: randomUUID(),
        name: sectorName,
        rawText: ghe.rawHeader,
        included: true,
        confidence: 'high',
        source: 'GHE',
        gheName: `GHE ${ghe.code}`,
      });
    }
    for (const cargo of ghe.cargos) {
      functions.push({
        tempId: randomUUID(),
        name: cargo,
        sectorName,
        activityDescription: null,
        environmentDescription: null,
        gheName: `GHE ${ghe.code}`,
        rawText: cargo,
        included: true,
        confidence: 'high',
        source: 'GHE',
      });
    }
  }

  const matrix = extractConyEpiMatrix(text, ghes.map((g) => g.code));
  if (matrix.gheCodes.length === 0) {
    warnings.push(
      'Perfil Cony: tabela de EPI por GHE nao encontrada com clareza.',
    );
  }

  const functionsByGhe = new Map<string, string[]>();
  for (const fn of functions) {
    const code = gheCodeFromLabel(fn.gheName);
    if (!code) continue;
    const list = functionsByGhe.get(code) ?? [];
    list.push(fn.name);
    functionsByGhe.set(code, list);
  }

  const epiNeeds: PgroExtractedEpiNeed[] = [];
  for (const row of matrix.rows) {
    const labels = collapseExtractedEpiLabels([row.name]);
    const suggested =
      labels[0] ?? canonicalizeEpiNeedLabel(row.name) ?? row.name.trim();
    if (!suggested) continue;

    const functionNames: string[] = [];
    for (let i = 0; i < matrix.gheCodes.length; i += 1) {
      if (!row.marks[i]) continue;
      const code = matrix.gheCodes[i];
      for (const name of functionsByGhe.get(code) ?? []) {
        if (!functionNames.includes(name)) functionNames.push(name);
      }
    }
    if (functionNames.length === 0) continue;

    epiNeeds.push({
      tempId: randomUUID(),
      // Sem CA no texto exibido — CA e escolha de estoque do cliente, nao do PGR.
      extractedText: suggested,
      suggestedName: suggested,
      matchedEpiNeedId: null,
      matchedEpiNeedName: null,
      createNew: true,
      functionNames,
      riskNames: [],
      included: true,
      confidence: 'high',
      extractionSource: 'GHE',
      gheName:
        matrix.gheCodes
          .filter((_, i) => row.marks[i])
          .map((c) => `GHE ${c}`)
          .join(', ') || null,
    });
  }

  const risks = extractConyRisks(text, functionsByGhe);

  // Aliases aprendidos (org) — so nomes, sem misturar motor Inseg.
  const extra = options?.extraAliases;
  let finalFunctions = functions;
  let finalSectors = sectors;
  let finalEpis = epiNeeds;
  if (extra?.jobFunctions?.length) {
    finalFunctions = functions.map((fn) => {
      const hit = extra.jobFunctions!.find(
        (a) =>
          normalizeTextKey(a.raw) === normalizeTextKey(fn.name) ||
          normalizeTextKey(a.canonical) === normalizeTextKey(fn.name),
      );
      return hit ? { ...fn, name: hit.canonical } : fn;
    });
  }
  if (extra?.sectors?.length) {
    finalSectors = sectors.map((s) => {
      const hit = extra.sectors!.find(
        (a) =>
          normalizeTextKey(a.raw) === normalizeTextKey(s.name) ||
          normalizeTextKey(a.canonical) === normalizeTextKey(s.name),
      );
      return hit ? { ...s, name: hit.canonical } : s;
    });
    finalFunctions = finalFunctions.map((fn) => {
      if (!fn.sectorName) return fn;
      const hit = extra.sectors!.find(
        (a) =>
          normalizeTextKey(a.raw) === normalizeTextKey(fn.sectorName!) ||
          normalizeTextKey(a.canonical) === normalizeTextKey(fn.sectorName!),
      );
      return hit ? { ...fn, sectorName: hit.canonical } : fn;
    });
  }
  if (extra?.epiNeeds?.length) {
    finalEpis = epiNeeds.map((item) => {
      const hit = extra.epiNeeds!.find(
        (a) =>
          normalizeTextKey(a.raw) === normalizeTextKey(item.suggestedName) ||
          normalizeTextKey(a.canonical) ===
            normalizeTextKey(item.suggestedName),
      );
      return hit ? { ...item, suggestedName: hit.canonical } : item;
    });
  }

  const ghesWithFunctions = ghes.filter((g) => g.cargos.length > 0).length;
  const coverageOk =
    ghes.length > 0 &&
    ghesWithFunctions >= Math.max(1, Math.ceil(ghes.length * 0.85)) &&
    finalEpis.length > 0;

  warnings.unshift(
    `Perfil Cony (matriz EPI/GHE): ${ghesWithFunctions}/${ghes.length} GHE(s) com cargo; ${finalFunctions.length} funcao(oes); ${finalEpis.length} EPI(s) vinculados.`,
  );
  if (!coverageOk) {
    warnings.push(
      'Cobertura Cony incompleta — revise funcoes e EPIs antes de confirmar.',
    );
  }

  return {
    company,
    sectors: finalSectors,
    functions: finalFunctions,
    risks,
    epiNeeds: finalEpis,
    warnings,
    ignoredCandidates: [],
    textExtractable: true,
    textLength: compact.length,
    layout: 'CARGO_TABLE',
    parseMethod: 'HEURISTIC',
    structureWeak: !coverageOk,
    coverage: {
      gheHeaderCount: ghes.length,
      ghesWithFunctions,
      functionsWithSector: finalFunctions.filter((f) => f.sectorName).length,
      functionCount: finalFunctions.length,
      sectorCount: finalSectors.length,
      riskRowCount: risks.length,
      epiItemCount: finalEpis.length,
      coverageOk,
    },
  };
}

type ConyGhe = {
  code: string;
  sectorName: string;
  cargos: string[];
  rawHeader: string;
};

type ConyEpiRow = {
  name: string;
  raw: string;
  marks: boolean[];
};

function emptyCompany() {
  return {
    legalName: null as string | null,
    tradeName: null as string | null,
    cnpj: null as string | null,
    addressLine: null as string | null,
    city: null as string | null,
    state: null as string | null,
    cnae: null as string | null,
    riskGrade: null as string | null,
    employeeCount: null as number | null,
    rawText: null as string | null,
    contactEmail: null as string | null,
    contactPhone: null as string | null,
  };
}

const BR_UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

function isLikelyTocLine(text: string, index: number): boolean {
  const newline = text.indexOf('\n', index);
  const line = text.slice(index, newline === -1 ? index + 180 : newline);
  return /\.{6,}|…{2,}|\.{3,}\s*\d+\s*$/.test(line);
}

function findNonTocCompanyHead(text: string): number {
  const re = /II\.?\s*IDENTIFICA[CÇ][AÃ]O\s+DA\s+EMPRESA|IDENTIFICA[CÇ][AÃ]O\s+DA\s+EMPRESA(?!\s+ELABORADORA)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) != null) {
    if (isLikelyTocLine(text, match.index)) continue;
    return match.index;
  }
  // Fallback: bloco com Razao Social + CNPJ (conteudo real, nao sumario).
  const razao = text.search(/Raz[aã]o\s+Social\s+[A-ZÁÉÍÓÚ]/i);
  return razao >= 0 ? Math.max(0, razao - 80) : -1;
}

function sliceConyCompanyBlock(text: string): string {
  const start = findNonTocCompanyHead(text);
  if (start < 0) return text.slice(0, 4500);
  const after = text.slice(start);
  const endRel = after.search(
    /\bSETOR\s+CARGO\b|\bIII\.?\s+[A-ZÁÉÍÓÚ]|\bGHE\s*0*1\s*[–\-—]/i,
  );
  return endRel > 80 ? after.slice(0, endRel) : after.slice(0, 3500);
}

function fieldAfterLabel(
  scope: string,
  labels: string[],
  stopLabels: string[],
): string | null {
  for (const label of labels) {
    const stop = stopLabels.map((s) => s.replace(/\s+/g, '\\s+')).join('|');
    const re = new RegExp(
      `${label.replace(/\s+/g, '\\s+')}\\s*[:\\-–]?\\s*([^\\n]{1,200}?)(?=\\s*(?:${stop})|$)`,
      'i',
    );
    const match = scope.match(re);
    if (match?.[1]) {
      const value = match[1].replace(/\s+/g, ' ').trim();
      if (value.length >= 2) return value;
    }
  }
  return null;
}

function extractConyCompany(text: string, warnings: string[]) {
  const company = emptyCompany();
  const scope = sliceConyCompanyBlock(text);

  const cnpjMatch = scope.match(
    /\b(\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-.\s]?\d{2})\b/,
  );
  if (cnpjMatch) {
    const validated = validateCnpj(cnpjMatch[1]);
    if (validated.ok) {
      company.cnpj = validated.normalized;
    } else {
      const digits = stripCnpj(cnpjMatch[1]);
      if (digits.length === 14) company.cnpj = digits;
    }
  }

  company.legalName = fieldAfterLabel(
    scope,
    ['Razao Social', 'Razão Social', 'Nome Empresarial'],
    ['Nome Fantasia', 'Nome de Fantasia', 'CNPJ', 'Endereco', 'Endereço'],
  );
  company.tradeName = fieldAfterLabel(
    scope,
    ['Nome Fantasia', 'Nome de Fantasia', 'Fantasia'],
    ['Endereco', 'Endereço', 'CNPJ', 'Bairro', 'CEP'],
  );

  let address = fieldAfterLabel(
    scope,
    ['Endereco', 'Endereço', 'Logradouro'],
    ['CEP', 'Bairro', 'Cidade', 'Municipio', 'Município', 'CNPJ'],
  );
  if (address) {
    address = address.replace(/\s*CEP\b.*$/i, '').replace(/\s+/g, ' ').trim();
    company.addressLine = address || null;
  }

  const cityStateInline = scope.match(
    /Cidade\s+([A-Za-zÀ-ÿ' .\-]+?)\s+Estado\s+([A-Za-z]{2})\b/i,
  );
  if (cityStateInline) {
    company.city = cityStateInline[1].replace(/\s+/g, ' ').trim();
    company.state = cityStateInline[2].toUpperCase();
  } else {
    company.city = fieldAfterLabel(
      scope,
      ['Cidade', 'Municipio', 'Município'],
      ['Estado', 'UF', 'CEP', 'CNPJ', 'CNAE'],
    );
    const uf = scope.match(/\b(?:Estado|UF)\s*[:\-]?\s*([A-Za-z]{2})\b/i);
    if (uf) company.state = uf[1].toUpperCase();
  }
  if (company.state && !BR_UFS.has(company.state)) {
    warnings.push(
      `UF extraida "${company.state}" e invalida e foi descartada.`,
    );
    company.state = null;
  }

  const cnaeMatch = scope.match(
    /CNAE\s*(?:Principal)?\s*[:\-]?\s*(\d{2}\.?\d{2}-?\d(?:-\d{2})?)/i,
  );
  if (cnaeMatch) company.cnae = cnaeMatch[1].replace(/\s+/g, '');

  const riskMatch = scope.match(
    /Grau\s+de\s+[Rr]isco\s*[:\-]?\s*0*([1-4])\b/,
  );
  if (riskMatch) company.riskGrade = riskMatch[1];

  const emp =
    scope.match(/N[°º]?\s*Funcion[aá]rios?\s*[:\-]?\s*(\d{1,5})/i) ??
    text.match(/N[°º]?\s*Funcion[aá]rios?\s*[:\-]?\s*(\d{1,5})/i);
  if (emp) company.employeeCount = Number(emp[1]);

  const emailMatch = scope.match(
    /E-?mails?\s*[:\-]?\s*([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})/i,
  );
  if (emailMatch) company.contactEmail = emailMatch[1].trim().toLowerCase();

  const phoneMatch = scope.match(
    /Telefone[s]?\s*[:\-]?\s*(\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4})/i,
  );
  if (phoneMatch) {
    company.contactPhone = phoneMatch[1].replace(/[^\d]/g, '');
  }

  // Fallback: razao com sufixo societario (nunca usar ME solto — casa em GERENCIAMENTO).
  if (!company.legalName) {
    const ltda = scope.match(
      /([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s\.\&\-]{2,80}(?:LTDA\.?|S\.\/?A\.?|EIRELI|EPP))\b/,
    );
    if (ltda) {
      company.legalName = ltda[1].replace(/\s+/g, ' ').trim();
    }
  }
  if (company.legalName && !company.tradeName) {
    const trade = company.legalName.replace(/\s+LTDA\.?$/i, '').trim();
    if (trade && trade !== company.legalName) company.tradeName = trade;
  }
  company.rawText = company.legalName;

  if (!company.cnpj) warnings.push('CNPJ da empresa nao encontrado com confianca.');
  if (!company.legalName) {
    warnings.push('Razao social nao encontrada com confianca.');
  }
  return company;
}

function padGheCode(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw.padStart(2, '0');
  return String(n).padStart(2, '0');
}

function gheCodeFromLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const m = label.match(/GHE\s*0*(\d+)/i);
  return m ? padGheCode(m[1]) : null;
}

function extractConyGhes(text: string): ConyGhe[] {
  const fromInventory = extractGhesFromInventory(text);
  if (fromInventory.length > 0) return fromInventory;
  return extractGhesFromSummaryTable(text);
}

/** Bloco XI – INVENTÁRIO: GHE – 01 / SETOR / CARGO: */
function extractGhesFromInventory(text: string): ConyGhe[] {
  const start =
    text.search(/XI\s*[–\-—]?\s*INVENT[AÁ]RIO\s+DE\s+RISCOS/i) >= 0
      ? text.search(/XI\s*[–\-—]?\s*INVENT[AÁ]RIO\s+DE\s+RISCOS/i)
      : text.search(/\bGHE\s*[–\-—]?\s*0*1\b/i);
  const endMatch = text.slice(start).search(
    /\b(?:3\s*[–\-—]?\s*EQUIPAMENTO\s+DE\s+PROTE[CÇ][AÃ]O|DESCRI[CÇ][AÃ]O\s*[–\-—]?\s*EPI|XXIII\s*[–\-—]?\s*PLANO\s+DE\s+A[CÇ][AÃ]O)/i,
  );
  const slice =
    start >= 0
      ? endMatch >= 0
        ? text.slice(start, start + endMatch)
        : text.slice(start)
      : text;

  const parts = slice.split(/\bGHE\s*[–\-—]?\s*0*(\d+)\b/i);
  // split: [pre, code1, body1, code2, body2, ...]
  const ghes: ConyGhe[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const code = padGheCode(parts[i]);
    const body = parts[i + 1] ?? '';
    const sectorMatch = body.match(/SETOR\s*:\s*([^\n]+)/i);
    const sectorName = (sectorMatch?.[1] ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\.$/, '');
    const cargos: string[] = [];
    const cargoRe = /CARGO\s*:\s*([^\n]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = cargoRe.exec(body))) {
      const name = cleanCargoName(m[1]);
      if (name && !cargos.some((c) => normalizeTextKey(c) === normalizeTextKey(name))) {
        cargos.push(name);
      }
    }
    if (!sectorName && cargos.length === 0) continue;
    ghes.push({
      code,
      sectorName: sectorName || `GHE ${code}`,
      cargos,
      rawHeader: `GHE ${code} – ${sectorName || 'SEM SETOR'}`,
    });
  }
  return ghes;
}

/** Tabela inicial SETOR CARGO / GHE 01 – ADMINISTRATIVO / lista de cargos */
function extractGhesFromSummaryTable(text: string): ConyGhe[] {
  const anchor = text.search(/SETOR\s+CARGO/i);
  if (anchor < 0) return [];
  const slice = text.slice(anchor, anchor + 4000);
  const parts = slice.split(/\bGHE\s*0*(\d+)\s*[–\-—-]?\s*/i);
  const ghes: ConyGhe[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const code = padGheCode(parts[i]);
    const body = parts[i + 1] ?? '';
    const lines = body
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;
    const sectorName = lines[0]
      .replace(/^[–\-—]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    const cargos: string[] = [];
    for (const line of lines.slice(1)) {
      if (/^GHE\b/i.test(line)) break;
      if (/^N[°º]?\s*Funcion/i.test(line)) break;
      if (/^PROGRAMA\b/i.test(line)) break;
      if (line.length < 3 || line.length > 80) continue;
      if (/^\d+$/.test(line)) continue;
      const name = cleanCargoName(line);
      if (name) cargos.push(name);
    }
    ghes.push({
      code,
      sectorName: sectorName || `GHE ${code}`,
      cargos,
      rawHeader: `GHE ${code} – ${sectorName}`,
    });
  }
  return ghes;
}

function cleanCargoName(raw: string): string | null {
  let name = raw
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '')
    .trim();
  if (!name) return null;
  if (/^(SETOR|CARGO|RISCO|AGENTE|DESCRI)/i.test(name)) return null;
  if (name.length < 3) return null;
  return name;
}

/** Remove numeros de CA e marcas X/- do nome do EPI. */
function cleanConyEpiName(raw: string): string {
  return raw
    .replace(/\b\d{1,2}[.\s]\d{3}(?:[.\s/-]?\d{0,2})?\b/g, ' ')
    .replace(/\b\d{4,5}\b/g, ' ')
    .replace(/\s*[-–—]\s*[Xx-]?\s*$/g, '')
    .replace(/\s*[-–—]\s*[Xx]\b.*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractConyEpiMatrix(
  text: string,
  knownGheCodes: string[],
): { gheCodes: string[]; rows: ConyEpiRow[] } {
  const start = text.search(
    /DESCRI[CÇ][AÃ]O\s*[–\-—]?\s*EPI|Distribui[cç][aã]o\s+por\s+GHE/i,
  );
  if (start < 0) return { gheCodes: [], rows: [] };
  const endRel = text.slice(start).search(
    /\bXXIII\s*[–\-—]?\s*PLANO\s+DE\s+A[CÇ][AÃ]O|\bPLANO\s+DE\s+A[CÇ][AÃ]O\b/i,
  );
  const slice =
    endRel >= 0 ? text.slice(start, start + endRel) : text.slice(start);

  // Cabeçalhos GHE na ordem das colunas
  const headerCodes: string[] = [];
  const headerRe = /\bGHE\s*0*(\d+)\b/gi;
  let hm: RegExpExecArray | null;
  const headerZone = slice.slice(0, 500);
  while ((hm = headerRe.exec(headerZone))) {
    const code = padGheCode(hm[1]);
    if (!headerCodes.includes(code)) headerCodes.push(code);
  }
  const gheCodes =
    headerCodes.length > 0
      ? headerCodes
      : knownGheCodes.length > 0
        ? [...knownGheCodes]
        : ['01', '02'];

  const epiStartRe =
    /^(Avental|Bota|Botina|Cal[cç]a|Camisa|Capa|Capacete|Cinta|Cinto|Luva|M[aá]scara|Oculos|Óculos|Protetor|Talabarte|Touca|Perneira|Mangote|Macac[aã]o|Respirador|Viseira|Creme)\b/i;

  const lines = slice.split(/\n/).map((l) => l.trim());
  const rows: ConyEpiRow[] = [];
  let current: { name: string; buf: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const raw = [current.name, ...current.buf].join('\n');
    const marks = parseMarksFromChunk(raw, gheCodes.length);
    rows.push({ name: current.name, raw, marks });
    current = null;
  };

  for (const line of lines) {
    if (!line) continue;
    if (/^DESCRI/i.test(line)) continue;
    if (/^GHE\s*0*\d+/i.test(line) && line.length < 20) continue;
    if (/^PROGRAMA\b/i.test(line)) continue;
    if (/^\d{1,2}$/.test(line)) continue; // resto de "GHE 1" / "4"

    if (epiStartRe.test(line)) {
      flush();
      const name = cleanConyEpiName(line);
      current = { name: name || line, buf: [line] };
      continue;
    }
    if (current) current.buf.push(line);
  }
  flush();

  return { gheCodes, rows };
}

function parseMarksFromChunk(chunk: string, columnCount: number): boolean[] {
  const marks = Array.from({ length: columnCount }, () => false);
  // Junta tokens finais do tipo - X / X - / - - / X X
  const flat = chunk.replace(/\s+/g, ' ').trim();
  const tokenMatches = [
    ...flat.matchAll(/(?:^|[\s])([-X])(?=[\s]|$)/gi),
  ].map((m) => m[1].toUpperCase());
  // Preferir os últimos `columnCount` tokens -|X
  const tail = tokenMatches.slice(-columnCount);
  if (tail.length === columnCount) {
    for (let i = 0; i < columnCount; i += 1) {
      marks[i] = tail[i] === 'X';
    }
    return marks;
  }
  // Fallback: se há pelo menos um X e uma coluna, marcar a última coluna (comum no PDF Cony: "- X")
  if (/\bX\b/i.test(flat) && columnCount >= 1) {
    const onlyLast = /[-–—]\s*X\s*$/i.test(flat) || /[-–—]\s+X\b/i.test(flat);
    if (onlyLast) {
      marks[columnCount - 1] = true;
      return marks;
    }
    // X sozinho em alguma posicao — marca todas as colunas com X no padrao solto
    if (columnCount === 2 && /\bX\b/i.test(flat) && !/^X\b/i.test(flat.trim())) {
      marks[1] = true;
    }
  }
  return marks;
}

function extractConyRisks(
  text: string,
  functionsByGhe: Map<string, string[]>,
): PgroExtractedRisk[] {
  const risks: PgroExtractedRisk[] = [];
  const start = text.search(/XI\s*[–\-—]?\s*INVENT[AÁ]RIO\s+DE\s+RISCOS/i);
  const slice = start >= 0 ? text.slice(start) : text;
  const parts = slice.split(/\bGHE\s*[–\-—]?\s*0*(\d+)\b/i);
  for (let i = 1; i < parts.length; i += 2) {
    const code = padGheCode(parts[i]);
    const body = parts[i + 1] ?? '';
    const riskZone = body.split(/RISCO\s+DO\s+GHE/i)[1] ?? '';
    if (!riskZone) continue;
    const agentRe = /Agente\s+([^\n]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = agentRe.exec(riskZone))) {
      const agent = m[1].replace(/\s+/g, ' ').trim();
      if (!agent || /sem riscos espec[ií]ficos/i.test(agent)) continue;
      const groupMatch = riskZone
        .slice(m.index, m.index + 200)
        .match(/Grupo\s+([^\n]+)/i);
      const category = mapRiskGroup(groupMatch?.[1] ?? '');
      const fns = functionsByGhe.get(code) ?? [];
      risks.push({
        tempId: randomUUID(),
        name: agent.slice(0, 180),
        category,
        exposure: null,
        source: null,
        possibleDamage: null,
        riskLevel: null,
        functionNames: [...fns],
        rawText: agent,
        included: fns.length > 0,
        confidence: 'low',
        extractionSource: 'GHE',
        gheName: `GHE ${code}`,
      });
    }
  }
  return risks;
}

function mapRiskGroup(raw: string): OccupationalRiskCategory {
  const key = normalizeTextKey(raw);
  if (key.includes('fisic')) return 'FISICO';
  if (key.includes('quim')) return 'QUIMICO';
  if (key.includes('biolog')) return 'BIOLOGICO';
  if (key.includes('ergon')) return 'ERGONOMICO';
  if (key.includes('acid') || key.includes('mecanic')) return 'MECANICO';
  return 'ACIDENTE';
}
