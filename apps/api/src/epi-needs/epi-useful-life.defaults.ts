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

/** Mesma tabela das sugestoes + aliases, para nao haver dois padroes. */
const BY_NEED_NAME: Record<string, UsefulLifeSpec> = (() => {
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
  if (key && BY_NEED_NAME[key]) return BY_NEED_NAME[key];
  if (key) {
    let best: { spec: UsefulLifeSpec; len: number } | null = null;
    for (const [seed, spec] of Object.entries(BY_NEED_NAME)) {
      if (key.includes(seed) || seed.includes(key)) {
        if (!best || seed.length > best.len) {
          best = { spec, len: seed.length };
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
  if (input.value != null && input.value > 0 && input.unit) {
    const unit = input.unit as EpiUsefulLifeUnit;
    if (
      unit === EpiUsefulLifeUnit.DIAS ||
      unit === EpiUsefulLifeUnit.MESES ||
      unit === EpiUsefulLifeUnit.ANOS
    ) {
      return { value: input.value, unit };
    }
  }
  return standardUsefulLifeForNeed(input.name, input.category);
}
