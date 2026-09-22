import assert from 'node:assert/strict';
import { pickBestJobMatch } from './reassign-archived-job-workers';

const candidates = [
  {
    id: 'archived-old',
    name: 'TORNEIRO MECANICO III',
    sectorId: 'sec-old',
    isActive: false,
    sector: { name: 'TORNEARIA' },
  },
  {
    id: 'active-new',
    name: 'TORNEIRO MECANICO III',
    sectorId: 'sec-new',
    isActive: true,
    sector: { name: 'TORNEARIA' },
  },
  {
    id: 'active-other-sector',
    name: 'TORNEIRO MECANICO III',
    sectorId: 'sec-other',
    isActive: true,
    sector: { name: 'PRODUCAO' },
  },
];

const best = pickBestJobMatch(candidates, 'sec-new', 'TORNEARIA');
assert.equal(best?.id, 'active-new');

const byNameOnly = pickBestJobMatch(candidates, null, 'TORNEARIA');
assert.equal(byNameOnly?.id, 'active-new');

const onlyArchived = pickBestJobMatch(
  [candidates[0]!],
  'sec-old',
  'TORNEARIA',
);
assert.equal(onlyArchived?.id, 'archived-old');

assert.equal(pickBestJobMatch([], null, null), null);

console.log('reassign-archived-job-workers.selftest: ok');
