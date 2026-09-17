import assert from 'node:assert/strict';
import { SupportLifecycleStatus } from '@prisma/client';
import {
  canClaimSupportThread,
  canReplySupportThread,
} from './platform-support.policy';
import { searchSupportKnowledge } from './support-knowledge';

const agentA = 'platform-agent-a';
const agentB = 'platform-agent-b';

assert.equal(
  canClaimSupportThread({
    lifecycleStatus: SupportLifecycleStatus.WAITING_HUMAN,
    assignedToUserId: null,
    platformUserId: agentA,
  }),
  true,
);
assert.equal(
  canClaimSupportThread({
    lifecycleStatus: SupportLifecycleStatus.IN_PROGRESS,
    assignedToUserId: agentA,
    platformUserId: agentB,
  }),
  false,
);
assert.equal(
  canClaimSupportThread({
    lifecycleStatus: SupportLifecycleStatus.RESOLVED,
    assignedToUserId: null,
    platformUserId: agentA,
  }),
  false,
);
assert.equal(
  canReplySupportThread({
    lifecycleStatus: SupportLifecycleStatus.IN_PROGRESS,
    assignedToUserId: agentA,
    platformUserId: agentA,
  }),
  true,
);
assert.equal(
  canReplySupportThread({
    lifecycleStatus: SupportLifecycleStatus.RESOLVED,
    assignedToUserId: agentA,
    platformUserId: agentA,
  }),
  false,
);

const typoResults = searchSupportKnowledge({
  query: 'como cadastra trabahador por planilha',
  scope: 'CLIENTE',
  currentPath: '/portal/trabalhadores?id=exemplo',
  limit: 3,
});
assert.ok(typoResults.length > 0);
assert.ok(
  typoResults.some((entry) =>
    [entry.title, entry.question, ...entry.tags]
      .join(' ')
      .toLowerCase()
      .includes('trabalh'),
  ),
);

const scopedResults = searchSupportKnowledge({
  query: 'cliente',
  scope: 'CLIENTE',
  limit: 20,
});
assert.ok(
  scopedResults.every(
    (entry) => entry.scope === 'CLIENTE' || entry.scope === 'BOTH',
  ),
);

const expiredEpiResults = searchSupportKnowledge({
  query: 'como ver o epi que venceu e preciso entregar novamente',
  scope: 'CLIENTE',
  limit: 3,
});
assert.equal(expiredEpiResults[0]?.id, 'special-troca-epi-vencido');
assert.equal(expiredEpiResults[0]?.route, '/portal/trabalhadores');
assert.match(expiredEpiResults[0]?.answer ?? '', /nao possui filtros/i);

console.log('platform-support.selftest: ok');
