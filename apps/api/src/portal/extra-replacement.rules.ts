/** Troca de EPI por tipo/familia — CA/marca nao e identidade. */

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

/** Familias operacionais: troca de marca/CA dentro da familia encerra o alerta. */
const FAMILY_PATTERNS: Array<{ family: string; patterns: RegExp[] }> = [
  {
    family: 'auditivo',
    patterns: [
      /\bauditiv/,
      /\bauricular/,
      /\babafador/,
      /\bplug(ue)?\b/,
      /\bprotetor\b.*\b(ouvido|orelha)/,
    ],
  },
  {
    family: 'respiratorio',
    patterns: [
      /\brespirador/,
      /\bmascara/,
      /\bpff\d*/,
      /\bsemifacial/,
      /\bpurificador\b.*\bar\b/,
    ],
  },
  {
    family: 'ocular',
    patterns: [/\boculos/, /\bocular/, /\bvisiera/, /\bviseira/, /\bgoggles?/],
  },
  {
    family: 'maos',
    patterns: [/\bluva/, /\bgloves?/],
  },
  {
    family: 'calcado',
    patterns: [/\bbotina/, /\bbota\b/, /\bcalcado/, /\bsapat/],
  },
  {
    family: 'queda',
    patterns: [
      /\bcinturao/,
      /\btalabarte/,
      /\btrava.?queda/,
      /\bcadeira\b.*\bqued/,
    ],
  },
  {
    family: 'cabeca',
    patterns: [/\bcapacete/, /\bcasco\b/],
  },
];

export function equipmentFamilyKey(
  name: string | null | undefined,
  category?: string | null,
): string | null {
  const hay = normalizeMatchText(`${name ?? ''} ${category ?? ''}`);
  if (!hay) return null;
  for (const row of FAMILY_PATTERNS) {
    if (row.patterns.some((re) => re.test(hay))) return row.family;
  }
  const cat = normalizeMatchText(category ?? '');
  if (cat) return `cat:${cat}`;
  return null;
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
  // 1 token forte ja basta (ex.: "protetor" + familia); 2 tokens e ainda melhor.
  return shared >= 1;
}

/** Dois EPIs/necessidades cobrem a mesma protecao (independente do CA). */
export function sameEquipmentFamily(input: {
  leftName: string;
  leftCategory?: string | null;
  rightName: string;
  rightCategory?: string | null;
}): boolean {
  const leftFamily = equipmentFamilyKey(input.leftName, input.leftCategory);
  const rightFamily = equipmentFamilyKey(input.rightName, input.rightCategory);
  if (leftFamily && rightFamily && leftFamily === rightFamily) return true;
  return namesOverlap(input.leftName, input.rightName);
}

/**
 * Retorna IDs de necessidade da funcao do trabalhador que o Extra deve encerrar.
 * Ordem: need explicita → vinculo → familia/categoria → nome.
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

  const byFamily = workerNeeds
    .filter((need) =>
      sameEquipmentFamily({
        leftName: epi.name,
        leftCategory: epi.category,
        rightName: need.name,
        rightCategory: need.category,
      }),
    )
    .map((need) => need.epiNeedId);
  return [...new Set(byFamily)];
}

export function pickPrimaryReplacementNeedId(needIds: string[]) {
  if (needIds.length === 1) return needIds[0] ?? null;
  return null;
}

/**
 * Chave de cobertura para alertas: familia > necessidade > item.
 * Assim CA diferente da mesma familia nao gera alerta paralelo.
 */
export function coverageKeyForDeliveryItem(input: {
  workerId: string;
  epiNeedId?: string | null;
  epiItemId: string;
  epiName: string;
  epiCategory?: string | null;
  needName?: string | null;
  needCategory?: string | null;
}): string {
  const family =
    equipmentFamilyKey(input.epiName, input.epiCategory) ??
    equipmentFamilyKey(input.needName, input.needCategory);
  if (family) return `${input.workerId}:family:${family}`;
  if (input.epiNeedId) return `${input.workerId}:need:${input.epiNeedId}`;
  return `${input.workerId}:item:${input.epiItemId}`;
}

/**
 * Decide se a linha mais antiga deve ser encerrada pela mais nova.
 * Nunca encerra irmas da mesma entrega — qty/vida util somam no recibo.
 */
export function shouldMarkOlderItemReplaced(input: {
  olderDeliveryId: string;
  newerDeliveryId: string;
  olderDeliveredAt: Date | string;
  newerDeliveredAt: Date | string;
  olderEpiItemId: string;
  newerEpiItemId: string;
  olderEpiNeedId?: string | null;
  newerEpiNeedId?: string | null;
  olderEpiName: string;
  olderEpiCategory?: string | null;
  newerEpiName: string;
  newerEpiCategory?: string | null;
  olderNeedName?: string | null;
  olderNeedCategory?: string | null;
}): boolean {
  if (input.olderDeliveryId === input.newerDeliveryId) return false;
  const olderAt = new Date(input.olderDeliveredAt).getTime();
  const newerAt = new Date(input.newerDeliveredAt).getTime();
  if (!Number.isFinite(olderAt) || !Number.isFinite(newerAt)) return false;
  if (newerAt <= olderAt) return false;

  if (input.newerEpiItemId === input.olderEpiItemId) return true;
  if (
    input.olderEpiNeedId &&
    input.newerEpiNeedId &&
    input.olderEpiNeedId === input.newerEpiNeedId
  ) {
    return true;
  }
  if (
    sameEquipmentFamily({
      leftName: input.olderEpiName,
      leftCategory: input.olderEpiCategory,
      rightName: input.newerEpiName,
      rightCategory: input.newerEpiCategory,
    })
  ) {
    return true;
  }
  if (
    input.olderNeedName &&
    sameEquipmentFamily({
      leftName: input.olderNeedName,
      leftCategory: input.olderNeedCategory,
      rightName: input.newerEpiName,
      rightCategory: input.newerEpiCategory,
    })
  ) {
    return true;
  }
  return false;
}

/** Linha ainda conta para alerta e vida util restante na ficha. */
export function isOpenDeliveryItemStatus(status: string): boolean {
  return status === 'DELIVERED' || status === 'PARTIALLY_RETURNED';
}
