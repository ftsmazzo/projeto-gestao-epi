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
