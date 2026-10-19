/**
 * Saida pelo lote que vence primeiro.
 * Uso: npx --yes tsx src/distributor/lot.rules.selftest.ts
 */
import { LotRuleError, allocateFefo, parseExpiryDay } from './lot.rules';

function assert(name: string, ok: boolean) {
  if (!ok) throw new Error(`Falhou: ${name}`);
}

const taken = allocateFefo(
  [
    {
      id: 'novo',
      code: 'B',
      quantity: 5,
      expiresOn: '2027-01-01',
      createdAt: '2026-02-01T00:00:00.000Z',
    },
    {
      id: 'velho',
      code: 'A',
      quantity: 2,
      expiresOn: '2026-11-01',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'sem',
      code: 'C',
      quantity: 9,
      expiresOn: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  4,
);

assert(
  'consome o que vence antes e completa no seguinte',
  taken.length === 2 && taken[0]?.id === 'velho' && taken[0].quantity === 2 && taken[1]?.id === 'novo' && taken[1].quantity === 2,
);

let short = false;
try {
  allocateFefo(
    [
      {
        id: 'a',
        code: 'A',
        quantity: 1,
        expiresOn: '2026-12-01',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    3,
  );
} catch (error) {
  short = error instanceof LotRuleError;
}
assert('saldo curto recusa', short);

const day = parseExpiryDay('2026-12-31');
assert('validade em UTC', day?.toISOString() === '2026-12-31T00:00:00.000Z');

console.log('lot.rules.selftest ok');
