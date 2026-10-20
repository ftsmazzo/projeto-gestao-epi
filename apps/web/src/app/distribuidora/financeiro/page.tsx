'use client';

import { FormEvent, useEffect, useState } from 'react';
import { fetchMe } from '../../../lib/auth';
import {
  cancelPayable,
  cancelReceivable,
  createLedgerAccount,
  createPayable,
  createReceivable,
  getFinanceSummary,
  isDistributorManager,
  listLedgerAccounts,
  listPayables,
  listReceivables,
  markPayablePaid,
  markReceivableReceived,
  type DistributorFinanceSummary,
  type DistributorLedgerAccount,
  type DistributorPayable,
  type DistributorReceivable,
  type LedgerKind,
  type PayableStatus,
  type ReceivableStatus,
} from '../../../lib/distributor';

type Tab = 'pagar' | 'receber' | 'plano';

const PAYABLE_LABEL: Record<PayableStatus, string> = {
  OPEN: 'Em aberto',
  PAID: 'Paga',
  CANCELLED: 'Cancelada',
};

const RECEIVABLE_LABEL: Record<ReceivableStatus, string> = {
  OPEN: 'Em aberto',
  RECEIVED: 'Recebida',
  CANCELLED: 'Cancelada',
};

const KIND_LABEL: Record<LedgerKind, string> = {
  ASSET: 'Ativo',
  LIABILITY: 'Passivo',
  REVENUE: 'Receita',
  EXPENSE: 'Despesa',
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
  const [tab, setTab] = useState<Tab>('pagar');
  const [payables, setPayables] = useState<DistributorPayable[]>([]);
  const [receivables, setReceivables] = useState<DistributorReceivable[]>([]);
  const [accounts, setAccounts] = useState<DistributorLedgerAccount[]>([]);
  const [summary, setSummary] = useState<DistributorFinanceSummary | null>(null);
  const [manager, setManager] = useState(false);
  const [description, setDescription] = useState('');
  const [party, setParty] = useState('');
  const [amount, setAmount] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [ledgerCode, setLedgerCode] = useState('');
  const [ledgerName, setLedgerName] = useState('');
  const [ledgerKind, setLedgerKind] = useState<LedgerKind>('EXPENSE');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    const [payableRows, receivableRows, ledgerRows, finance] = await Promise.all([
      listPayables(),
      listReceivables(),
      listLedgerAccounts(),
      getFinanceSummary(),
    ]);
    setPayables(payableRows);
    setReceivables(receivableRows);
    setAccounts(ledgerRows);
    setSummary(finance);
  }

  useEffect(() => {
    void Promise.all([
      listPayables(),
      listReceivables(),
      listLedgerAccounts(),
      getFinanceSummary(),
      fetchMe(),
    ])
      .then(([payableRows, receivableRows, ledgerRows, finance, me]) => {
        setPayables(payableRows);
        setReceivables(receivableRows);
        setAccounts(ledgerRows);
        setSummary(finance);
        setManager(isDistributorManager(me.membershipRole));
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
  }, []);

  async function onCreatePayable(event: FormEvent) {
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
        supplierName: party,
        amountCents: cents,
        dueOn: dueOn || null,
      });
      setDescription('');
      setParty('');
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

  async function onCreateReceivable(event: FormEvent) {
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
      await createReceivable({
        description,
        customerName: party,
        amountCents: cents,
        dueOn: dueOn || null,
      });
      setDescription('');
      setParty('');
      setAmount('');
      setDueOn('');
      setNotice('Conta a receber lançada.');
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao lançar.');
    } finally {
      setSaving(false);
    }
  }

  async function onCreateLedger(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await createLedgerAccount({
        code: ledgerCode,
        name: ledgerName,
        kind: ledgerKind,
      });
      setLedgerCode('');
      setLedgerName('');
      setNotice('Conta do plano criada.');
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao criar conta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Financeiro</p>
          <h1 className="page-title">Financeiro</h1>
          <p className="page-lead">
            Contas a pagar, a receber e plano de contas. A confirmação da saída
            gera o receber; a compra gera o pagar.
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

      <section className="dash-kpi-grid" aria-label="Resumo financeiro">
        <article className="dash-kpi">
          <p className="dash-kpi__label">A pagar</p>
          <p className="dash-kpi__value">
            {money(summary?.openPayableCents ?? 0)}
          </p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">A receber</p>
          <p className="dash-kpi__value">
            {money(summary?.openReceivableCents ?? 0)}
          </p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">Recebido</p>
          <p className="dash-kpi__value">{money(summary?.receivedCents ?? 0)}</p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">Resultado</p>
          <p className="dash-kpi__value">{money(summary?.resultCents ?? 0)}</p>
          <p className="dash-kpi__hint">recebido − pago</p>
        </article>
      </section>

      <div className="form-actions" role="tablist" aria-label="Abas do financeiro">
        <button
          type="button"
          className={`btn ${tab === 'pagar' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('pagar')}
        >
          A pagar
        </button>
        <button
          type="button"
          className={`btn ${tab === 'receber' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('receber')}
        >
          A receber
        </button>
        <button
          type="button"
          className={`btn ${tab === 'plano' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('plano')}
        >
          Plano de contas
        </button>
      </div>

      {tab === 'pagar' ? (
        <>
          {manager ? (
            <section className="dash-panel">
              <h2 className="dash-panel__title">Lançamento a pagar</h2>
              <form className="form-grid" onSubmit={onCreatePayable}>
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
                    value={party}
                    onChange={(event) => setParty(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Valor (R$)</span>
                  <input
                    className="input"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
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
            <h2 className="dash-panel__title">Contas a pagar</h2>
            {payables.length === 0 ? (
              <p className="field-hint">Nenhuma conta a pagar.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Fornecedor</th>
                      <th>Conta</th>
                      <th>Valor</th>
                      <th>Vencimento</th>
                      <th>Situação</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {payables.map((row) => (
                      <tr key={row.id}>
                        <td>{row.description}</td>
                        <td>{row.supplierName}</td>
                        <td>
                          {row.accountCode
                            ? `${row.accountCode} ${row.accountName}`
                            : '—'}
                        </td>
                        <td>{money(row.amountCents)}</td>
                        <td>{row.dueOn ?? '—'}</td>
                        <td>{PAYABLE_LABEL[row.status]}</td>
                        <td>
                          {row.status === 'OPEN' && manager ? (
                            <div className="form-actions">
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={saving}
                                onClick={() => {
                                  setSaving(true);
                                  void markPayablePaid(row.id)
                                    .then(async () => {
                                      setNotice('Conta marcada como paga.');
                                      await reload();
                                    })
                                    .catch((err: unknown) =>
                                      setError(
                                        err instanceof Error
                                          ? err.message
                                          : 'Falha ao pagar.',
                                      ),
                                    )
                                    .finally(() => setSaving(false));
                                }}
                              >
                                Pagar
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={saving}
                                onClick={() => {
                                  setSaving(true);
                                  void cancelPayable(row.id)
                                    .then(async () => {
                                      setNotice('Conta cancelada.');
                                      await reload();
                                    })
                                    .catch((err: unknown) =>
                                      setError(
                                        err instanceof Error
                                          ? err.message
                                          : 'Falha ao cancelar.',
                                      ),
                                    )
                                    .finally(() => setSaving(false));
                                }}
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
        </>
      ) : null}

      {tab === 'receber' ? (
        <>
          {manager ? (
            <section className="dash-panel">
              <h2 className="dash-panel__title">Lançamento a receber</h2>
              <form className="form-grid" onSubmit={onCreateReceivable}>
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
                  <span className="field-label">Cliente</span>
                  <input
                    className="input"
                    value={party}
                    onChange={(event) => setParty(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Valor (R$)</span>
                  <input
                    className="input"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
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
            <h2 className="dash-panel__title">Contas a receber</h2>
            {receivables.length === 0 ? (
              <p className="field-hint">
                Nenhuma conta a receber. Confirme uma nota de saída para gerar.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Cliente</th>
                      <th>Conta</th>
                      <th>Valor</th>
                      <th>Vencimento</th>
                      <th>Situação</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {receivables.map((row) => (
                      <tr key={row.id}>
                        <td>{row.description}</td>
                        <td>{row.customerName}</td>
                        <td>
                          {row.accountCode
                            ? `${row.accountCode} ${row.accountName}`
                            : '—'}
                        </td>
                        <td>{money(row.amountCents)}</td>
                        <td>{row.dueOn ?? '—'}</td>
                        <td>{RECEIVABLE_LABEL[row.status]}</td>
                        <td>
                          {row.status === 'OPEN' && manager ? (
                            <div className="form-actions">
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={saving}
                                onClick={() => {
                                  setSaving(true);
                                  void markReceivableReceived(row.id)
                                    .then(async () => {
                                      setNotice('Conta marcada como recebida.');
                                      await reload();
                                    })
                                    .catch((err: unknown) =>
                                      setError(
                                        err instanceof Error
                                          ? err.message
                                          : 'Falha ao receber.',
                                      ),
                                    )
                                    .finally(() => setSaving(false));
                                }}
                              >
                                Receber
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={saving}
                                onClick={() => {
                                  setSaving(true);
                                  void cancelReceivable(row.id)
                                    .then(async () => {
                                      setNotice('Conta cancelada.');
                                      await reload();
                                    })
                                    .catch((err: unknown) =>
                                      setError(
                                        err instanceof Error
                                          ? err.message
                                          : 'Falha ao cancelar.',
                                      ),
                                    )
                                    .finally(() => setSaving(false));
                                }}
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
        </>
      ) : null}

      {tab === 'plano' ? (
        <>
          {manager ? (
            <section className="dash-panel">
              <h2 className="dash-panel__title">Nova conta</h2>
              <form className="form-grid" onSubmit={onCreateLedger}>
                <label className="field">
                  <span className="field-label">Código</span>
                  <input
                    className="input"
                    value={ledgerCode}
                    onChange={(event) => setLedgerCode(event.target.value)}
                    placeholder="4.2.02"
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Nome</span>
                  <input
                    className="input"
                    value={ledgerName}
                    onChange={(event) => setLedgerName(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Tipo</span>
                  <select
                    className="input"
                    value={ledgerKind}
                    onChange={(event) =>
                      setLedgerKind(event.target.value as LedgerKind)
                    }
                  >
                    {(Object.keys(KIND_LABEL) as LedgerKind[]).map((kind) => (
                      <option key={kind} value={kind}>
                        {KIND_LABEL[kind]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    Criar
                  </button>
                </div>
              </form>
            </section>
          ) : null}
          <section className="dash-panel">
            <h2 className="dash-panel__title">Plano de contas</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td>{account.code}</td>
                      <td>{account.name}</td>
                      <td>{KIND_LABEL[account.kind]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
