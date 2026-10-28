import assert from 'node:assert/strict';
import {
  coverageKeyForDeliveryItem,
  equipmentFamilyKey,
  isOpenDeliveryItemStatus,
  pickPrimaryReplacementNeedId,
  resolveExtraReplacementNeedIds,
  sameEquipmentFamily,
  shouldMarkOlderItemReplaced,
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

assert.equal(
  shouldMarkOlderItemReplaced({
    olderDeliveryId: 'd1',
    newerDeliveryId: 'd1',
    olderDeliveredAt: '2026-09-08T12:00:00.000Z',
    newerDeliveredAt: '2026-09-08T12:00:00.000Z',
    olderEpiItemId: 'epi-18189',
    newerEpiItemId: 'epi-18189',
    olderEpiName: 'PROTETOR AUDITIVO',
    newerEpiName: 'PROTETOR AUDITIVO',
  }),
  false,
  'mesma entrega nao encerra irma',
);

assert.equal(
  shouldMarkOlderItemReplaced({
    olderDeliveryId: 'd-old',
    newerDeliveryId: 'd-new',
    olderDeliveredAt: '2026-08-01T12:00:00.000Z',
    newerDeliveredAt: '2026-09-08T12:00:00.000Z',
    olderEpiItemId: 'epi-39068',
    newerEpiItemId: 'epi-18189',
    olderEpiName: 'PROTETOR AUDITIVO',
    newerEpiName: 'PROTETOR AUDITIVO',
  }),
  true,
  'entrega nova da mesma familia encerra a antiga',
);

assert.equal(isOpenDeliveryItemStatus('DELIVERED'), true);
assert.equal(isOpenDeliveryItemStatus('REPLACED'), false);

console.log('extra-replacement.rules.selftest: ok');
