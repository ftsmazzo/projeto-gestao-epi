/**
 * Uso: npx --yes tsx src/distributor/finance.rules.selftest.ts
 */
import {
  DEFAULT_LEDGER_ACCOUNTS,
  FinanceRuleError,
  assertCancelReceivable,
  assertCashAmount,
  assertMarkReceivableReceived,
  assertReceivableAmount,
  assertReconcileToggle,
  cashBalanceFromMovements,
  cashFlowTotals,
  defaultDueOn,
  dreTotals,
  nextCashBalance,
  sumOpenCents,
} from './finance.rules';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(DEFAULT_LEDGER_ACCOUNTS.length >= 6, 'plano padrao');
const due = defaultDueOn(30, new Date('2026-10-20T15:00:00.000Z'));
assert(due.toISOString().startsWith('2026-11-19'), `due got ${due.toISOString()}`);

assert(assertReceivableAmount(1500) === 1500, 'amount');
assertMarkReceivableReceived('OPEN');
assertCancelReceivable('OPEN');

let bad = false;
try {
  assertMarkReceivableReceived('RECEIVED');
} catch (error) {
  bad = error instanceof FinanceRuleError;
}
assert(bad, 'received nao remarca');

assert(
  sumOpenCents(
    [
      { status: 'OPEN', amountCents: 100 },
      { status: 'RECEIVED', amountCents: 50 },
    ],
    'OPEN',
  ) === 100,
  'open sum',
);

const dre = dreTotals({ revenueCents: 10000, expenseCents: 4000 });
assert(dre.resultCents === 6000, 'dre');

assert(assertCashAmount(100) === 100, 'cash amount');
assert(nextCashBalance(1000, 'IN', 500) === 1500, 'cash in');
assert(nextCashBalance(1000, 'OUT', 400) === 600, 'cash out');
let overdraw = false;
try {
  nextCashBalance(100, 'OUT', 200);
} catch (error) {
  overdraw = error instanceof FinanceRuleError;
}
assert(overdraw, 'sem saldo negativo');
assert(
  cashBalanceFromMovements([
    { direction: 'IN', amountCents: 1000 },
    { direction: 'OUT', amountCents: 250 },
  ]) === 750,
  'balance from movements',
);

assertReconcileToggle({ currentlyReconciled: false, reconcile: true });
let already = false;
try {
  assertReconcileToggle({ currentlyReconciled: true, reconcile: true });
} catch (error) {
  already = error instanceof FinanceRuleError;
}
assert(already, 'nao reconcilia de novo');

const flow = cashFlowTotals([
  { direction: 'IN', amountCents: 1000 },
  { direction: 'OUT', amountCents: 300 },
  { direction: 'IN', amountCents: 50 },
]);
assert(flow.inflowCents === 1050, 'inflow');
assert(flow.outflowCents === 300, 'outflow');
assert(flow.netCents === 750, 'net');

console.log('finance.rules.selftest ok');
