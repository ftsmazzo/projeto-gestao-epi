'use client';

import { FormEvent, useEffect, useState } from 'react';
import { fetchMe } from '../../../lib/auth';
import {
  createCustomer,
  createVisit,
  getCustomerHistory,
  isDistributorManager,
  listCustomers,
  listSellers,
  listVisits,
  type DistributorCustomer,
  type DistributorCustomerHistory,
  type DistributorVisit,
  type SellerCeiling,
} from '../../../lib/distributor';

export default function DistribuidoraAgendaPage() {
  const [customers, setCustomers] = useState<DistributorCustomer[]>([]);
  const [visits, setVisits] = useState<DistributorVisit[]>([]);
  const [sellers, setSellers] = useState<SellerCeiling[]>([]);
  const [history, setHistory] = useState<DistributorCustomerHistory | null>(null);
  const [manager, setManager] = useState(false);
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerCnpj, setCustomerCnpj] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [visitedAt, setVisitedAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [summary, setSummary] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [sellerUserId, setSellerUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload(q?: string) {
    const [customerRows, visitRows] = await Promise.all([
      listCustomers(q),
      listVisits(),
    ]);
    setCustomers(customerRows);
    setVisits(visitRows);
  }

  useEffect(() => {
    void Promise.all([listCustomers(), listVisits(), listSellers(), fetchMe()])
      .then(([customerRows, visitRows, sellerRows, me]) => {
        setCustomers(customerRows);
        setVisits(visitRows);
        setSellers(sellerRows);
        setManager(isDistributorManager(me.membershipRole));
        if (customerRows[0]) setCustomerId(customerRows[0].id);
        if (sellerRows[0]) setSellerUserId(sellerRows[0].userId);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
  }, []);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await reload(search);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha na busca.');
    }
  }

  async function onCreateCustomer(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const created = await createCustomer({
        name: customerName,
        cnpj: customerCnpj || null,
        city: customerCity || null,
      });
      setCustomerName('');
      setCustomerCnpj('');
      setCustomerCity('');
      setCustomerId(created.id);
      setNotice('Cliente cadastrado na agenda.');
      await reload(search);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao cadastrar.');
    } finally {
      setSaving(false);
    }
  }

  async function onCreateVisit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!customerId) {
      setError('Escolha o cliente da visita.');
      return;
    }
    setSaving(true);
    try {
      await createVisit({
        customerId,
        visitedAt,
        summary,
        nextAction: nextAction || null,
        sellerUserId: manager ? sellerUserId || null : null,
      });
      setSummary('');
      setNextAction('');
      setNotice('Visita registrada.');
      await reload(search);
      if (history?.id === customerId) {
        setHistory(await getCustomerHistory(customerId));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar.');
    } finally {
      setSaving(false);
    }
  }

  async function openHistory(id: string) {
    setError(null);
    setCustomerId(id);
    try {
      setHistory(await getCustomerHistory(id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir histórico.');
    }
  }

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Comercial</p>
          <h1 className="page-title">Agenda do vendedor</h1>
          <p className="page-lead">
            Histórico do que foi falado com cada cliente. O gestor lê tudo; o
            vendedor registra a visita.
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
        <h2 className="dash-panel__title">Buscar cliente</h2>
        <form className="form-grid" onSubmit={onSearch}>
          <label className="field">
            <span className="field-label">Nome, CNPJ ou cidade</span>
            <input
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Acme"
            />
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">
              Buscar
            </button>
          </div>
        </form>
      </section>

      <section className="dash-panel">
        <h2 className="dash-panel__title">Novo cliente</h2>
        <form className="form-grid" onSubmit={onCreateCustomer}>
          <label className="field">
            <span className="field-label">Nome</span>
            <input
              className="input"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">CNPJ</span>
            <input
              className="input"
              value={customerCnpj}
              onChange={(event) => setCustomerCnpj(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Cidade</span>
            <input
              className="input"
              value={customerCity}
              onChange={(event) => setCustomerCity(event.target.value)}
            />
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              Cadastrar
            </button>
          </div>
        </form>
      </section>

      <section className="dash-panel">
        <h2 className="dash-panel__title">Registrar visita</h2>
        <form className="form-grid" onSubmit={onCreateVisit}>
          <label className="field">
            <span className="field-label">Cliente</span>
            <select
              className="input"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              required
            >
              <option value="">Selecione</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Data</span>
            <input
              className="input"
              type="date"
              value={visitedAt}
              onChange={(event) => setVisitedAt(event.target.value)}
              required
            />
          </label>
          {manager ? (
            <label className="field">
              <span className="field-label">Vendedor</span>
              <select
                className="input"
                value={sellerUserId}
                onChange={(event) => setSellerUserId(event.target.value)}
              >
                {sellers.map((seller) => (
                  <option key={seller.userId} value={seller.userId}>
                    {seller.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            <span className="field-label">O que foi falado</span>
            <textarea
              className="input"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={3}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Próxima ação</span>
            <input
              className="input"
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
              placeholder="Enviar orçamento"
            />
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              Salvar visita
            </button>
          </div>
        </form>
      </section>

      <section className="dash-panel">
        <h2 className="dash-panel__title">Clientes</h2>
        {customers.length === 0 ? (
          <p className="field-hint">Nenhum cliente na agenda ainda.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Cidade</th>
                  <th>Visitas</th>
                  <th>Última</th>
                  <th>Resumo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td>
                    <td>{customer.city ?? '—'}</td>
                    <td>{customer.visitCount}</td>
                    <td>{customer.lastVisitedAt ?? '—'}</td>
                    <td>{customer.lastSummary ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void openHistory(customer.id)}
                      >
                        Histórico
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {history ? (
        <section className="dash-panel">
          <h2 className="dash-panel__title">Histórico · {history.name}</h2>
          {history.visits.length === 0 ? (
            <p className="field-hint">Ainda sem visitas neste cliente.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Vendedor</th>
                    <th>Resumo</th>
                    <th>Próxima ação</th>
                  </tr>
                </thead>
                <tbody>
                  {history.visits.map((visit) => (
                    <tr key={visit.id}>
                      <td>{visit.visitedAt}</td>
                      <td>{visit.sellerName ?? visit.sellerUserId}</td>
                      <td>{visit.summary}</td>
                      <td>{visit.nextAction ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <section className="dash-panel">
        <h2 className="dash-panel__title">Últimas visitas</h2>
        {visits.length === 0 ? (
          <p className="field-hint">Nenhuma visita registrada.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th>Resumo</th>
                  <th>Próxima ação</th>
                </tr>
              </thead>
              <tbody>
                {visits.slice(0, 30).map((visit) => (
                  <tr key={visit.id}>
                    <td>{visit.visitedAt}</td>
                    <td>{visit.customerName ?? '—'}</td>
                    <td>{visit.sellerName ?? visit.sellerUserId}</td>
                    <td>{visit.summary}</td>
                    <td>{visit.nextAction ?? '—'}</td>
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
