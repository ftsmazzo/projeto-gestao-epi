export const PURCHASE_ORDER_STATUSES = [
  'AWAITING_FIRST',
  'AWAITING_SECOND',
  'APPROVED',
  'REJECTED',
  'RECEIVED',
] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export class PurchaseOrderRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PurchaseOrderRuleError';
  }
}

export function releasePurchaseOrder(input: {
  status: PurchaseOrderStatus;
  step: 1 | 2;
  actorUserId: string;
  firstApproverUserId: string | null;
}): 'AWAITING_SECOND' | 'APPROVED' {
  if (input.step === 1) {
    if (input.status !== 'AWAITING_FIRST') {
      throw new PurchaseOrderRuleError(
        'Este pedido nao esta na primeira liberacao.',
      );
    }
    return 'AWAITING_SECOND';
  }
  if (input.status !== 'AWAITING_SECOND') {
    throw new PurchaseOrderRuleError(
      'Este pedido nao esta na segunda liberacao.',
    );
  }
  if (
    !input.firstApproverUserId ||
    input.firstApproverUserId === input.actorUserId
  ) {
    throw new PurchaseOrderRuleError(
      'A segunda liberacao precisa ser de outra pessoa.',
    );
  }
  return 'APPROVED';
}

export function rejectPurchaseOrder(status: PurchaseOrderStatus): 'REJECTED' {
  if (status !== 'AWAITING_FIRST' && status !== 'AWAITING_SECOND') {
    throw new PurchaseOrderRuleError(
      'So da para recusar um pedido que ainda aguarda liberacao.',
    );
  }
  return 'REJECTED';
}

export function receivePurchaseOrder(status: PurchaseOrderStatus): 'RECEIVED' {
  if (status === 'REJECTED') {
    throw new PurchaseOrderRuleError('Pedido recusado nao entra no estoque.');
  }
  if (status === 'RECEIVED') {
    throw new PurchaseOrderRuleError('Este pedido ja entrou no estoque.');
  }
  if (status !== 'APPROVED') {
    throw new PurchaseOrderRuleError(
      'O recebimento so acontece depois das duas liberacoes.',
    );
  }
  return 'RECEIVED';
}
