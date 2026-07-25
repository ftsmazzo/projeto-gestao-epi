/**
 * Agrupa requisitos de funcao por necessidade de EPI (epiNeedId).
 * Evita produto cartesiano risco x necessidade na preparacao de entrega.
 */

export type CoverageRequirementInput = {
  id: string;
  epiNeedId: string;
  needName: string;
  isRequired: boolean;
  quantity: number;
  replacementIntervalDays: number | null;
  riskId: string | null;
  riskName: string | null;
};

export type GroupedCoverageNeed = {
  requirementIds: string[];
  /** @deprecated use requirementIds[0]; mantido para compat UI */
  requirementId: string;
  epiNeedId: string;
  needName: string;
  /** @deprecated use risks; mantido para compat */
  riskId: string | null;
  /** @deprecated use risks; mantido para compat */
  riskName: string | null;
  risks: Array<{ id: string; name: string }>;
  isRequired: boolean;
  quantity: number;
  replacementIntervalDays: number | null;
  warnings: string[];
};

const RESTRICTIVE_WARNING =
  'Ha mais de uma regra para esta necessidade; foi usado o criterio mais restritivo.';

export function groupCoverageRequirementsByNeed(
  requirements: CoverageRequirementInput[],
): GroupedCoverageNeed[] {
  const byNeed = new Map<string, CoverageRequirementInput[]>();

  for (const req of requirements) {
    const list = byNeed.get(req.epiNeedId) ?? [];
    list.push(req);
    byNeed.set(req.epiNeedId, list);
  }

  const grouped: GroupedCoverageNeed[] = [];

  for (const [, group] of byNeed) {
    const first = group[0]!;
    const requirementIds = group.map((r) => r.id);
    const isRequired = group.some((r) => r.isRequired);

    const quantities = group.map((r) => r.quantity);
    const maxQuantity = Math.max(...quantities);
    const quantityConflict = quantities.some((q) => q !== quantities[0]);

    const intervals = group
      .map((r) => r.replacementIntervalDays)
      .filter((d): d is number => d != null && d > 0);
    let replacementIntervalDays: number | null = null;
    let intervalConflict = false;
    if (intervals.length > 0) {
      replacementIntervalDays = Math.min(...intervals);
      intervalConflict = intervals.some((d) => d !== intervals[0]);
    } else if (
      group.some((r) => r.replacementIntervalDays == null) &&
      group.some((r) => r.replacementIntervalDays != null)
    ) {
      // alguns com intervalo e outros sem: usa o menor dos definidos
      replacementIntervalDays =
        intervals.length > 0 ? Math.min(...intervals) : null;
      intervalConflict = true;
    }

    const riskMap = new Map<string, string>();
    for (const r of group) {
      if (r.riskId && r.riskName) {
        riskMap.set(r.riskId, r.riskName);
      }
    }
    const risks = Array.from(riskMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    const warnings: string[] = [];
    if (quantityConflict || intervalConflict) {
      warnings.push(RESTRICTIVE_WARNING);
    }

    grouped.push({
      requirementIds,
      requirementId: requirementIds[0]!,
      epiNeedId: first.epiNeedId,
      needName: first.needName,
      riskId: risks[0]?.id ?? null,
      riskName: risks.map((r) => r.name).join(', ') || null,
      risks,
      isRequired,
      quantity: maxQuantity,
      replacementIntervalDays,
      warnings,
    });
  }

  return grouped.sort((a, b) => {
    if (a.isRequired !== b.isRequired) return a.isRequired ? -1 : 1;
    return a.needName.localeCompare(b.needName, 'pt-BR');
  });
}

/** Intervalo mais restritivo (menor em dias) entre requisitos da mesma necessidade. */
export function resolveRestrictiveReplacementDays(
  intervals: Array<number | null | undefined>,
): number | null {
  const defined = intervals.filter(
    (d): d is number => d != null && Number.isFinite(d) && d > 0,
  );
  if (defined.length === 0) return null;
  return Math.min(...defined);
}
