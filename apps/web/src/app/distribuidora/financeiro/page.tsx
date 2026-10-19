'use client';

import { FormEvent, useEffect, useState } from 'react';
import { fetchMe } from '../../../lib/auth';
import {
  cancelPayable,
  createPayable,
  isDistributorManager,
  listPayables,
  markPayablePaid,
  type DistributorPayable,
  type PayableStatus,
} from '../../../lib/distributor';

const STATUS_LABEL: Record<PayableStatus, string> = {
  OPEN: 'Em aberto',
  PAID: 'Paga',
  CANCELLED: 'Cancelada',
};

function money(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function reaisToCents(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export default function DistribuidoraFinanceiroPage() {
  const [rows, setRows] = useState<DistributorPayable[]>([]);
  const [manager, setManager] = useState(false);
  const [description, setDescription] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    setRows(await listPayables());
  }

  useEffect(() => {
    void Promise.all([listPayables(), fetchMe()])
      .then(([payableRows, me]) => {
        setRows(payableRows);
        setManager(isDistributorManager(me.membershipRole));
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const cents = reaisToCents(amount);
    if (cents == null) {
      setError('Informe um valor válido.');
      return;
    }
    setSaving(true);
    try {
      await createPayable({
        description,
        supplierName,
        amountCents: cents,
        dueOn: dueOn || null,
      });
      setDescription('');
      setSupplierName('');
      setAmount('');
      setDueOn('');
      setNotice('Conta a pagar lançada.');
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao lançar.');
    } finally {
      setSaving(false);
    }
  }

  async function onPay(payableId: string) {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await markPayablePaid(payableId);
      setNotice('Conta marcada como paga.');
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao pagar.');
    } finally {
      setSaving(false);
    }
  }

  async function onCancel(payableId: string) {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await cancelPayable(payableId);
      setNotice('Conta cancelada.');
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao cancelar.');
    } finally {
      setSaving(false);
    }
  }

  const openTotal = rows
    .filter((row) => row.status === 'OPEN')
    .reduce((sum, row) => sum + row.amountCents, 0);

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Financeiro</p>
          <h1 className="page-title">Contas a pagar</h1>
          <p className="page-lead">
            Compra recebida e nota de entrada confirmada geram conta em aberto.
            Também dá para lançar manualmente.
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

      <section className="dash-kpi-grid" aria-label="Resumo a pagar">
        <article className="dash-kpi">
          <p className="dash-kpi__label">Em aberto</p>
          <p className="dash-kpi__value">{money(openTotal)}</p>
          <p className="dash-kpi__hint">
            {rows.filter((row) => row.status === 'OPEN').length} contas
          </p>
        </article>
      </section>

      {manager ? (
        <section className="dash-panel">
          <h2 className="dash-panel__title">Lançamento manual</h2>
          <form className="form-grid" onSubmit={onCreate}>
            <label className="field">
              <span className="field-label">Descrição</span>
              <input
                className="input"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Fornecedor</span>
              <input
                className="input"
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Valor (R$)</span>
              <input
                className="input"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0,00"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Vencimento</span>
              <input
                className="input"
                type="date"
                value={dueOn}
                onChange={(event) => setDueOn(event.target.value)}
              />
            </label>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                Lançar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="dash-panel">
        <h2 className="dash-panel__title">Contas</h2>
        {rows.length === 0 ? (
          <p className="field-hint">
            Nenhuma conta ainda. Receba uma compra ou confirme uma nota de entrada.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Fornecedor</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Origem</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.description}</td>
                    <td>{row.supplierName}</td>
                    <td>{money(row.amountCents)}</td>
                    <td>{row.dueOn ?? '—'}</td>
                    <td>
                      {row.purchaseOrderId
                        ? 'Pedido de compra'
                        : row.inboundDocumentId
                          ? 'Nota de entrada'
                          : 'Manual'}
                    </td>
                    <td>{STATUS_LABEL[row.status]}</td>
                    <td>
                      {row.status === 'OPEN' && manager ? (
                        <div className="form-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={saving}
                            onClick={() => void onPay(row.id)}
                          >
                            Pagar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={saving}
                            onClick={() => void onCancel(row.id)}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
