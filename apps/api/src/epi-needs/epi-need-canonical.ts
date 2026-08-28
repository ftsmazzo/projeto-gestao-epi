import { assessNeedEquipmentCompatibility } from '@gestao-epi/shared';
import {
  DEFAULT_EPI_NEED_SEEDS,
  suggestNeedNamesFromText,
  type DefaultEpiNeedSeed,
} from './epi-need-suggest';

const STOPWORDS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'com',
  'para',
  'tipo',
  'modelo',
  'e',
  'em',
  'a',
  'o',
  'um',
  'uma',
  'ao',
  'na',
  'no',
]);

const APPLICATION_FILLER = new Set([
  'descartavel',
  'valvula',
  'valvulado',
  'poeira',
  'poeiras',
  'fumos',
  'metalicos',
  'metalico',
  'vapores',
  'organicos',
  'organico',
  'vo',
  'v',
  'cartucho',
  'cartuchos',
  'y',
  'abs',
  'duplo',
  'simples',
  'subir',
  'carroceria',
  'rotina',
  'protecao',
  '3x1',
]);

const DISTINGUISHER_TOKENS = new Set([
  'pigmentada',
  'malha',
  'raspa',
  'pvc',
  'vaqueta',
  'nitrilica',
  'anticorte',
  'brim',
  'tyvek',
  'plug',
  'concha',
  'pff1',
  'pff2',
  'pff3',
  'borracha',
  'isolante',
]);

const FAMILY_HEADS = new Set([
  'botina',
  'bota',
  'capacete',
  'oculos',
  'luva',
  'protetor',
  'respirador',
  'mascara',
  'avental',
  'viseira',
  'creme',
  'uniforme',
  'cinto',
  'talabarte',
  'mangote',
  'macacao',
  'touca',
  'perneira',
  'calcado',
  'cinturao',
]);

const FAMILY_SPLIT_RE =
  /(?=\b(?:Botinas?|Botas?|Capacete|Oculos|Óculos|Luvas?|Protetor|Respirador|Mascara|Máscara|Avental|Viseira|Creme|Uniforme|Cinto|Talabarte|Mangote|Macac[aã]o|Touca|Perneira|Cal[cç]ado)\b)/i;

const JUNK_EPI_NAME_RE =
  /^(?:realizar|efetuar|executar|manter|garantir|promover|adotar|defini[cç][aã]o)\b|exame\s+de\s+audiometria|manuten[cç][aã]o\s+de\s+rotina|tempo\s+de\s+espera|antes\s+de\s+tocar|gin[aá]stica\s+laboral|plano\s+de\s+a[cç][aã]o|medidas?\s+administrativas?|orienta[cç][aã]o\s+t[eé]cnica|treinamento\b|procedimento\b|sinaliza[cç][aã]o|avalia[cç][aã]o\s+(?:medica|periodica|ocupacional)|fornecimento\s+de\s+epi|controle\s+de\s+entrega|^\(?\s*(?:poeira|fumos|ru[ií]do|calor)\b/i;

function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function applySynonyms(token: string): string {
  if (token === 'botina') return 'bota';
  if (token === 'nitrilo' || token === 'nitrilico') return 'nitrilica';
  if (token === 'tyvec' || token === 'tyvek') return 'tyvek';
  if (token === 'plugue') return 'plug';
  if (token === 'semifacial') return 'semi';
  if (token === 'mangote') return 'manga';
  if (token === 'protecao') return 'protetor';
  return token;
}

export function canonicalEpiNeedKey(name: string): string {
  const withoutParens = name.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  const folded = foldText(withoutParens)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = folded
    .split(' ')
    .map(applySynonyms)
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
  const collapsed: string[] = [];
  for (const token of tokens) {
    if (
      token === 'facial' &&
      collapsed[collapsed.length - 1] === 'semi'
    ) {
      continue;
    }
    if (
      token === 'corte' &&
      collapsed[collapsed.length - 1] === 'anti'
    ) {
      collapsed[collapsed.length - 1] = 'anticorte';
      continue;
    }
    collapsed.push(token);
  }
  return collapsed.join(' ');
}

export function isJunkEpiNeedName(name: string): boolean {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (trimmed.length < 4) return true;
  if (/^[^\p{L}]+$/u.test(trimmed)) return true;
  if (trimmed.startsWith('(') && trimmed.length < 48) return true;
  if (JUNK_EPI_NAME_RE.test(trimmed)) return true;
  const key = canonicalEpiNeedKey(trimmed);
  if (!key) return true;
  const tokens = key.split(' ');
  if (tokens.length === 1 && tokens[0].length < 6) return true;
  const hasFamily = tokens.some((token) => FAMILY_HEADS.has(token));
  if (!hasFamily && tokens.length >= 6) return true;
  return false;
}

/** Necessidade que representa EPI entregavel (exclui junk administrativo do PGR). */
export function isDeliverableEpiNeed(name: string): boolean {
  return !isJunkEpiNeedName(name);
}

function tokenListsCompatible(a: string[], b: string[]): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  const last = a.length - 1;
  return a.every((token, index) => {
    const other = b[index];
    if (token === other) return true;
    if (index !== last) return false;
    const [shorter, longer] =
      token.length <= other.length ? [token, other] : [other, token];
    return shorter.length >= 3 && longer.startsWith(shorter);
  });
}

function isSameFamilySubset(left: string, right: string): boolean {
  const a = left.split(' ').filter(Boolean);
  const b = right.split(' ').filter(Boolean);
  if (!a.length || !b.length) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter[0] !== longer[0]) return false;
  if (shorter.length < 2 && shorter[0].length < 8) return false;
  if (!shorter.every((token) => longer.includes(token))) return false;
  const extra = longer.filter((token) => !shorter.includes(token));
  if (extra.some((token) => FAMILY_HEADS.has(token))) return false;
  if (extra.some((token) => DISTINGUISHER_TOKENS.has(token))) return false;
  return true;
}

function identityKey(name: string): string {
  return canonicalEpiNeedKey(name)
    .split(' ')
    .filter((token) => !APPLICATION_FILLER.has(token))
    .join(' ');
}

function identityKeysMatch(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  if (tokenListsCompatible(left.split(' '), right.split(' '))) return true;
  return isSameFamilySubset(left, right);
}

export function splitGluedEpiPhrases(raw: string): string[] {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const parts = cleaned
    .split(/\n|;|,(?=\s*[A-ZÀ-Ú])/)
    .flatMap((part) => part.split(FAMILY_SPLIT_RE))
    .map((part) => part.replace(/^[\s,.;:/-]+|[\s,.;:/-]+$/g, '').trim())
    .filter((part) => part.length >= 3);
  return [...new Set(parts)];
}

export function isGluedEpiNeedName(name: string): boolean {
  const parts = splitGluedEpiPhrases(name).filter(
    (part) => !isJunkEpiNeedName(part),
  );
  if (parts.length < 2) return false;
  const fullKey = identityKey(name);
  return parts.some((part) => identityKey(part) !== fullKey);
}

export function resolveEpiNeedSeedForIdentity(
  name: string,
): DefaultEpiNeedSeed | null {
  if (isJunkEpiNeedName(name)) return null;
  const key = identityKey(name);
  if (!key) return null;

  for (const seed of DEFAULT_EPI_NEED_SEEDS) {
    const seedKey = identityKey(seed.name);
    if (seedKey && identityKeysMatch(key, seedKey)) {
      return seed;
    }
    for (const alias of seed.aliases) {
      const aliasKey = identityKey(alias);
      if (aliasKey.split(' ').length < 2) continue;
      if (identityKeysMatch(key, aliasKey)) {
        return seed;
      }
    }
  }

  return null;
}

export function epiNeedsAreSame(left: string, right: string): boolean {
  if (isJunkEpiNeedName(left) || isJunkEpiNeedName(right)) return false;
  if (identityKeysMatch(identityKey(left), identityKey(right))) return true;
  const seedLeft = resolveEpiNeedSeedForIdentity(left);
  const seedRight = resolveEpiNeedSeedForIdentity(right);
  return Boolean(seedLeft && seedRight && seedLeft.name === seedRight.name);
}

export function canonicalizeEpiNeedLabel(name: string): string | null {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (!trimmed || isJunkEpiNeedName(trimmed)) return null;
  const seed = resolveEpiNeedSeedForIdentity(trimmed);
  if (seed) return seed.name;
  return trimmed
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function collapseExtractedEpiLabels(rawNames: string[]): string[] {
  const exploded = rawNames.flatMap((name) => splitGluedEpiPhrases(name));
  const labels: string[] = [];
  for (const part of exploded) {
    const label = canonicalizeEpiNeedLabel(part);
    if (!label) continue;
    const hit = labels.find((existing) => epiNeedsAreSame(existing, label));
    if (!hit) labels.push(label);
  }
  return labels;
}

export function findMatchingEpiNeed<T extends { name: string }>(
  suggestedName: string,
  needs: T[],
): T | null {
  const label = canonicalizeEpiNeedLabel(suggestedName) ?? suggestedName;
  const matches = needs.filter((need) => epiNeedsAreSame(label, need.name));
  if (matches.length === 0) return null;
  matches.sort((left, right) => {
    const leftSeed = resolveEpiNeedSeedForIdentity(left.name);
    const rightSeed = resolveEpiNeedSeedForIdentity(right.name);
    const leftExact = leftSeed && identityKey(left.name) === identityKey(leftSeed.name);
    const rightExact =
      rightSeed && identityKey(right.name) === identityKey(rightSeed.name);
    if (leftExact !== rightExact) return leftExact ? -1 : 1;
    return left.name.length - right.name.length;
  });
  return matches[0] ?? null;
}

export function clusterEpiNeedNames(names: string[]): string[][] {
  const keep = names.filter((name) => !isJunkEpiNeedName(name));
  const parent = keep.map((_, index) => index);
  const find = (index: number): number => {
    if (parent[index] !== index) parent[index] = find(parent[index]);
    return parent[index];
  };
  for (let i = 0; i < keep.length; i += 1) {
    for (let j = i + 1; j < keep.length; j += 1) {
      if (epiNeedsAreSame(keep[i], keep[j])) {
        const a = find(i);
        const b = find(j);
        if (a !== b) parent[b] = a;
      }
    }
  }
  const groups = new Map<number, string[]>();
  keep.forEach((name, index) => {
    const root = find(index);
    const list = groups.get(root) ?? [];
    list.push(name);
    groups.set(root, list);
  });
  return [...groups.values()];
}

/** CA/equipamento combina com a necessidade do PGR o suficiente para vincular. */
export function needNameMatchesEquipment(
  needName: string,
  equipmentName: string | null | undefined,
  extraText?: string | null,
): boolean {
  const blob = [equipmentName, extraText]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ');
  if (!needName.trim() || !blob.trim()) return false;

  const category = assessNeedEquipmentCompatibility(needName, equipmentName);
  if (!category.compatible) return false;

  if (
    epiNeedsAreSame(needName, blob) ||
    epiNeedsAreSame(needName, equipmentName ?? '')
  ) {
    return true;
  }
  if (findMatchingEpiNeed(equipmentName ?? blob, [{ name: needName }])) {
    return true;
  }
  const suggested = suggestNeedNamesFromText({
    name: equipmentName,
    equipmentName,
    description: extraText,
  });
  if (
    suggested.some(
      (label) =>
        epiNeedsAreSame(label, needName) ||
        Boolean(findMatchingEpiNeed(label, [{ name: needName }])),
    )
  ) {
    return true;
  }
  const seed = resolveEpiNeedSeedForIdentity(equipmentName ?? blob);
  if (!seed) return false;
  return (
    epiNeedsAreSame(seed.name, needName) ||
    Boolean(findMatchingEpiNeed(needName, [{ name: seed.name }]))
  );
}
