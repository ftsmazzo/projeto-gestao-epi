export class FinanceRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinanceRuleError';
  }
}

export type LedgerSeed = {
  code: string;
  name: string;
  kind: 'ASSET' | 'LIABILITY' | 'REVENUE' | 'EXPENSE';
};

/** Plano inicial enxuto para DRE e classificacao das contas. */
export const DEFAULT_LEDGER_ACCOUNTS: readonly LedgerSeed[] = [
  { code: '1.1.01', name: 'Caixa', kind: 'ASSET' },
  { code: '1.1.02', name: 'Contas a receber', kind: 'ASSET' },
  { code: '2.1.01', name: 'Contas a pagar', kind: 'LIABILITY' },
  { code: '3.1.01', name: 'Receita de mercadorias', kind: 'REVENUE' },
  { code: '4.1.01', name: 'Custo das mercadorias', kind: 'EXPENSE' },
  { code: '4.2.01', name: 'Despesas operacionais', kind: 'EXPENSE' },
] as const;

export const PAYABLE_ACCOUNT_CODE = '2.1.01';
export const RECEIVABLE_ACCOUNT_CODE = '1.1.02';
export const REVENUE_ACCOUNT_CODE = '3.1.01';

/** Vencimento padrao: hoje + N dias (UTC, meia-noite). */
export function defaultDueOn(days = 30, from: Date = new Date()): Date {
  if (!Number.isInteger(days) || days < 0 || days > 3650) {
    throw new FinanceRuleError('Prazo de vencimento invalido.');
  }
  const day = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  day.setUTCDate(day.getUTCDate() + days);
  return day;
}

export function assertReceivableAmount(amountCents: number): number {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new FinanceRuleError('O valor da conta a receber precisa ser zero ou positivo.');
  }
  return amountCents;
}

export function assertMarkReceivableReceived(status: string): void {
  if (status !== 'OPEN') {
    throw new FinanceRuleError('So conta em aberto pode ser marcada como recebida.');
  }
}

export function assertCancelReceivable(status: string): void {
  if (status !== 'OPEN') {
    throw new FinanceRuleError('So conta em aberto pode ser cancelada.');
  }
}

export function sumOpenCents(
  rows: Array<{ status: string; amountCents: number }>,
  openStatus: string,
): number {
  return rows.reduce(
    (total, row) => (row.status === openStatus ? total + row.amountCents : total),
    0,
  );
}

export function dreTotals(input: {
  revenueCents: number;
  expenseCents: number;
}): { revenueCents: number; expenseCents: number; resultCents: number } {
  if (
    !Number.isInteger(input.revenueCents) ||
    !Number.isInteger(input.expenseCents) ||
    input.revenueCents < 0 ||
    input.expenseCents < 0
  ) {
    throw new FinanceRuleError('Totais do DRE invalidos.');
  }
  return {
    revenueCents: input.revenueCents,
    expenseCents: input.expenseCents,
    resultCents: input.revenueCents - input.expenseCents,
  };
}

export function assertCashAmount(amountCents: number): number {
  if (!Number.isInteger(amountCents) || amountCents < 1) {
    throw new FinanceRuleError('O valor do movimento de caixa precisa ser positivo.');
  }
  return amountCents;
}

export function nextCashBalance(
  currentCents: number,
  direction: 'IN' | 'OUT',
  amountCents: number,
): number {
  assertCashAmount(amountCents);
  if (!Number.isInteger(currentCents)) {
    throw new FinanceRuleError('Saldo de caixa invalido.');
  }
  const next =
    direction === 'IN' ? currentCents + amountCents : currentCents - amountCents;
  if (next < 0) {
    throw new FinanceRuleError('Saldo insuficiente nesta conta bancaria.');
  }
  return next;
}

export function runningBalancesByMovement(
  movements: Array<{
    id: string;
    direction: string;
    amountCents: number;
    createdAt: Date | string;
  }>,
): Map<string, number> {
  const ordered = [...movements].sort((left, right) => {
    const delta =
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    if (delta !== 0) return delta;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  const balances = new Map<string, number>();
  let running = 0;
  for (const row of ordered) {
    if (!Number.isInteger(row.amountCents) || row.amountCents < 0) {
      throw new FinanceRuleError('Movimento de caixa invalido.');
    }
    running =
      row.direction === 'IN' ? running + row.amountCents : running - row.amountCents;
    balances.set(row.id, running);
  }
  return balances;
}

export function cashBalanceFromMovements(
  movements: Array<{ direction: string; amountCents: number }>,
): number {
  return movements.reduce((total, row) => {
    if (!Number.isInteger(row.amountCents) || row.amountCents < 0) {
      throw new FinanceRuleError('Movimento de caixa invalido.');
    }
    return row.direction === 'IN'
      ? total + row.amountCents
      : total - row.amountCents;
  }, 0);
}

export function assertReconcileToggle(input: {
  currentlyReconciled: boolean;
  reconcile: boolean;
}): void {
  if (input.reconcile && input.currentlyReconciled) {
    throw new FinanceRuleError('Este movimento ja esta conciliado.');
  }
  if (!input.reconcile && !input.currentlyReconciled) {
    throw new FinanceRuleError('Este movimento ainda nao esta conciliado.');
  }
}

export function cashFlowTotals(
  movements: Array<{ direction: string; amountCents: number }>,
): { inflowCents: number; outflowCents: number; netCents: number } {
  let inflowCents = 0;
  let outflowCents = 0;
  for (const row of movements) {
    if (!Number.isInteger(row.amountCents) || row.amountCents < 0) {
      throw new FinanceRuleError('Movimento de caixa invalido.');
    }
    if (row.direction === 'IN') inflowCents += row.amountCents;
    else outflowCents += row.amountCents;
  }
  return {
    inflowCents,
    outflowCents,
    netCents: inflowCents - outflowCents,
  };
}
