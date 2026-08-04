'use client';

import type {
  PortalReportFiltersMeta,
  PortalReportFiltersQuery,
  PortalReportsCoverageResponse,
  PortalReportsDeliveriesResponse,
  PortalReportsOverviewResponse,
  PortalReportsReturnsResponse,
  PortalReportsStockResponse,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import {
  fetchPortalReportFilters,
  fetchPortalReportsCoverage,
  fetchPortalReportsDeliveries,
  fetchPortalReportsOverview,
  fetchPortalReportsReturns,
  fetchPortalReportsStock,
} from '../../../lib/client-auth';

type TabId = 'overview' | 'deliveries' | 'stock' | 'returns' | 'coverage';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Visao geral' },
  { id: 'deliveries', label: 'Entregas' },
  { id: 'stock', label: 'Estoque' },
  { id: 'returns', label: 'Devolucoes' },
  { id: 'coverage', label: 'Cobertura' },
];

function defaultFromTo() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

function conditionLabel(condition: string | null) {
  if (!condition) return '—';
  const map: Record<string, string> = {
    REUSABLE: 'Reutilizavel',
    DAMAGED: 'Danificado',
    DISCARDED: 'Descartado',
    LOST: 'Extraviado',
  };
  return map[condition] ?? condition;
}

function PortalRelatoriosContent() {
  const defaults = useMemo(() => defaultFromTo(), []);
  const [tab, setTab] = useState<TabId>('overview');
  const [meta, setMeta] = useState<PortalReportFiltersMeta | null>(null);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [workerId, setWorkerId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [jobFunctionId, setJobFunctionId] = useState('');
  const [status, setStatus] = useState('');
  const [stockStatus, setStockStatus] = useState('');

  const [applied, setApplied] = useState<PortalReportFiltersQuery>({
    from: defaults.from,
    to: defaults.to,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<PortalReportsOverviewResponse | null>(
    null,
  );
  const [deliveries, setDeliveries] =
    useState<PortalReportsDeliveriesResponse | null>(null);
  const [stock, setStock] = useState<PortalReportsStockResponse | null>(null);
  const [returns, setReturns] =
    useState<PortalReportsReturnsResponse | null>(null);
  const [coverage, setCoverage] =
    useState<PortalReportsCoverageResponse | null>(null);

  useEffect(() => {
    void fetchPortalReportFilters()
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  const loadTab = useCallback(async (active: TabId, filters: PortalReportFiltersQuery) => {
    setLoading(true);
    setError(null);
    try {
      if (active === 'overview') {
        setOverview(await fetchPortalReportsOverview(filters));
      } else if (active === 'deliveries') {
        setDeliveries(await fetchPortalReportsDeliveries(filters));
      } else if (active === 'stock') {
        setStock(await fetchPortalReportsStock(filters));
      } else if (active === 'returns') {
        setReturns(await fetchPortalReportsReturns(filters));
      } else {
        setCoverage(await fetchPortalReportsCoverage(filters));
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Falha ao carregar relatorio.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTab(tab, applied);
  }, [tab, applied, loadTab]);

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    const next: PortalReportFiltersQuery = {
      from: from || undefined,
      to: to || undefined,
      workerId: workerId || undefined,
      unitId: unitId || undefined,
      sectorId: sectorId || undefined,
      jobFunctionId: jobFunctionId || undefined,
      status: status || undefined,
      stockStatus: stockStatus || undefined,
    };
    setApplied(next);
  }

  const jobsFiltered =
    meta?.jobs.filter((j) => !sectorId || j.sectorId === sectorId) ?? [];

  return (
    <div className="portal-home">
      <header className="portal-home-header portal-home-header--decision">
        <div>
          <p className="page-kicker">Dia a dia</p>
          <h1 className="page-title page-title--sm">Relatorios</h1>
          <p className="page-lead">
            Consulta de entregas, estoque, devolucoes e cobertura. Somente
            leitura — nao altera operacao.
          </p>
        </div>
      </header>

      <form
        className="portal-card form-grid"
        onSubmit={applyFilters}
        aria-label="Filtros"
        style={{ marginBottom: '1rem' }}
      >
        <div className="field">
          <label htmlFor="rep-from">De</label>
          <input
            id="rep-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="rep-to">Ate</label>
          <input
            id="rep-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="rep-worker">Trabalhador</label>
          <select
            id="rep-worker"
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
          >
            <option value="">Todos</option>
            {meta?.workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rep-unit">Unidade</label>
          <select
            id="rep-unit"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          >
            <option value="">Todas</option>
            {meta?.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rep-sector">Setor</label>
          <select
            id="rep-sector"
            value={sectorId}
            onChange={(e) => {
              setSectorId(e.target.value);
              setJobFunctionId('');
            }}
          >
            <option value="">Todos</option>
            {meta?.sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rep-job">Funcao</label>
          <select
            id="rep-job"
            value={jobFunctionId}
            onChange={(e) => setJobFunctionId(e.target.value)}
          >
            <option value="">Todas</option>
            {jobsFiltered.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </div>
        {tab === 'deliveries' ? (
          <div className="field">
            <label htmlFor="rep-status-del">Status entrega</label>
            <select
              id="rep-status-del"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="COMPLETED">Concluida</option>
              <option value="CANCELLED">Cancelada</option>
              <option value="PARTIALLY_RETURNED">Parcialmente devolvida</option>
              <option value="RETURNED">Devolvida</option>
            </select>
          </div>
        ) : null}
        {tab === 'returns' ? (
          <div className="field">
            <label htmlFor="rep-status-ret">Tipo</label>
            <select
              id="rep-status-ret"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="DEVOLUCAO">Devolucao</option>
              <option value="CANCELAMENTO">Cancelamento</option>
            </select>
          </div>
        ) : null}
        {tab === 'stock' ? (
          <div className="field">
            <label htmlFor="rep-stock-status">Status estoque</label>
            <select
              id="rep-stock-status"
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="ok">OK</option>
              <option value="baixo">Baixo</option>
              <option value="zerado">Zerado</option>
            </select>
          </div>
        ) : null}
        {tab === 'coverage' ? (
          <div className="field">
            <label htmlFor="rep-cov-status">Status cobertura</label>
            <select
              id="rep-cov-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="DISPONIVEL">Disponivel</option>
              <option value="SEM_ESTOQUE">Sem estoque</option>
              <option value="SEM_EPI_REAL_VINCULADO">Sem EPI real</option>
            </select>
          </div>
        ) : null}
        <div className="btn-row">
          <button type="submit" className="btn btn--primary">
            Aplicar filtros
          </button>
        </div>
      </form>

      <div className="portal-section-tabs" role="tablist" aria-label="Abas de relatorio">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`portal-section-tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="page-lead">Carregando...</p> : null}

      {!loading && tab === 'overview' && overview ? (
        <>
          <section className="quota-summary" aria-label="Resumo do periodo">
            <div className="quota-summary-item">
              <span className="quota-summary-label">Entregas</span>
              <strong className="quota-summary-value">
                {overview.cards.deliveriesInPeriod}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Itens entregues</span>
              <strong className="quota-summary-value">
                {overview.cards.itemsDelivered}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Devolucoes</span>
              <strong className="quota-summary-value">
                {overview.cards.returnsInPeriod}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Cancelamentos</span>
              <strong className="quota-summary-value">
                {overview.cards.cancellationsInPeriod}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Trabalhadores ativos</span>
              <strong className="quota-summary-value">
                {overview.cards.workersActive}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Sem EPI real</span>
              <strong className="quota-summary-value">
                {overview.cards.needsWithoutLinkedEpi}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Sem estoque</span>
              <strong className="quota-summary-value">
                {overview.cards.needsWithoutStock}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Estoque baixo/zerado</span>
              <strong className="quota-summary-value">
                {overview.cards.stockLowOrZero}
              </strong>
            </div>
          </section>
          {!overview.cost.available ? (
            <p className="notice notice--warn" role="status">
              {overview.cost.message}
            </p>
          ) : null}
          <p className="page-lead">
            Periodo: {overview.period.from} a {overview.period.to}
          </p>
        </>
      ) : null}

      {!loading && tab === 'deliveries' && deliveries ? (
        <div className="table-wrap">
          {deliveries.rows.length === 0 ? (
            <p className="page-lead">Nenhuma entrega no periodo filtrado.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Recibo</th>
                  <th>Trabalhador</th>
                  <th>Unidade / setor / funcao</th>
                  <th>Itens</th>
                  <th>Status</th>
                  <th>Operador</th>
                  <th>Facial</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {deliveries.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.deliveredAt)}</td>
                    <td className="mono">{row.receiptNumber}</td>
                    <td>
                      <strong>{row.worker.name}</strong>
                      {row.worker.registration ? (
                        <div className="table-sub">{row.worker.registration}</div>
                      ) : null}
                    </td>
                    <td>
                      {[
                        row.worker.unitName,
                        row.worker.sectorName,
                        row.worker.jobFunctionName,
                      ]
                        .filter(Boolean)
                        .join(' / ') || '—'}
                    </td>
                    <td>{row.itemsSummary || '—'}</td>
                    <td>{row.statusLabel}</td>
                    <td>{row.operatorName}</td>
                    <td>{row.hasFacialEvidence ? 'Sim' : 'Nao'}</td>
                    <td>
                      <Link href={`/portal/entregas/${row.id}`}>
                        Comprovante
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {!loading && tab === 'stock' && stock ? (
        <>
          <section className="quota-summary" aria-label="Resumo de estoque">
            <div className="quota-summary-item">
              <span className="quota-summary-label">Total</span>
              <strong className="quota-summary-value">{stock.summary.total}</strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">OK</span>
              <strong className="quota-summary-value">{stock.summary.ok}</strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Baixo</span>
              <strong className="quota-summary-value">{stock.summary.baixo}</strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Zerado</span>
              <strong className="quota-summary-value">
                {stock.summary.zerado}
              </strong>
            </div>
          </section>
          <div className="table-wrap">
            {stock.rows.length === 0 ? (
              <p className="page-lead">Nenhum saldo de estoque encontrado.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>EPI real</th>
                    <th>CA</th>
                    <th>Necessidade</th>
                    <th>Local</th>
                    <th>Saldo</th>
                    <th>Minimo</th>
                    <th>Status</th>
                    <th>Validade CA</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.rows.map((row) => (
                    <tr key={`${row.epiItemId}-${row.stockLocationId}`}>
                      <td>
                        <strong>{row.epiName}</strong>
                        {row.category ? (
                          <div className="table-sub">{row.category}</div>
                        ) : null}
                      </td>
                      <td className="mono">{row.caNumber || '—'}</td>
                      <td>{row.needsLabel}</td>
                      <td>{row.locationName}</td>
                      <td>{row.quantity}</td>
                      <td>{row.minQuantity ?? '—'}</td>
                      <td>
                        <span
                          className={
                            row.status === 'ok'
                              ? 'status-pill status-pill--active'
                              : 'status-pill status-pill--warn'
                          }
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                      <td>{formatDate(row.caExpiresAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}

      {!loading && tab === 'returns' && returns ? (
        <div className="table-wrap">
          {returns.rows.length === 0 ? (
            <p className="page-lead">
              Nenhuma devolucao ou cancelamento no periodo.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Trabalhador</th>
                  <th>Recibo</th>
                  <th>Tipo</th>
                  <th>Item</th>
                  <th>Qtd</th>
                  <th>Condicao</th>
                  <th>Retornou estoque</th>
                  <th>Motivo</th>
                  <th>Operador</th>
                </tr>
              </thead>
              <tbody>
                {returns.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.at)}</td>
                    <td>
                      <strong>{row.workerName}</strong>
                      {row.workerRegistration ? (
                        <div className="table-sub">{row.workerRegistration}</div>
                      ) : null}
                    </td>
                    <td>
                      <Link href={`/portal/entregas/${row.deliveryId}`}>
                        {row.receiptNumber}
                      </Link>
                    </td>
                    <td>{row.typeLabel}</td>
                    <td>{row.itemLabel}</td>
                    <td>{row.quantity}</td>
                    <td>{conditionLabel(row.condition)}</td>
                    <td>
                      {row.returnedToStock == null
                        ? '—'
                        : row.returnedToStock
                          ? 'Sim'
                          : 'Nao'}
                    </td>
                    <td>{row.reason || '—'}</td>
                    <td>{row.operatorName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {!loading && tab === 'coverage' && coverage ? (
        <>
          <section className="quota-summary" aria-label="Resumo de cobertura">
            <div className="quota-summary-item">
              <span className="quota-summary-label">Necessidades</span>
              <strong className="quota-summary-value">
                {coverage.summary.totalNeeds}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Disponivel</span>
              <strong className="quota-summary-value">
                {coverage.summary.disponivel}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Sem estoque</span>
              <strong className="quota-summary-value">
                {coverage.summary.semEstoque}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Sem EPI real</span>
              <strong className="quota-summary-value">
                {coverage.summary.semEpiReal}
              </strong>
            </div>
          </section>
          {coverage.byJobFunction.length === 0 ? (
            <p className="page-lead">Nenhuma necessidade de cobertura encontrada.</p>
          ) : (
            coverage.byJobFunction.map((job) => (
              <section key={job.jobFunctionId} className="panel" style={{ marginTop: '1rem' }}>
                <h2 className="page-title page-title--sm">
                  {job.jobFunctionName}
                  {job.sectorName ? (
                    <span className="table-sub"> · {job.sectorName}</span>
                  ) : null}
                </h2>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Necessidade</th>
                        <th>Riscos</th>
                        <th>EPI vinculados</th>
                        <th>Estoque</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.needs.map((need) => (
                        <tr key={`${job.jobFunctionId}-${need.epiNeedId}`}>
                          <td>
                            <strong>{need.needName}</strong>
                            {need.warnings.length > 0 ? (
                              <div className="table-sub">{need.warnings.join(' ')}</div>
                            ) : null}
                          </td>
                          <td>
                            {need.risks.length === 0
                              ? '—'
                              : need.risks.map((r) => (
                                  <span
                                    key={r.id}
                                    className="status-pill status-pill--inactive"
                                    style={{ marginRight: 4 }}
                                  >
                                    {r.name}
                                  </span>
                                ))}
                          </td>
                          <td>{need.linkedEpiCount}</td>
                          <td>{need.availableStock}</td>
                          <td>
                            <span
                              className={
                                need.status === 'DISPONIVEL'
                                  ? 'status-pill status-pill--active'
                                  : 'status-pill status-pill--warn'
                              }
                            >
                              {need.statusLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          )}
        </>
      ) : null}
    </div>
  );
}

export default function PortalRelatoriosPage() {
  return (
    <RequireClientAuth>
      {() => <PortalRelatoriosContent />}
    </RequireClientAuth>
  );
}
