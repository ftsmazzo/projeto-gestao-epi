import { EpiCategory, EpiUsefulLifeUnit } from '@prisma/client';
import { DEFAULT_EPI_NEED_SEEDS } from './epi-need-suggest';

export type UsefulLifeSpec = {
  value: number;
  unit: EpiUsefulLifeUnit;
};

function normalizeNeedKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function specOf(value: number, unit: EpiUsefulLifeUnit): UsefulLifeSpec {
  return { value, unit };
}

function isDisposableOneDay(spec: UsefulLifeSpec): boolean {
  return spec.value === 1 && spec.unit === EpiUsefulLifeUnit.DIAS;
}

/** Lookup exato por nome oficial ou alias. Sem fuzzy de palavra curta. */
const BY_EXACT_KEY: Record<string, UsefulLifeSpec> = (() => {
  const map: Record<string, UsefulLifeSpec> = {};
  for (const seed of DEFAULT_EPI_NEED_SEEDS) {
    const spec = specOf(seed.usefulLifeValue, seed.usefulLifeUnit);
    map[normalizeNeedKey(seed.name)] = spec;
    for (const alias of seed.aliases) {
      const key = normalizeNeedKey(alias);
      if (key.length >= 4 && !map[key]) map[key] = spec;
    }
  }
  return map;
})();

const BY_CATEGORY: Partial<Record<EpiCategory, UsefulLifeSpec>> = {
  [EpiCategory.AUDITIVA]: specOf(6, EpiUsefulLifeUnit.MESES),
  [EpiCategory.RESPIRATORIA]: specOf(3, EpiUsefulLifeUnit.DIAS),
  [EpiCategory.OLHOS]: specOf(6, EpiUsefulLifeUnit.MESES),
  [EpiCategory.MAOS]: specOf(15, EpiUsefulLifeUnit.DIAS),
  [EpiCategory.PES]: specOf(6, EpiUsefulLifeUnit.MESES),
  [EpiCategory.CABECA]: specOf(5, EpiUsefulLifeUnit.ANOS),
  [EpiCategory.QUEDA]: specOf(5, EpiUsefulLifeUnit.ANOS),
  [EpiCategory.TRONCO]: specOf(2, EpiUsefulLifeUnit.MESES),
  [EpiCategory.OUTROS]: specOf(30, EpiUsefulLifeUnit.DIAS),
};

export function standardUsefulLifeForNeed(
  name?: string | null,
  category?: string | null,
): UsefulLifeSpec | null {
  const key = normalizeNeedKey(name ?? '');
  if (key && BY_EXACT_KEY[key]) return BY_EXACT_KEY[key];

  if (key.length >= 8) {
    let best: { spec: UsefulLifeSpec; len: number } | null = null;
    for (const seed of DEFAULT_EPI_NEED_SEEDS) {
      const candidates = [seed.name, ...seed.aliases].map(normalizeNeedKey);
      for (const candidate of candidates) {
        if (candidate.length < 10) continue;
        if (key.includes(candidate) && (!best || candidate.length > best.len)) {
          best = {
            spec: specOf(seed.usefulLifeValue, seed.usefulLifeUnit),
            len: candidate.length,
          };
        }
      }
    }
    if (best) return best.spec;
  }

  if (category && category in BY_CATEGORY) {
    return BY_CATEGORY[category as EpiCategory] ?? null;
  }
  return null;
}

export function resolveUsefulLife(input: {
  name?: string | null;
  category?: string | null;
  value?: number | null;
  unit?: string | null;
}): UsefulLifeSpec | null {
  const fromName = standardUsefulLifeForNeed(input.name, input.category);
  const stored =
    input.value != null && input.value > 0 && input.unit
      ? specOf(input.value, input.unit as EpiUsefulLifeUnit)
      : null;
  const storedValid =
    stored &&
    (stored.unit === EpiUsefulLifeUnit.DIAS ||
      stored.unit === EpiUsefulLifeUnit.MESES ||
      stored.unit === EpiUsefulLifeUnit.ANOS);

  // 1 dia gravado no item foi o vazamento do PFF2 antigo — so mantem se o nome tambem for 1 dia.
  if (storedValid && isDisposableOneDay(stored) && fromName && !isDisposableOneDay(fromName)) {
    return fromName;
  }
  if (storedValid) return stored;
  return fromName;
}
