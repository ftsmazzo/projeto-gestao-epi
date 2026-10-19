'use client';

import { FormEvent, useEffect, useState } from 'react';
import { fetchMe } from '../../../lib/auth';
import {
  authorizeOutboundInvoice,
  cancelOutboundInvoice,
  confirmOutboundInvoice,
  createOutboundFromQuote,
  isDistributorManager,
  listOutboundInvoices,
  listQuotes,
  type DistributorQuote,
  type OutboundInvoice,
  type OutboundStatus,
} from '../../../lib/distributor';

const STATUS_LABEL: Record<OutboundStatus, string> = {
  DRAFT: 'Rascunho',
  CONFIRMED: 'Confirmada (estoque)',
  CANCELLED: 'Cancelada',
  AUTHORIZED: 'Autorizada',
};

const UF_OPTIONS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

function money(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function DistribuidoraNotasPage() {
  const [quotes, setQuotes] = useState<DistributorQuote[]>([]);
  const [invoices, setInvoices] = useState<OutboundInvoice[]>([]);
  const [manager, setManager] = useState(false);
  const [quoteId, setQuoteId] = useState('');
  const [customerCnpj, setCustomerCnpj] = useState('');
  const [customerUf, setCustomerUf] = useState('ES');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const usedQuoteIds = new Set(
    invoices
      .filter((invoice) => invoice.status !== 'CANCELLED' && invoice.quoteId)
      .map((invoice) => invoice.quoteId as string),
  );
  const approvedQuotes = quotes.filter(
    (quote) => quote.status === 'APPROVED' && !usedQuoteIds.has(quote.id),
  );

  async function reload() {
    const [quoteRows, invoiceRows] = await Promise.all([
      listQuotes(),
      listOutboundInvoices(),
    ]);
    setQuotes(quoteRows);
    setInvoices(invoiceRows);
  }

  useEffect(() => {
    void Promise.all([listQuotes(), listOutboundInvoices(), fetchMe()])
      .then(([quoteRows, invoiceRows, me]) => {
        setQuotes(quoteRows);
        setInvoices(invoiceRows);
        setManager(isDistributorManager(me.membershipRole));
        const first = quoteRows.find((quote) => quote.status === 'APPROVED');
        if (first) setQuoteId(first.id);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!quoteId) {
      setError('Escolha um orçamento aprovado.');
      return;
    }
    setSaving(true);
    try {
      await createOutboundFromQuote({
        quoteId,
        customerCnpj,
        customerUf,
      });
      setCustomerCnpj('');
      setNotice('Rascunho da nota de saída montado. O estoque não mudou.');
      const [quoteRows, invoiceRows] = await Promise.all([
        listQuotes(),
        listOutboundInvoices(),
      ]);
      setQuotes(quoteRows);
      setInvoices(invoiceRows);
      const taken = new Set(
        invoiceRows
          .filter((invoice) => invoice.status !== 'CANCELLED' && invoice.quoteId)
          .map((invoice) => invoice.quoteId as string),
      );
      setQuoteId(
        quoteRows.find(
          (quote) => quote.status === 'APPROVED' && !taken.has(quote.id),
        )?.id ?? '',
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao montar a nota.');
    } finally {
      setSaving(false);
    }
  }

  async function onConfirm(invoiceId: string) {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await confirmOutboundInvoice(invoiceId);
      setNotice('Saída confirmada. O estoque já baixou.');
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao confirmar.');
    } finally {
      setSaving(false);
    }
  }

  async function onAuthorize(invoiceId: string) {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await authorizeOutboundInvoice(invoiceId);
      setNotice('Nota autorizada na SEFAZ.');
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha na autorização.');
    } finally {
      setSaving(false);
    }
  }

  async function onCancel(invoiceId: string) {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await cancelOutboundInvoice(invoiceId);
      setNotice('Rascunho cancelado.');
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao cancelar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Comercial</p>
          <h1 className="page-title">Notas de saída</h1>
          <p className="page-lead">
            Monta o rascunho, confirma a baixa no estoque e deixa a autorização
            na SEFAZ para a homologação.
          </p>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="field-hint" role="status">
          {notice}
        </p>
      ) : null}

      <section className="dash-panel">
        <h2 className="dash-panel__title">Nova nota</h2>
        <form className="form-grid" onSubmit={onCreate}>
          <label className="field">
            <span className="field-label">Orçamento aprovado</span>
            <select
              className="input"
              value={quoteId}
              onChange={(event) => setQuoteId(event.target.value)}
              required
            >
              <option value="">Selecione</option>
              {approvedQuotes.map((quote) => (
                <option key={quote.id} value={quote.id}>
                  {quote.customerName} · {quote.lines.length} itens
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">CNPJ do destinatário</span>
            <input
              className="input"
              value={customerCnpj}
              onChange={(event) => setCustomerCnpj(event.target.value)}
              placeholder="00.000.000/0000-00"
              required
            />
          </label>
          <label className="field">
            <span className="field-label">UF do destinatário</span>
            <select
              className="input"
              value={customerUf}
              onChange={(event) => setCustomerUf(event.target.value)}
              required
            >
              {UF_OPTIONS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              Montar rascunho
            </button>
          </div>
        </form>
        {approvedQuotes.length === 0 ? (
          <p className="field-hint">
            Não há orçamento aprovado livre. Libere um em Orçamentos ou cancele um
            rascunho antigo.
          </p>
        ) : null}
      </section>

      <section className="dash-panel">
        <h2 className="dash-panel__title">Emitidas e rascunhos</h2>
        {invoices.length === 0 ? (
          <p className="field-hint">Nenhuma nota de saída ainda.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Destino</th>
                  <th>Total</th>
                  <th>Situação</th>
                  <th>Pendências</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      {invoice.series}/{invoice.number}
                    </td>
                    <td>{invoice.customerName}</td>
                    <td>
                      {invoice.customerUf} · {invoice.customerCnpj}
                    </td>
                    <td>{money(invoice.totalCents)}</td>
                    <td>{STATUS_LABEL[invoice.status]}</td>
                    <td>
                      {invoice.status === 'DRAFT' || invoice.status === 'CONFIRMED'
                        ? invoice.blockers.length > 0
                          ? invoice.blockers.join(', ')
                          : invoice.status === 'DRAFT'
                            ? 'Confirme a saída para baixar estoque'
                            : invoice.emissionEnabled
                              ? 'Pronta para SEFAZ'
                              : 'Aguardando homologação SEFAZ'
                        : '—'}
                    </td>
                    <td>
                      <div className="form-actions">
                        {invoice.status === 'DRAFT' ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={saving}
                            onClick={() => void onConfirm(invoice.id)}
                          >
                            Confirmar saída
                          </button>
                        ) : null}
                        {invoice.status === 'DRAFT' && manager ? (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={saving}
                            onClick={() => void onCancel(invoice.id)}
                          >
                            Cancelar
                          </button>
                        ) : null}
                        {invoice.status === 'CONFIRMED' && manager ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={saving}
                            onClick={() => void onAuthorize(invoice.id)}
                          >
                            Autorizar SEFAZ
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {invoices.some(
          (invoice) => invoice.status === 'DRAFT' || invoice.status === 'CONFIRMED',
        ) ? (
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nota</th>
                  <th>Item</th>
                  <th>NCM</th>
                  <th>CFOP</th>
                  <th>Qtd</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoices
                  .filter(
                    (invoice) =>
                      invoice.status === 'DRAFT' || invoice.status === 'CONFIRMED',
                  )
                  .flatMap((invoice) =>
                    invoice.lines.map((line) => (
                      <tr key={line.id}>
                        <td>
                          {invoice.series}/{invoice.number}
                        </td>
                        <td>{line.description}</td>
                        <td>{line.ncm}</td>
                        <td>{line.cfop}</td>
                        <td>{line.quantity}</td>
                        <td>{money(line.totalCents)}</td>
                      </tr>
                    )),
                  )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
