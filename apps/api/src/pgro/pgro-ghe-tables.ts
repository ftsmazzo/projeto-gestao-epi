import { randomUUID } from 'crypto';
import { OccupationalRiskCategory } from '@prisma/client';
import {
  canonicalizeEpiNeedLabel,
  canonicalEpiNeedKey,
  epiNeedsAreSame,
  isJunkEpiNeedName,
  splitGluedEpiPhrases,
} from '../epi-needs/epi-need-canonical';
import type {
  PgroExtractedEpiNeed,
  PgroExtractedFunction,
  PgroExtractedRisk,
  PgroExtractedSector,
} from './pgro-extract-types';

export type {
  PgroExtractedEpiNeed,
  PgroExtractedFunction,
  PgroExtractedRisk,
  PgroExtractedSector,
} from './pgro-extract-types';

function normalizeTextKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export type GheTablePair = {
  sectorName: string;
  functionName: string;
  activity: string | null;
  environment: string | null;
};

export type GheAprhoRiskRow = {
  category: OccupationalRiskCategory;
  agent: string;
  exposure: string | null;
  source: string | null;
  possibleDamage: string | null;
  riskLevel: string | null;
  epiTexts: string[];
};

export type ParsedGheTableBlock = {
  gheNumber: string;
  gheName: string;
  headerLabel: string;
  pairs: GheTablePair[];
  risks: GheAprhoRiskRow[];
};

export type GheTableParseStats = {
  gheHeaderCount: number;
  ghesWithFunctions: number;
  functionsWithSector: number;
  functionCount: number;
  sectorCount: number;
  riskRowCount: number;
  epiItemCount: number;
  coverageOk: boolean;
};

const ENV_SECTOR_RE =
  /^(?:(?:e\s+)?ventilado|climatizado|interno|externo|trabalham\s+em\s+ambiente|ambiente\s+interno|ambiente\s+externo|com\s+ventilacao|sem\s+ventilacao)\b/i;

const CATEGORY_MAP: Array<{ re: RegExp; cat: OccupationalRiskCategory }> = [
  // Docs tipográficos: "Fisco" em vez de "Físico"
  { re: /^f[ií]?s[ie]?co|^f[ií]sico/i, cat: OccupationalRiskCategory.FISICO },
  { re: /^qu[ií]mico/i, cat: OccupationalRiskCategory.QUIMICO },
  { re: /^biol[oó]gico/i, cat: OccupationalRiskCategory.BIOLOGICO },
  { re: /^ergon[oô]mico/i, cat: OccupationalRiskCategory.ERGONOMICO },
  { re: /^(?:meca?nico|acidente)/i, cat: OccupationalRiskCategory.MECANICO },
  { re: /^psicossocial/i, cat: OccupationalRiskCategory.PSICOSSOCIAL },
];

const ADMIN_EPI_RE =
  /^(gin[aá]stica\s+laboral|orienta[cç][aã]o\s+t[eé]cnica|treinamento|procedimento|sinaliza[cç][aã]o|manter\s+as\s+condi|avalia[cç][aã]o\s+abaixo|plano\s+de\s+a[cç][aã]o)/i;

const QUANT_HEADER_RE =
  /intensidade|concentra[cç][aã]o\s+avaliada|\blavg\b|\bdose\b|t[eé]cnica\s+utilizada|limite\s+de\s+exposi/i;

function cleanCell(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function clampText(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const cleaned = cleanCell(value);
  if (!cleaned) return null;
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function isCharacterizationHeader(line: string): RegExpMatchArray | null {
  return line.match(
    /^Caracteriza[cç][aã]o\s+do\s+GHE\s*(\d+)\s*[–\-—:]?\s*(.*)$/i,
  );
}

function isAprhoHeader(line: string): RegExpMatchArray | null {
  return line.match(/^APRHO\s+do\s+GHE\s*(\d+)\s*[–\-—:]?\s*(.*)$/i);
}

function isCharTableHeader(cells: string[]): boolean {
  // Só nas células de cabeçalho (não no texto da atividade, que cita "setor"/"função").
  if (cells.length < 2) return false;
  const c0 = normalizeTextKey(cells[0]);
  const c1 = normalizeTextKey(cells[1]);
  return (
    (c0 === 'setor' || c0.startsWith('setor ')) &&
    (c1.includes('cargo') || c1.includes('funcao')) &&
    c0.length <= 24 &&
    c1.length <= 40
  );
}

function isAprhoTableHeader(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const c0 = normalizeTextKey(cells[0]);
  const c1 = normalizeTextKey(cells[1]);
  if (c0.includes('perigo') && c0.length <= 24) return true;
  if (c0 === 'categoria' || c0.startsWith('categoria ')) return true;
  if (
    (c0 === 'agente' || c0.startsWith('agente ')) &&
    (c1.includes('fator') || c1.includes('exposicao') || c1.includes('risco'))
  ) {
    return true;
  }
  return false;
}

function isEnvironmentSector(name: string): boolean {
  const cleaned = cleanCell(name);
  if (!cleaned) return true;
  if (ENV_SECTOR_RE.test(cleaned)) return true;
  if (/^e\s+ventilado$/i.test(cleaned)) return true;
  if (/interno\s+e\s+externo/i.test(cleaned)) return true;
  return false;
}

function isValidSectorCell(name: string): boolean {
  const cleaned = cleanCell(name);
  if (cleaned.length < 2 || cleaned.length > 80) return false;
  if (isEnvironmentSector(cleaned)) return false;
  if (/^(setor|cargo|funcao|descricao|cbo|ghe)$/i.test(cleaned)) return false;
  return true;
}

function isValidFunctionCell(name: string): boolean {
  const cleaned = cleanCell(name);
  if (cleaned.length < 2 || cleaned.length > 120) return false;
  if (isEnvironmentSector(cleaned)) return false;
  if (/^(setor|cargo|funcao|descricao|cbo|ghe|agente|categoria)$/i.test(cleaned)) {
    return false;
  }
  if (/trabalham\s+em\s+ambiente/i.test(cleaned)) return false;
  return true;
}

function mapCategory(raw: string): OccupationalRiskCategory | null {
  const cleaned = cleanCell(raw);
  for (const item of CATEGORY_MAP) {
    if (item.re.test(cleaned)) return item.cat;
  }
  return null;
}

function splitEpiTexts(raw: string): string[] {
  const parts = splitGluedEpiPhrases(cleanCell(raw))
    .filter((part) => part.length >= 3)
    .filter((part) => !ADMIN_EPI_RE.test(part))
    .filter((part) => !isJunkEpiNeedName(part))
    .filter((part) => !/^(epi|epc|medidas\s+administrativas)$/i.test(part));
  return [...new Set(parts)];
}

function lineToCells(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map(cleanCell);
  }
  return [cleanCell(line)];
}

/**
 * Parseia documento linear table-aware (linhas com tabs = rows de tabela).
 */
export function parseGheTableBlocks(text: string): ParsedGheTableBlock[] {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\u00a0/g, ' ').trimEnd())
    .filter((l) => l.trim().length > 0);

  const blocks = new Map<string, ParsedGheTableBlock>();

  let i = 0;
  while (i < lines.length) {
    const charMatch = isCharacterizationHeader(cleanCell(lines[i]));
    if (!charMatch) {
      i += 1;
      continue;
    }

    const gheNumber = String(Number(charMatch[1])).padStart(2, '0');
    const headerLabel = cleanCell(charMatch[2] || `GHE ${gheNumber}`);
    const gheName = `GHE ${gheNumber} – ${headerLabel}`;
    const pairs: GheTablePair[] = [];
    i += 1;

    // Characterization rows until APRHO of same (or any) GHE / next characterization
    while (i < lines.length) {
      const line = cleanCell(lines[i]);
      if (isCharacterizationHeader(line) || isAprhoHeader(line)) break;
      const cells = lineToCells(lines[i]);
      if (isCharTableHeader(cells)) {
        i += 1;
        continue;
      }
      if (cells.length >= 2) {
        const sector = cells[0];
        const fn = cells[1];
        const activity = cells[2] ? cleanCell(cells[2]) : null;
        const environment = cells[3] ? cleanCell(cells[3]) : null;
        if (isValidSectorCell(sector) && isValidFunctionCell(fn)) {
          pairs.push({
            sectorName: sector.toUpperCase(),
            functionName: fn,
            activity: activity && activity.length > 8 ? activity : null,
            environment:
              environment && environment.length > 3 ? environment : null,
          });
        }
      }
      i += 1;
    }

    const risks: GheAprhoRiskRow[] = [];

    // Optional APRHO qualitative for this GHE (skip if quantitative)
    if (i < lines.length) {
      const aprhoMatch = isAprhoHeader(cleanCell(lines[i]));
      if (aprhoMatch && String(Number(aprhoMatch[1])).padStart(2, '0') === gheNumber) {
        i += 1;
        let quantitative = false;
        while (i < lines.length) {
          const line = cleanCell(lines[i]);
          if (isCharacterizationHeader(line)) break;
          const nextAprho = isAprhoHeader(line);
          if (nextAprho) {
            // Second APRHO for same GHE = usually quantitative; stop qualitative.
            if (String(Number(nextAprho[1])).padStart(2, '0') === gheNumber) {
              break;
            }
            break;
          }
          const cells = lineToCells(lines[i]);
          if (isAprhoTableHeader(cells) || QUANT_HEADER_RE.test(cells.join(' '))) {
            if (QUANT_HEADER_RE.test(cells.join(' '))) {
              quantitative = true;
              i += 1;
              continue;
            }
            i += 1;
            continue;
          }
          if (quantitative) {
            i += 1;
            continue;
          }
          if (cells.length >= 2) {
            const category = mapCategory(cells[0]);
            const agent = cleanCell(cells[1]);
            if (category && agent.length >= 2 && !/^agente$/i.test(agent)) {
              const epiCell =
                cells.length >= 10
                  ? cells[cells.length - 1]
                  : cells.length >= 7
                    ? cells[cells.length - 1]
                    : cells[cells.length - 1];
              risks.push({
                category,
                agent,
                exposure: cells[2] ? cleanCell(cells[2]) : null,
                source: cells[3] ? cleanCell(cells[3]) : null,
                possibleDamage: cells[5] ? cleanCell(cells[5]) : cells[4] ? cleanCell(cells[4]) : null,
                riskLevel: cells.find((c) => /^(muito\s+)?(baixo|moderado|alto)$/i.test(c)) ?? null,
                epiTexts: splitEpiTexts(epiCell),
              });
            }
          }
          i += 1;
        }
      }
    }

    const existing = blocks.get(gheNumber);
    if (!existing) {
      blocks.set(gheNumber, {
        gheNumber,
        gheName,
        headerLabel,
        pairs,
        risks,
      });
    } else {
      existing.pairs.push(...pairs);
      existing.risks.push(...risks);
    }
  }

  return [...blocks.values()].sort((a, b) =>
    a.gheNumber.localeCompare(b.gheNumber, 'pt-BR'),
  );
}

export function gheTableBlocksToExtracted(blocks: ParsedGheTableBlock[]): {
  sectors: PgroExtractedSector[];
  functions: PgroExtractedFunction[];
  risks: PgroExtractedRisk[];
  epiNeeds: PgroExtractedEpiNeed[];
  stats: GheTableParseStats;
} {
  const sectorMap = new Map<string, PgroExtractedSector>();
  const functionMap = new Map<string, PgroExtractedFunction>();
  const riskMap = new Map<string, PgroExtractedRisk>();
  const epiMap = new Map<string, PgroExtractedEpiNeed>();

  let ghesWithFunctions = 0;
  let riskRowCount = 0;
  let epiItemCount = 0;

  for (const block of blocks) {
    const fnNames = block.pairs.map((p) => p.functionName);
    if (block.pairs.length > 0) ghesWithFunctions += 1;

    for (const pair of block.pairs) {
      const sectorKey = normalizeTextKey(pair.sectorName);
      if (!sectorMap.has(sectorKey)) {
        sectorMap.set(sectorKey, {
          tempId: randomUUID(),
          name: pair.sectorName.toUpperCase(),
          rawText: pair.sectorName,
          included: true,
          confidence: 'high',
          source: 'GHE',
          gheName: block.gheName,
        });
      }

      const fnKey = `${sectorKey}::${normalizeTextKey(pair.functionName)}`;
      if (!functionMap.has(fnKey)) {
        functionMap.set(fnKey, {
          tempId: randomUUID(),
          name: pair.functionName,
          sectorName: pair.sectorName.toUpperCase(),
          activityDescription: clampText(pair.activity, 2000),
          environmentDescription: clampText(pair.environment, 2000),
          gheName: block.gheName,
          rawText: pair.functionName,
          included: true,
          confidence: 'high',
          source: 'GHE',
        });
      }
    }

    for (const row of block.risks) {
      riskRowCount += 1;
      const riskKey = normalizeTextKey(row.agent);
      const existing = riskMap.get(riskKey);
      if (!existing) {
        riskMap.set(riskKey, {
          tempId: randomUUID(),
          name: row.agent,
          category: row.category,
          exposure: row.exposure,
          source: row.source,
          possibleDamage: row.possibleDamage,
          riskLevel: row.riskLevel,
          functionNames: [...fnNames],
          rawText: row.agent,
          included: true,
          confidence: 'high',
          extractionSource: 'GHE',
          gheName: block.gheName,
        });
      } else {
        existing.functionNames = [
          ...new Set([...existing.functionNames, ...fnNames]),
        ];
        if (!existing.exposure && row.exposure) existing.exposure = row.exposure;
        if (!existing.source && row.source) existing.source = row.source;
        if (!existing.possibleDamage && row.possibleDamage) {
          existing.possibleDamage = row.possibleDamage;
        }
      }

      for (const epi of row.epiTexts) {
        const label = canonicalizeEpiNeedLabel(epi);
        if (!label) continue;
        epiItemCount += 1;
        const epiKey = canonicalEpiNeedKey(label);
        let prev = epiMap.get(epiKey);
        if (!prev) {
          for (const item of epiMap.values()) {
            if (epiNeedsAreSame(item.suggestedName, label)) {
              prev = item;
              break;
            }
          }
        }
        if (!prev) {
          epiMap.set(epiKey, {
            tempId: randomUUID(),
            extractedText: epi,
            suggestedName: label,
            matchedEpiNeedId: null,
            matchedEpiNeedName: null,
            createNew: true,
            functionNames: [...fnNames],
            riskNames: [row.agent],
            included: fnNames.length > 0,
            confidence: 'high',
            extractionSource: 'GHE',
            gheName: block.gheName,
          });
        } else {
          prev.functionNames = [
            ...new Set([...prev.functionNames, ...fnNames]),
          ];
          prev.riskNames = [...new Set([...prev.riskNames, row.agent])];
          if (prev.functionNames.length > 0) prev.included = true;
        }
      }
    }
  }

  const functions = [...functionMap.values()];
  const functionsWithSector = functions.filter((f) =>
    Boolean(f.sectorName?.trim()),
  ).length;
  const gheHeaderCount = blocks.length;
  const coverageOk =
    gheHeaderCount > 0 &&
    ghesWithFunctions >= gheHeaderCount &&
    functions.length > 0 &&
    functionsWithSector / functions.length >= 0.95;

  // Riscos/EPIs sem função do GHE não devem ir para o preview como "included".
  const risks = [...riskMap.values()].map((r) => ({
    ...r,
    included: r.included && r.functionNames.length > 0,
  }));
  const epiNeeds = [...epiMap.values()].map((e) => ({
    ...e,
    included: e.included && e.functionNames.length > 0,
  }));

  return {
    sectors: [...sectorMap.values()],
    functions,
    risks,
    epiNeeds,
    stats: {
      gheHeaderCount,
      ghesWithFunctions,
      functionsWithSector,
      functionCount: functions.length,
      sectorCount: sectorMap.size,
      riskRowCount,
      epiItemCount,
      coverageOk,
    },
  };
}

export function countCharacterizationHeaders(text: string): number {
  const nums = new Set<string>();
  for (const m of text.matchAll(
    /Caracteriza[cç][aã]o\s+do\s+GHE\s*(\d+)/gi,
  )) {
    nums.add(String(Number(m[1])).padStart(2, '0'));
  }
  return nums.size;
}
