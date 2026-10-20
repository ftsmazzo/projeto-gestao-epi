/**
 * Uso: npx --yes tsx src/distributor/finance.rules.selftest.ts
 */
import {
  DEFAULT_LEDGER_ACCOUNTS,
  FinanceRuleError,
  assertCancelReceivable,
  assertMarkReceivableReceived,
  assertReceivableAmount,
  defaultDueOn,
  dreTotals,
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

console.log('finance.rules.selftest ok');
