/**
 * Uso: npx --yes tsx src/distributor/agenda.rules.selftest.ts
 */
import {
  AgendaRuleError,
  formatVisitedAt,
  normalizeCustomerName,
  normalizeNextAction,
  normalizeVisitSummary,
  parseVisitedAt,
} from './agenda.rules';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(normalizeCustomerName('  Acme EPI  ') === 'Acme EPI', 'name');
assert(normalizeVisitSummary('Falamos do CA 123') === 'Falamos do CA 123', 'summary');
assert(normalizeNextAction('  enviar orcamento ') === 'enviar orcamento', 'next');
assert(normalizeNextAction('') === null, 'next vazio');
assert(formatVisitedAt(parseVisitedAt('2026-10-20')) === '2026-10-20', 'date');

let bad = false;
try {
  normalizeVisitSummary('ok');
} catch (error) {
  bad = error instanceof AgendaRuleError;
}
assert(bad, 'resumo curto');

console.log('agenda.rules.selftest ok');
