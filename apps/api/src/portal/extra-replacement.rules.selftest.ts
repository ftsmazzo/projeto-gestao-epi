import assert from 'node:assert/strict';
import {
  coverageKeyForDeliveryItem,
  equipmentFamilyKey,
  pickPrimaryReplacementNeedId,
  resolveExtraReplacementNeedIds,
  sameEquipmentFamily,
} from './extra-replacement.rules';

assert.equal(
  equipmentFamilyKey('PROTETOR AUDITIVO', null),
  'auditivo',
);
assert.equal(
  equipmentFamilyKey('Protetor auricular tipo concha', 'X'),
  'auditivo',
);
assert.ok(
  sameEquipmentFamily({
    leftName: 'PROTETOR AUDITIVO',
    leftCategory: null,
    rightName: 'Protecao auditiva',
    rightCategory: 'OUVIDO',
  }),
);
assert.ok(
  sameEquipmentFamily({
    leftName: 'PROTETOR AUDITIVO CA 39068',
    rightName: 'PROTETOR AUDITIVO',
    rightCategory: null,
  }),
);

const protetorNeed = {
  epiNeedId: 'need-protetor',
  name: 'Protecao auditiva',
  category: 'OUVIDO',
  linkedEpiItemIds: ['epi-39068'],
};

assert.deepEqual(
  resolveExtraReplacementNeedIds({
    epi: {
      id: 'epi-18189',
      name: 'PROTETOR AUDITIVO',
      category: null,
      caNumber: '18189',
    },
    workerNeeds: [protetorNeed],
  }),
  ['need-protetor'],
);

assert.equal(
  coverageKeyForDeliveryItem({
    workerId: 'w1',
    epiNeedId: 'need-a',
    epiItemId: 'epi-39068',
    epiName: 'PROTETOR AUDITIVO',
  }),
  coverageKeyForDeliveryItem({
    workerId: 'w1',
    epiNeedId: null,
    epiItemId: 'epi-18189',
    epiName: 'PROTETOR AUDITIVO',
  }),
);

assert.equal(pickPrimaryReplacementNeedId(['need-protetor']), 'need-protetor');

console.log('extra-replacement.rules.selftest: ok');
