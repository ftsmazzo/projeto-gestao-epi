import assert from 'node:assert/strict';
import {
  pickPrimaryReplacementNeedId,
  resolveExtraReplacementNeedIds,
} from './extra-replacement.rules';

const protetorNeed = {
  epiNeedId: 'need-protetor',
  name: 'Protetor auditivo',
  category: 'AUDITIVO',
  linkedEpiItemIds: ['epi-39068'],
};

const luvasNeed = {
  epiNeedId: 'need-luvas',
  name: 'Luvas de protecao',
  category: 'MAOS',
  linkedEpiItemIds: ['epi-luva'],
};

const epiNovo = {
  id: 'epi-18189',
  name: 'PROTETOR AUDITIVO',
  category: 'AUDITIVO',
  caNumber: '18189',
};

assert.deepEqual(
  resolveExtraReplacementNeedIds({
    epi: epiNovo,
    workerNeeds: [protetorNeed, luvasNeed],
    explicitNeedId: 'need-protetor',
  }),
  ['need-protetor'],
);

assert.deepEqual(
  resolveExtraReplacementNeedIds({
    epi: epiNovo,
    workerNeeds: [protetorNeed, luvasNeed],
    linkedNeedIds: ['need-protetor'],
  }),
  ['need-protetor'],
);

assert.deepEqual(
  resolveExtraReplacementNeedIds({
    epi: epiNovo,
    workerNeeds: [protetorNeed, luvasNeed],
  }),
  ['need-protetor'],
);

assert.deepEqual(
  resolveExtraReplacementNeedIds({
    epi: {
      id: 'epi-x',
      name: 'Botina de seguranca',
      category: null,
      caNumber: '1',
    },
    workerNeeds: [protetorNeed, luvasNeed],
  }),
  [],
);

assert.equal(pickPrimaryReplacementNeedId(['need-protetor']), 'need-protetor');
assert.equal(pickPrimaryReplacementNeedId(['a', 'b']), null);

console.log('extra-replacement.rules.selftest: ok');
