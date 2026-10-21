export class PayableRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayableRuleError';
  }
}

export function sumCostLines(
  lines: Array<{ quantity: number; unitCostCents: number | null | undefined }>,
): number {
  let total = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new PayableRuleError('Quantidade invalida na conta a pagar.');
    }
    const unit = line.unitCostCents ?? 0;
    if (!Number.isInteger(unit) || unit < 0) {
      throw new PayableRuleError('Custo invalido na conta a pagar.');
    }
    total += unit * line.quantity;
  }
  return total;
}

export function manualStockTitleCents(
  unitCostCents: number | null | undefined,
  quantity: number,
): number | null {
  if (unitCostCents == null) return null;
  if (!Number.isInteger(unitCostCents) || unitCostCents < 1) return null;
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  const total = unitCostCents * quantity;
  if (!Number.isSafeInteger(total)) return null;
  return total;
}

export function assertPayableAmount(amountCents: number): number {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new PayableRuleError('O valor da conta precisa ser zero ou positivo.');
  }
  return amountCents;
}

export function assertMarkPayablePaid(status: string): void {
  if (status !== 'OPEN') {
    throw new PayableRuleError('So conta em aberto pode ser marcada como paga.');
  }
}

export function assertCancelPayable(status: string): void {
  if (status !== 'OPEN') {
    throw new PayableRuleError('So conta em aberto pode ser cancelada.');
  }
}

export function parseDueDay(value: string | null | undefined): Date | null {
  if (value == null || value.trim() === '') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new PayableRuleError('Informe o vencimento como AAAA-MM-DD.');
  }
  const day = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime())) {
    throw new PayableRuleError('Vencimento invalido.');
  }
  return day;
}

export function formatDueDay(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}
