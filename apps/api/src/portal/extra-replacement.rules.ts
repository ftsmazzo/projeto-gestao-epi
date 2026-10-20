/** Resolve quais necessidades de EPI um item Extra pode encerrar na troca. */

export type ExtraReplacementNeed = {
  epiNeedId: string;
  name: string;
  category: string | null;
  linkedEpiItemIds: string[];
};

export type ExtraReplacementEpi = {
  id: string;
  name: string;
  category: string | null;
  caNumber: string | null;
};

export function normalizeMatchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function namesOverlap(a: string, b: string) {
  const left = normalizeMatchText(a);
  const right = normalizeMatchText(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  const leftTokens = left.split(/\s+/).filter((t) => t.length >= 4);
  const rightTokens = new Set(right.split(/\s+/).filter((t) => t.length >= 4));
  if (leftTokens.length === 0 || rightTokens.size === 0) return false;
  const shared = leftTokens.filter((t) => rightTokens.has(t)).length;
  return shared >= Math.min(2, leftTokens.length, rightTokens.size);
}

/**
 * Retorna IDs de necessidade da funcao do trabalhador que o Extra deve encerrar.
 * Ordem de prioridade: need explicita → vinculo item↔need → categoria → nome.
 */
export function resolveExtraReplacementNeedIds(input: {
  epi: ExtraReplacementEpi;
  workerNeeds: ExtraReplacementNeed[];
  explicitNeedId?: string | null;
  linkedNeedIds?: string[];
}): string[] {
  const { epi, workerNeeds, explicitNeedId, linkedNeedIds = [] } = input;
  if (workerNeeds.length === 0) return [];

  const byId = new Map(workerNeeds.map((need) => [need.epiNeedId, need]));

  if (explicitNeedId?.trim()) {
    const need = byId.get(explicitNeedId.trim());
    if (need) return [need.epiNeedId];
  }

  const linked = linkedNeedIds
    .map((id) => byId.get(id))
    .filter((need): need is ExtraReplacementNeed => Boolean(need))
    .map((need) => need.epiNeedId);
  if (linked.length > 0) return [...new Set(linked)];

  const byItemLink = workerNeeds
    .filter((need) => need.linkedEpiItemIds.includes(epi.id))
    .map((need) => need.epiNeedId);
  if (byItemLink.length > 0) return [...new Set(byItemLink)];

  const epiCategory = normalizeMatchText(epi.category ?? '');
  if (epiCategory) {
    const byCategory = workerNeeds
      .filter((need) => normalizeMatchText(need.category ?? '') === epiCategory)
      .map((need) => need.epiNeedId);
    if (byCategory.length > 0) return [...new Set(byCategory)];
  }

  const byName = workerNeeds
    .filter((need) => namesOverlap(epi.name, need.name))
    .map((need) => need.epiNeedId);
  return [...new Set(byName)];
}

/** Preferencia para persistir no item Extra (uma necessidade primaria). */
export function pickPrimaryReplacementNeedId(needIds: string[]) {
  if (needIds.length === 1) return needIds[0] ?? null;
  return null;
}
