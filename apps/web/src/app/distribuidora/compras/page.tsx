'use client';

import { FormEvent, useEffect, useState } from 'react';
import { fetchMe } from '../../../lib/auth';
import {
  createPurchaseOrder,
  listDistributorProducts,
  listPurchaseOrders,
  receivePurchaseOrder,
  rejectPurchaseOrder,
  releasePurchaseOrder,
  type DistributorProduct,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from '../../../lib/distributor';

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  AWAITING_FIRST: 'Aguardando 1ª liberação',
  AWAITING_SECOND: 'Aguardando 2ª liberação',
  APPROVED: 'Liberado para receber',
  REJECTED: 'Recusado',
  RECEIVED: 'Recebido no estoque',
};

type DraftLine = {
  variantId: string;
  quantity: string;
};

export default function DistribuidoraComprasPage() {
  const [products, setProducts] = useState<DistributorProduct[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [userId, setUserId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const options = products.flatMap((product) =>
    product.variants.map((variant) => ({
      id: variant.id,
      label: `${product.name} · ${variant.label}`,
    })),
  );

  async function reload() {
    const rows = await listPurchaseOrders();
    setOrders(rows);
  }

  useEffect(() => {
    void Promise.all([listDistributorProducts(), listPurchaseOrders(), fetchMe()])
      .then(([productRows, orderRows, me]) => {
        setProducts(productRows);
        setOrders(orderRows);
        setUserId(me.id);
        const first = productRows[0]?.variants[0]?.id;
        if (first) setVariantId(first);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
  }, []);

  function addLine() {
    setError(null);
    const amount = Number(quantity);
    if (!variantId || !Number.isInteger(amount) || amount < 1) {
      setError('Escolha a variante e uma quantidade inteira.');
      return;
    }
    setDraftLines((current) => {
      const existing = current.find((line) => line.variantId === variantId);
      if (!existing) return [...current, { variantId, quantity: String(amount) }];
      return current.map((line) =>
        line.variantId === variantId
          ? { ...line, quantity: String(Number(line.quantity) + amount) }
          : line,
      );
    });
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (draftLines.length === 0) {
      setError('Inclua ao menos um item no pedido.');
      return;
    }
    setSaving(true);
    try {
      await createPurchaseOrder({
        supplierName,
        lines: draftLines.map((line) => ({
          variantId: line.variantId,
          quantity: Number(line.quantity),
        })),
      });
      setSupplierName('');
      setDraftLines([]);
      setNotice('Pedido aberto. O estoque ainda nao mudou.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir o pedido.');
    } finally {
      setSaving(false);
    }
  }

  async function act(
    orderId: string,
    action: 'first' | 'second' | 'reject' | 'receive',
  ) {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      if (action === 'first') await releasePurchaseOrder(orderId, 1);
      if (action === 'second') await releasePurchaseOrder(orderId, 2);
      if (action === 'reject') await rejectPurchaseOrder(orderId);
      if (action === 'receive') await receivePurchaseOrder(orderId);
      setNotice(
        action === 'receive'
          ? 'Mercadoria recebida. O saldo foi atualizado uma vez.'
          : action === 'reject'
            ? 'Pedido recusado. O saldo nao mudou.'
            : 'Liberacao registrada.',
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar o pedido.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Distribuidora</p>
          <h1 className="page-title">Compras</h1>
          <p className="page-lead">
            O pedido so entra no deposito depois de duas liberacoes, feitas por
            pessoas diferentes, e do recebimento da mercadoria.
          </p>
        </div>
      </header>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="field-hint">{notice}</p> : null}
      <form className="form dash-panel" onSubmit={onCreate}>
        <h2 className="dash-panel__title">Novo pedido</h2>
        <div className="field">
          <label htmlFor="fornecedor">Fornecedor</label>
          <input
            id="fornecedor"
            value={supplierName}
            onChange={(event) => setSupplierName(event.target.value)}
            required
            minLength={2}
          />
        </div>
        <div className="field">
          <label htmlFor="item">Item</label>
          <select
            id="item"
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="qtd-pedido">Quantidade</label>
          <input
            id="qtd-pedido"
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>
        <button className="btn" type="button" onClick={addLine}>
          Incluir item
        </button>
        {draftLines.length > 0 ? (
          <ul>
            {draftLines.map((line) => (
              <li key={line.variantId}>
                {options.find((option) => option.id === line.variantId)?.label}{' '}
                · {line.quantity}
              </li>
            ))}
          </ul>
        ) : null}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          Abrir pedido
        </button>
      </form>
      <section className="dash-panel">
        <h2 className="dash-panel__title">Pedidos</h2>
        {orders.length === 0 ? (
          <p className="field-hint">Nenhum pedido aberto.</p>
        ) : (
          orders.map((order) => (
            <article key={order.id} className="dash-panel">
              <h3 className="dash-panel__title">{order.supplierName}</h3>
              <p className="field-hint">{STATUS_LABEL[order.status]}</p>
              <ul>
                {order.lines.map((line) => (
                  <li key={line.id}>
                    {line.productName} · {line.label} · {line.quantity}
                  </li>
                ))}
              </ul>
              {order.rejectionNote ? (
                <p className="field-hint">{order.rejectionNote}</p>
              ) : null}
              <div className="form-actions">
                {order.status === 'AWAITING_FIRST' ? (
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={saving}
                    onClick={() => void act(order.id, 'first')}
                  >
                    Primeira liberacao
                  </button>
                ) : null}
                {order.status === 'AWAITING_SECOND' ? (
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={saving || order.firstApprovedByUserId === userId}
                    onClick={() => void act(order.id, 'second')}
                  >
                    Segunda liberacao
                  </button>
                ) : null}
                {order.status === 'AWAITING_FIRST' ||
                order.status === 'AWAITING_SECOND' ? (
                  <button
                    className="btn"
                    type="button"
                    disabled={saving}
                    onClick={() => void act(order.id, 'reject')}
                  >
                    Recusar
                  </button>
                ) : null}
                {order.status === 'APPROVED' ? (
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={saving}
                    onClick={() => void act(order.id, 'receive')}
                  >
                    Receber mercadoria
                  </button>
                ) : null}
              </div>
              {order.status === 'AWAITING_SECOND' &&
              order.firstApprovedByUserId === userId ? (
                <p className="field-hint">
                  A segunda liberacao precisa ser de outra pessoa.
                </p>
              ) : null}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
