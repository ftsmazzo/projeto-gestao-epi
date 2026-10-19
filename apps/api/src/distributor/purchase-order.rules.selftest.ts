/**
 * Regras do pedido de compra: duas liberacoes e estoque so no recebimento.
 * Uso: npx --yes tsx src/distributor/purchase-order.rules.selftest.ts
 */
import {
  PurchaseOrderRuleError,
  receivePurchaseOrder,
  rejectPurchaseOrder,
  releasePurchaseOrder,
} from './purchase-order.rules';

function assert(name: string, ok: boolean) {
  if (!ok) {
    throw new Error(`Falhou: ${name}`);
  }
}

function throws(name: string, run: () => void, expected: string) {
  try {
    run();
  } catch (error) {
    assert(
      name,
      error instanceof PurchaseOrderRuleError && error.message === expected,
    );
    return;
  }
  throw new Error(`Falhou: ${name} deveria recusar`);
}

assert(
  'primeira liberacao',
  releasePurchaseOrder({
    status: 'AWAITING_FIRST',
    step: 1,
    actorUserId: 'ana',
    firstApproverUserId: null,
  }) === 'AWAITING_SECOND',
);

assert(
  'segunda liberacao de outra pessoa',
  releasePurchaseOrder({
    status: 'AWAITING_SECOND',
    step: 2,
    actorUserId: 'bia',
    firstApproverUserId: 'ana',
  }) === 'APPROVED',
);

throws(
  'segunda liberacao da mesma pessoa',
  () =>
    releasePurchaseOrder({
      status: 'AWAITING_SECOND',
      step: 2,
      actorUserId: 'ana',
      firstApproverUserId: 'ana',
    }),
  'A segunda liberacao precisa ser de outra pessoa.',
);

assert(
  'recusa antes da segunda liberacao',
  rejectPurchaseOrder('AWAITING_SECOND') === 'REJECTED',
);

throws(
  'recusa depois de aprovado',
  () => rejectPurchaseOrder('APPROVED'),
  'So da para recusar um pedido que ainda aguarda liberacao.',
);

throws(
  'receber sem as duas liberacoes',
  () => receivePurchaseOrder('AWAITING_SECOND'),
  'O recebimento so acontece depois das duas liberacoes.',
);

throws(
  'pedido recusado nao entra no estoque',
  () => receivePurchaseOrder('REJECTED'),
  'Pedido recusado nao entra no estoque.',
);

assert(
  'receber depois das duas liberacoes',
  receivePurchaseOrder('APPROVED') === 'RECEIVED',
);

throws(
  'receber de novo',
  () => receivePurchaseOrder('RECEIVED'),
  'Este pedido ja entrou no estoque.',
);

console.log('purchase-order.rules.selftest ok');
