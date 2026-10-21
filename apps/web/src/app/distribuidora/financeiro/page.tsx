'use client';

import { FormEvent, useEffect, useState } from 'react';
import { fetchMe } from '../../../lib/auth';
import {
  cancelPayable,
  cancelReceivable,
  createBankAccount,
  createCashMovement,
  createLedgerAccount,
  createPayable,
  createReceivable,
  getCashFlow,
  getFinanceSummary,
  isDistributorManager,
  listBankAccounts,
  listCashMovements,
  listLedgerAccounts,
  listPayables,
  listReceivables,
  markPayablePaid,
  markReceivableReceived,
  reconcileCashMovement,
  unreconcileCashMovement,
  type CashDirection,
  type CashFlowReport,
  type DistributorBankAccount,
  type DistributorCashMovement,
  type DistributorFinanceSummary,
  type DistributorLedgerAccount,
  type DistributorPayable,
  type DistributorReceivable,
  type LedgerKind,
  type PayableStatus,
  type ReceivableStatus,
} from '../../../lib/distributor';

function monthRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

type Tab = 'pagar' | 'receber' | 'caixa' | 'plano';

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

const SOURCE_LABEL = {
  OPENING: 'Saldo inicial',
  MANUAL: 'Manual',
  PAYABLE: 'Pagamento',
  RECEIVABLE: 'Recebimento',
} as const;

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
  const [banks, setBanks] = useState<DistributorBankAccount[]>([]);
  const [movements, setMovements] = useState<DistributorCashMovement[]>([]);
  const [summary, setSummary] = useState<DistributorFinanceSummary | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowReport | null>(null);
  const [manager, setManager] = useState(false);
  const [bankAccountId, setBankAccountId] = useState('');
  const [unreconciledOnly, setUnreconciledOnly] = useState(false);
  const initialRange = monthRange();
  const [flowFrom, setFlowFrom] = useState(initialRange.from);
  const [flowTo, setFlowTo] = useState(initialRange.to);
  const [description, setDescription] = useState('');
  const [party, setParty] = useState('');
  const [amount, setAmount] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [bankName, setBankName] = useState('');
  const [opening, setOpening] = useState('');
  const [cashDirection, setCashDirection] = useState<CashDirection>('IN');
  const [cashNote, setCashNote] = useState('');
  const [ledgerCode, setLedgerCode] = useState('');
  const [ledgerName, setLedgerName] = useState('');
  const [ledgerKind, setLedgerKind] = useState<LedgerKind>('EXPENSE');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    const range = { from: flowFrom, to: flowTo };
    const [payableRows, receivableRows, ledgerRows, bankRows, cashRows, finance, flow] =
      await Promise.all([
        listPayables(),
        listReceivables(),
        listLedgerAccounts(),
        listBankAccounts(),
        listCashMovements({ unreconciledOnly }),
        getFinanceSummary(),
        getCashFlow(range),
      ]);
    setPayables(payableRows);
    setReceivables(receivableRows);
    setAccounts(ledgerRows);
    setBanks(bankRows);
    setMovements(cashRows);
    setSummary(finance);
    setCashFlow(flow);
    if (!bankAccountId && bankRows[0]) setBankAccountId(bankRows[0].id);
  }

  useEffect(() => {
    const range = monthRange();
    void Promise.all([
      listPayables(),
      listReceivables(),
      listLedgerAccounts(),
      listBankAccounts(),
      listCashMovements(),
      getFinanceSummary(),
      getCashFlow(range),
      fetchMe(),
    ])
      .then(([payableRows, receivableRows, ledgerRows, bankRows, cashRows, finance, flow, me]) => {
        setPayables(payableRows);
        setReceivables(receivableRows);
        setAccounts(ledgerRows);
        setBanks(bankRows);
        setMovements(cashRows);
        setSummary(finance);
        setCashFlow(flow);
        setManager(isDistributorManager(me.membershipRole));
        if (bankRows[0]) setBankAccountId(bankRows[0].id);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
  }, []);

  function requireBank(): string | null {
    if (!bankAccountId) {
      setError('Cadastre e escolha uma conta de caixa/banco antes de baixar.');
      return null;
    }
    return bankAccountId;
  }

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

  async function onCreateBank(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const openingCents = opening ? reaisToCents(opening) : 0;
    if (openingCents == null) {
      setError('Saldo inicial inválido.');
      return;
    }
    setSaving(true);
    try {
      await createBankAccount({
        name: bankName,
        openingBalanceCents: openingCents,
      });
      setBankName('');
      setOpening('');
      setNotice('Conta de caixa/banco criada.');
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao criar conta.');
    } finally {
      setSaving(false);
    }
  }

  async function onCreateCash(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const bankId = requireBank();
    const cents = reaisToCents(amount);
    if (!bankId || cents == null || cents < 1) {
      setError('Informe conta e valor positivo.');
      return;
    }
    setSaving(true);
    try {
      await createCashMovement({
        bankAccountId: bankId,
        direction: cashDirection,
        amountCents: cents,
        note: cashNote || null,
      });
      setAmount('');
      setCashNote('');
      setNotice('Movimento de caixa lançado.');
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha no movimento.');
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
            Pagar, receber, caixa/bancos e plano de contas. A baixa exige conta
            bancária e atualiza o saldo.
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
          <p className="dash-kpi__label">Caixa</p>
          <p className="dash-kpi__value">
            {money(summary?.cashBalanceCents ?? 0)}
          </p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">Resultado</p>
          <p className="dash-kpi__value">{money(summary?.resultCents ?? 0)}</p>
          <p className="dash-kpi__hint">recebido − pago</p>
        </article>
      </section>

      <div className="form-actions" role="tablist" aria-label="Abas do financeiro">
        {(
          [
            ['pagar', 'A pagar'],
            ['receber', 'A receber'],
            ['caixa', 'Caixa'],
            ['plano', 'Plano de contas'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn ${tab === id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {(tab === 'pagar' || tab === 'receber') && banks.length > 0 ? (
        <label className="field" style={{ maxWidth: '20rem' }}>
          <span className="field-label">Conta para baixas</span>
          <select
            className="input"
            value={bankAccountId}
            onChange={(event) => setBankAccountId(event.target.value)}
          >
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name} · {money(bank.balanceCents)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

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
                                  const bankId = requireBank();
                                  if (!bankId) return;
                                  setSaving(true);
                                  void markPayablePaid(row.id, bankId)
                                    .then(async () => {
                                      setNotice('Conta paga e baixa no caixa.');
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
                                  const bankId = requireBank();
                                  if (!bankId) return;
                                  setSaving(true);
                                  void markReceivableReceived(row.id, bankId)
                                    .then(async () => {
                                      setNotice('Recebido e creditado no caixa.');
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

      {tab === 'caixa' ? (
        <>
          {manager ? (
            <section className="dash-panel">
              <h2 className="dash-panel__title">Nova conta de caixa/banco</h2>
              <form className="form-grid" onSubmit={onCreateBank}>
                <label className="field">
                  <span className="field-label">Nome</span>
                  <input
                    className="input"
                    value={bankName}
                    onChange={(event) => setBankName(event.target.value)}
                    placeholder="Caixa geral"
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Saldo inicial (R$)</span>
                  <input
                    className="input"
                    value={opening}
                    onChange={(event) => setOpening(event.target.value)}
                    placeholder="0,00"
                  />
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
            <h2 className="dash-panel__title">Saldos</h2>
            {banks.length === 0 ? (
              <p className="field-hint">Nenhuma conta bancária ainda.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Conta</th>
                      <th>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {banks.map((bank) => (
                      <tr key={bank.id}>
                        <td>{bank.name}</td>
                        <td>{money(bank.balanceCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {manager && banks.length > 0 ? (
            <section className="dash-panel">
              <h2 className="dash-panel__title">Movimento manual</h2>
              <form className="form-grid" onSubmit={onCreateCash}>
                <label className="field">
                  <span className="field-label">Conta</span>
                  <select
                    className="input"
                    value={bankAccountId}
                    onChange={(event) => setBankAccountId(event.target.value)}
                  >
                    {banks.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Tipo</span>
                  <select
                    className="input"
                    value={cashDirection}
                    onChange={(event) =>
                      setCashDirection(event.target.value as CashDirection)
                    }
                  >
                    <option value="IN">Entrada</option>
                    <option value="OUT">Saída</option>
                  </select>
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
                  <span className="field-label">Observação</span>
                  <input
                    className="input"
                    value={cashNote}
                    onChange={(event) => setCashNote(event.target.value)}
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
            <h2 className="dash-panel__title">Fluxo de caixa</h2>
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                setError(null);
                setSaving(true);
                void getCashFlow({ from: flowFrom, to: flowTo })
                  .then((flow) => {
                    setCashFlow(flow);
                    setNotice('Fluxo atualizado.');
                  })
                  .catch((err: unknown) =>
                    setError(
                      err instanceof Error ? err.message : 'Falha no fluxo.',
                    ),
                  )
                  .finally(() => setSaving(false));
              }}
            >
              <label className="field">
                <span className="field-label">De</span>
                <input
                  className="input"
                  type="date"
                  value={flowFrom}
                  onChange={(event) => setFlowFrom(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Até</span>
                <input
                  className="input"
                  type="date"
                  value={flowTo}
                  onChange={(event) => setFlowTo(event.target.value)}
                  required
                />
              </label>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  Calcular
                </button>
              </div>
            </form>
            {cashFlow ? (
              <div className="dash-kpi-grid" aria-label="Totais do período">
                <article className="dash-kpi">
                  <p className="dash-kpi__label">Entradas</p>
                  <p className="dash-kpi__value">{money(cashFlow.inflowCents)}</p>
                </article>
                <article className="dash-kpi">
                  <p className="dash-kpi__label">Saídas</p>
                  <p className="dash-kpi__value">{money(cashFlow.outflowCents)}</p>
                </article>
                <article className="dash-kpi">
                  <p className="dash-kpi__label">Líquido</p>
                  <p className="dash-kpi__value">{money(cashFlow.netCents)}</p>
                </article>
                <article className="dash-kpi">
                  <p className="dash-kpi__label">Sem conciliar</p>
                  <p className="dash-kpi__value">{cashFlow.unreconciledCount}</p>
                  <p className="dash-kpi__hint">
                    {money(cashFlow.unreconciledNetCents)} líquido
                  </p>
                </article>
              </div>
            ) : null}
          </section>

          <section className="dash-panel">
            <h2 className="dash-panel__title">Extrato</h2>
            <p className="field-hint">
              Saldo do caixa: {money(summary?.cashBalanceCents ?? 0)}. A coluna
              Saldo acompanha os lançamentos, inclusive os manuais, e a linha mais
              recente fecha com o cartão Caixa.
            </p>
            <label className="field">
              <span className="field-label">
                <input
                  type="checkbox"
                  checked={unreconciledOnly}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setUnreconciledOnly(next);
                    setSaving(true);
                    void listCashMovements({ unreconciledOnly: next })
                      .then(setMovements)
                      .catch((err: unknown) =>
                        setError(
                          err instanceof Error ? err.message : 'Falha ao filtrar.',
                        ),
                      )
                      .finally(() => setSaving(false));
                  }}
                />{' '}
                Só pendentes de conciliação
              </span>
            </label>
            {movements.length === 0 ? (
              <p className="field-hint">Nenhum movimento ainda.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Conta</th>
                      <th>Origem</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Saldo</th>
                      <th>Nota</th>
                      <th>Conciliação</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((row) => (
                      <tr key={row.id}>
                        <td>{new Date(row.createdAt).toLocaleString('pt-BR')}</td>
                        <td>{row.bankAccountName ?? '—'}</td>
                        <td>{SOURCE_LABEL[row.source]}</td>
                        <td>{row.direction === 'IN' ? 'Entrada' : 'Saída'}</td>
                        <td>{money(row.amountCents)}</td>
                        <td>
                          {row.balanceAfterCents == null
                            ? '—'
                            : money(row.balanceAfterCents)}
                        </td>
                        <td>{row.note ?? '—'}</td>
                        <td>{row.reconciled ? 'Conciliado' : 'Pendente'}</td>
                        <td>
                          {manager ? (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              disabled={saving}
                              onClick={() => {
                                setSaving(true);
                                const action = row.reconciled
                                  ? unreconcileCashMovement
                                  : reconcileCashMovement;
                                void action(row.id)
                                  .then(async () => {
                                    setNotice(
                                      row.reconciled
                                        ? 'Conciliação desfeita.'
                                        : 'Movimento conciliado.',
                                    );
                                    await reload();
                                  })
                                  .catch((err: unknown) =>
                                    setError(
                                      err instanceof Error
                                        ? err.message
                                        : 'Falha na conciliação.',
                                    ),
                                  )
                                  .finally(() => setSaving(false));
                              }}
                            >
                              {row.reconciled ? 'Desfazer' : 'Conciliar'}
                            </button>
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
