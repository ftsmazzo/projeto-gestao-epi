export class PlusRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlusRuleError';
  }
}

export function assertPlusContractActive(status: string) {
  if (status !== 'ACTIVE') {
    throw new PlusRuleError('Este contrato Plus esta revogado.');
  }
}

export function assertPlusMappingTargets(input: {
  epiItemId: string;
  epiVariantId?: string | null;
}) {
  const epiItemId = input.epiItemId.trim();
  if (!epiItemId) {
    throw new PlusRuleError('Informe o EPI do cliente ProntEPI.');
  }
  const epiVariantId = input.epiVariantId?.trim() || null;
  return { epiItemId, epiVariantId };
}

export function plusShipmentNotes(input: {
  series: string;
  number: number;
  distributorName: string;
}) {
  return `Entrada Plus — NF ${input.series}/${input.number} (${input.distributorName})`;
}

export function pickPlusMappedLines<T extends { variantId: string; quantity: number }>(
  lines: T[],
  mappings: Array<{ variantId: string; epiItemId: string; epiVariantId: string | null }>,
) {
  const byVariant = new Map(mappings.map((row) => [row.variantId, row]));
  const mapped: Array<
    T & { epiItemId: string; epiVariantId: string | null }
  > = [];
  for (const line of lines) {
    const mapping = byVariant.get(line.variantId);
    if (!mapping) continue;
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new PlusRuleError('Quantidade Plus invalida.');
    }
    mapped.push({
      ...line,
      epiItemId: mapping.epiItemId,
      epiVariantId: mapping.epiVariantId,
    });
  }
  return mapped;
}
