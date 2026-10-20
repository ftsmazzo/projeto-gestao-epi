'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getFinanceSummary,
  listDistributorLowStock,
  listDistributorProducts,
  listOutboundInvoices,
  listPurchaseOrders,
  listQuotes,
  type DistributorBalanceRow,
  type DistributorFinanceSummary,
  type DistributorProduct,
  type OutboundInvoice,
  type PurchaseOrder,
  type DistributorQuote,
} from '../../lib/distributor';

function sizeName(label: string) {
  return label.trim() || 'Único';
}

export default function DistribuidoraHomePage() {
  const [products, setProducts] = useState<DistributorProduct[]>([]);
  const [low, setLow] = useState<DistributorBalanceRow[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [quotes, setQuotes] = useState<DistributorQuote[]>([]);
  const [outbounds, setOutbounds] = useState<OutboundInvoice[]>([]);
  const [finance, setFinance] = useState<DistributorFinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      listDistributorProducts(),
      listDistributorLowStock(),
      listPurchaseOrders(),
      listQuotes(),
      listOutboundInvoices(),
      getFinanceSummary(),
    ])
      .then(([productRows, lowRows, orderRows, quoteRows, outboundRows, financeRow]) => {
        setProducts(productRows);
        setLow(lowRows);
        setOrders(orderRows);
        setQuotes(quoteRows);
        setOutbounds(outboundRows);
        setFinance(financeRow);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
  }, []);

  const units = products.reduce(
    (sum, product) =>
      sum + product.variants.reduce((inner, variant) => inner + variant.quantity, 0),
    0,
  );
  const openOrders = orders.filter(
    (order) => order.status !== 'RECEIVED' && order.status !== 'REJECTED',
  );
  const waitingQuotes = quotes.filter((quote) => quote.status === 'PENDING_APPROVAL');
  const draftNotes = outbounds.filter((invoice) => invoice.status === 'DRAFT');
  const openPayableCents = finance?.openPayableCents ?? 0;
  const openReceivableCents = finance?.openReceivableCents ?? 0;

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Distribuidora</p>
          <h1 className="page-title">Painel</h1>
          <p className="page-lead">
            Estoque, compras, orçamentos e rascunhos de nota de saída.
          </p>
        </div>
      </header>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="dash-kpi-grid" aria-label="Resumo da operação">
        <article className="dash-kpi">
          <p className="dash-kpi__label">Produtos</p>
          <p className="dash-kpi__value">{products.length}</p>
          <p className="dash-kpi__hint">cadastro do depósito</p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">Peças em estoque</p>
          <p className="dash-kpi__value">{units}</p>
          <p className="dash-kpi__hint">soma de todos os tamanhos</p>
        </article>
        <article className={`dash-kpi ${low.length > 0 ? 'dash-kpi--warn' : 'dash-kpi--ok'}`}>
          <p className="dash-kpi__label">Abaixo do mínimo</p>
          <p className="dash-kpi__value">{low.length}</p>
          <p className="dash-kpi__hint">tamanhos para repor</p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">Compras abertas</p>
          <p className="dash-kpi__value">{openOrders.length}</p>
          <p className="dash-kpi__hint">{waitingQuotes.length} orçamentos na fila</p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">Notas em rascunho</p>
          <p className="dash-kpi__value">{draftNotes.length}</p>
          <p className="dash-kpi__hint">
            <Link href="/distribuidora/notas">abrir notas</Link>
          </p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">A pagar</p>
          <p className="dash-kpi__value">
            {(openPayableCents / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </p>
          <p className="dash-kpi__hint">
            <Link href="/distribuidora/financeiro">financeiro</Link>
          </p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">A receber</p>
          <p className="dash-kpi__value">
            {(openReceivableCents / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </p>
          <p className="dash-kpi__hint">
            <Link href="/distribuidora/financeiro">aberto</Link>
          </p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">Caixa</p>
          <p className="dash-kpi__value">
            {((finance?.cashBalanceCents ?? 0) / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </p>
          <p className="dash-kpi__hint">
            <Link href="/distribuidora/financeiro">bancos</Link>
          </p>
        </article>
      </section>
      <section className="dash-panel">
        <h2 className="dash-panel__title">Repor agora</h2>
        {low.length === 0 ? (
          <p className="field-hint">Nenhum tamanho está no mínimo ou abaixo dele.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Produto</th>
                  <th scope="col">Tamanho</th>
                  <th scope="col">Saldo</th>
                  <th scope="col">Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {low.map((row) => (
                  <tr key={row.variantId}>
                    <td>{row.productName}</td>
                    <td>{sizeName(row.label)}</td>
                    <td>{row.quantity}</td>
                    <td>{row.minQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="field-hint">
          <Link href="/distribuidora/produtos">Abrir cadastro</Link>
          {' · '}
          <Link href="/distribuidora/compras">Abrir compras</Link>
          {' · '}
          <Link href="/distribuidora/orcamentos">Abrir orçamentos</Link>
        </p>
      </section>
    </div>
  );
}
