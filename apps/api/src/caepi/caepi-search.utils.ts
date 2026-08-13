import { Prisma } from '@prisma/client';

const SEARCH_STOP_WORDS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'em',
  'com',
  'para',
  'tipo',
]);

function foldSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/** Palavras que a CAEPI realmente usa (ignora de/da/do). */
export function significantSearchWords(term: string): string[] {
  return foldSearchText(term)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !SEARCH_STOP_WORDS.has(word));
}

/** Sinonimos comuns EPI ↔ nome oficial CAEPI (ex.: Viseira → Protetor facial). */
export function expandEquipmentSearchTerms(term: string): string[] {
  const folded = foldSearchText(term);
  const extras: string[] = [];
  if (folded.includes('viseira')) extras.push('protetor facial');
  if (folded.includes('protetor facial')) extras.push('viseira');
  if (folded.includes('oculos')) extras.push('protetor ocular');
  if (folded.includes('botina') || folded.includes('calcado')) {
    extras.push('botina', 'calcado');
  }
  if (folded.includes('plug')) extras.push('insercao');
  if (folded.includes('concha') || folded.includes('abafador')) {
    extras.push('concha', 'abafador');
  }
  if (folded.includes('pff2')) extras.push('pff2');
  else if (folded.includes('pff1')) extras.push('pff1');
  else if (folded.includes('pff')) extras.push('pff2', 'pff1');
  return [...new Set([term, ...extras].map((t) => t.trim()).filter(Boolean))];
}

/**
 * "luva raspa" casa com "LUVA DE RASPA"; "plug" casa com "INSERCAO" via sinonimo.
 * Nao exige a frase colada — a CAEPI quase sempre mete "DE" no meio.
 */
export function caepiTextMatchesQuery(
  haystack: string | null | undefined,
  query: string,
): boolean {
  const foldedHay = foldSearchText(haystack ?? '');
  if (!foldedHay) return false;
  return expandEquipmentSearchTerms(query).some((term) => {
    const words = significantSearchWords(term);
    if (words.length === 0) {
      return foldedHay.includes(foldSearchText(term));
    }
    return words.every((word) => foldedHay.includes(word));
  });
}

function containsInsensitive(field: string, value: string) {
  return { [field]: { contains: value, mode: 'insensitive' as const } };
}

export function termToWhere(term: string): Prisma.CaCertificateWhereInput {
  const words = significantSearchWords(term);
  const needles = words.length > 0 ? words : [term.trim()].filter(Boolean);
  if (needles.length === 1) {
    const word = needles[0];
    return {
      OR: [
        containsInsensitive('equipmentName', word),
        containsInsensitive('equipmentDescription', word),
        containsInsensitive('manufacturerName', word),
        containsInsensitive('reference', word),
      ],
    };
  }
  return {
    AND: needles.map((word) => ({
      OR: [
        containsInsensitive('equipmentName', word),
        containsInsensitive('equipmentDescription', word),
      ],
    })),
  };
}

export function buildCaepiTextMatchWhere(
  query: string,
  caDigits: string,
): Prisma.CaCertificateWhereInput {
  const equipmentTerms = expandEquipmentSearchTerms(query);
  return {
    OR: [
      ...equipmentTerms.map(termToWhere),
      ...(caDigits.length >= 3
        ? [{ caNumber: { contains: caDigits, mode: 'insensitive' as const } }]
        : []),
    ],
  };
}
