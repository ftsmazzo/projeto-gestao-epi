'use client';

import type {
  PortalReportFiltersMeta,
  PortalReportFiltersQuery,
  PortalReportsActivityResponse,
  PortalReportsCoverageResponse,
  PortalReportsDeliveriesResponse,
  PortalReportsOverviewResponse,
  PortalReportsReplacementsResponse,
  PortalReportsReturnsResponse,
  PortalReportsStockResponse,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import {
  fetchPortalReportFilters,
  fetchPortalReportsActivity,
  fetchPortalReportsCoverage,
  fetchPortalReportsDeliveries,
  fetchPortalReportsOverview,
  fetchPortalReportsReplacements,
  fetchPortalReportsReturns,
  fetchPortalReportsStock,
} from '../../../lib/client-auth';
import {
  exportActivityCsv,
  exportCoverageCsv,
  exportDeliveriesCsv,
  exportOverviewCsv,
  exportReplacementsCsv,
  exportReturnsCsv,
  exportStockCsv,
} from '../../../lib/portal-report-csv';

type TabId =
  | 'overview'
  | 'replacements'
  | 'deliveries'
  | 'activity'
  | 'stock'
  | 'returns'
  | 'coverage';

const TABS: Array<{ id: TabId; label: string; hint: string }> = [
  { id: 'overview', label: 'Visao geral', hint: 'Indicadores do periodo' },
  { id: 'replacements', label: 'Trocas', hint: 'EPI a vencer / vencido' },
  { id: 'deliveries', label: 'Entregas', hint: 'Lista operacional' },
  { id: 'activity', label: 'Atividade', hint: 'Ranking por vida e setor' },
  { id: 'stock', label: 'Estoque', hint: 'Saldos e alertas' },
  { id: 'returns', label: 'Devolucoes', hint: 'Baixas e cancelamentos' },
  { id: 'coverage', label: 'Cobertura', hint: 'Necessidade x estoque' },
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
    return iso;
  }
}

function formatDateBr(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
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

function daysLabel(daysRemaining: number) {
  if (daysRemaining < 0) {
    const n = Math.abs(daysRemaining);
    return n === 1 ? 'Vencido ha 1 dia' : `Vencido ha ${n} dias`;
  }
  if (daysRemaining === 0) return 'Vence hoje';
  if (daysRemaining === 1) return 'Vence amanha';
  return `Vence em ${daysRemaining} dias`;
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'ok' | 'warn' | 'critical' | 'muted';
}) {
  return (
    <div className={`report-kpi${tone ? ` report-kpi--${tone}` : ''}`}>
      <span className="report-kpi__label">{label}</span>
      <strong className="report-kpi__value">{value}</strong>
    </div>
  );
}

function ReportPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="report-panel">
      <header className="report-panel__head">
        <div>
          <h2 className="report-panel__title">{title}</h2>
          {subtitle ? <p className="report-panel__sub">{subtitle}</p> : null}
        </div>
      </header>
      <div className="report-panel__body">{children}</div>
    </section>
  );
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
  const [replacements, setReplacements] =
    useState<PortalReportsReplacementsResponse | null>(null);
  const [deliveries, setDeliveries] =
    useState<PortalReportsDeliveriesResponse | null>(null);
  const [activity, setActivity] =
    useState<PortalReportsActivityResponse | null>(null);
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

  const loadTab = useCallback(
    async (active: TabId, filters: PortalReportFiltersQuery) => {
      setLoading(true);
      setError(null);
      try {
        if (active === 'overview') {
          setOverview(await fetchPortalReportsOverview(filters));
        } else if (active === 'replacements') {
          setReplacements(await fetchPortalReportsReplacements(filters));
        } else if (active === 'deliveries') {
          setDeliveries(await fetchPortalReportsDeliveries(filters));
        } else if (active === 'activity') {
          setActivity(await fetchPortalReportsActivity(filters));
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
    },
    [],
  );

  useEffect(() => {
    void loadTab(tab, applied);
  }, [tab, applied, loadTab]);

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    setApplied({
      from: from || undefined,
      to: to || undefined,
      workerId: workerId || undefined,
      unitId: unitId || undefined,
      sectorId: sectorId || undefined,
      jobFunctionId: jobFunctionId || undefined,
      status: status || undefined,
      stockStatus: stockStatus || undefined,
    });
  }

  const jobsFiltered =
    meta?.jobs.filter((j) => !sectorId || j.sectorId === sectorId) ?? [];

  const activeTab = TABS.find((t) => t.id === tab)!;
  const periodLabel =
    applied.from && applied.to
      ? `${formatDateBr(applied.from)} — ${formatDateBr(applied.to)}`
      : 'Periodo aplicado';

  function canExportCurrentTab() {
    if (loading) return false;
    if (tab === 'overview') return Boolean(overview);
    if (tab === 'replacements') return Boolean(replacements);
    if (tab === 'deliveries') return Boolean(deliveries);
    if (tab === 'activity') return Boolean(activity);
    if (tab === 'stock') return Boolean(stock);
    if (tab === 'returns') return Boolean(returns);
    if (tab === 'coverage') return Boolean(coverage);
    return false;
  }

  function onExportCsv() {
    if (tab === 'overview' && overview) exportOverviewCsv(overview);
    else if (tab === 'replacements' && replacements)
      exportReplacementsCsv(replacements);
    else if (tab === 'deliveries' && deliveries) exportDeliveriesCsv(deliveries);
    else if (tab === 'activity' && activity) exportActivityCsv(activity);
    else if (tab === 'stock' && stock) exportStockCsv(stock);
    else if (tab === 'returns' && returns) exportReturnsCsv(returns);
    else if (tab === 'coverage' && coverage) exportCoverageCsv(coverage);
  }

  return (
    <div className="portal-home report-page">
      <header className="portal-home-header portal-home-header--decision report-no-print">
        <div>
          <p className="page-kicker">Operacao</p>
          <h1 className="page-title page-title--sm">Relatorios</h1>
          <p className="page-lead">
            Leitura e exportacao do dia a dia — entregas, trocas, estoque e
            cobertura.
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!canExportCurrentTab()}
            onClick={onExportCsv}
          >
            Exportar CSV
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || Boolean(error)}
            onClick={() => window.print()}
          >
            Imprimir
          </button>
        </div>
      </header>

      <div className="report-print-banner" aria-hidden="true">
        <strong>ProntEPI · Relatorio operacional</strong>
        <span>
          {activeTab.label} · {periodLabel}
        </span>
      </div>

      <form
        className="report-filters report-no-print"
        onSubmit={applyFilters}
        aria-label="Filtros do relatorio"
      >
        <div className="report-filters__grid">
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
          {tab === 'replacements' ? (
            <div className="field">
              <label htmlFor="rep-status-repl">Prioridade</label>
              <select
                id="rep-status-repl"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Todas</option>
                <option value="overdue">Vencido</option>
                <option value="critical">Critico</option>
                <option value="warn">Alerta</option>
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
        </div>
        <div className="report-filters__actions">
          <button type="submit" className="btn btn-primary">
            Aplicar filtros
          </button>
          <p className="field-hint">{periodLabel}</p>
        </div>
      </form>

      <nav
        className="report-tabs report-no-print"
        role="tablist"
        aria-label="Abas de relatorio"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`report-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => {
              setStatus('');
              setStockStatus('');
              setTab(t.id);
            }}
          >
            <span className="report-tab__label">{t.label}</span>
            <span className="report-tab__hint">{t.hint}</span>
          </button>
        ))}
      </nav>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="page-lead">Carregando relatorio...</p> : null}

      {!loading && tab === 'overview' && overview ? (
        <ReportPanel
          title="Visao geral"
          subtitle={`Periodo ${overview.period.from} a ${overview.period.to}`}
        >
          <div className="report-kpi-grid">
            <Kpi label="Entregas" value={overview.cards.deliveriesInPeriod} />
            <Kpi label="Itens entregues" value={overview.cards.itemsDelivered} />
            <Kpi label="Devolucoes" value={overview.cards.returnsInPeriod} />
            <Kpi
              label="Cancelamentos"
              value={overview.cards.cancellationsInPeriod}
              tone={overview.cards.cancellationsInPeriod > 0 ? 'warn' : 'muted'}
            />
            <Kpi label="Trabalhadores ativos" value={overview.cards.workersActive} />
            <Kpi
              label="Sem EPI real"
              value={overview.cards.needsWithoutLinkedEpi}
              tone={
                overview.cards.needsWithoutLinkedEpi > 0 ? 'critical' : 'ok'
              }
            />
            <Kpi
              label="Sem estoque"
              value={overview.cards.needsWithoutStock}
              tone={overview.cards.needsWithoutStock > 0 ? 'warn' : 'ok'}
            />
            <Kpi
              label="Estoque baixo/zerado"
              value={overview.cards.stockLowOrZero}
              tone={overview.cards.stockLowOrZero > 0 ? 'warn' : 'ok'}
            />
          </div>
          {!overview.cost.available ? (
            <p className="notice notice--warn" role="status">
              {overview.cost.message}
            </p>
          ) : null}
        </ReportPanel>
      ) : null}

      {!loading && tab === 'replacements' && replacements ? (
        <ReportPanel
          title="Fila de trocas"
          subtitle={`Horizonte ${replacements.horizon.criticalDays}/${replacements.horizon.warnDays} dias`}
        >
          <div className="report-kpi-grid report-kpi-grid--3">
            <Kpi
              label="Total"
              value={replacements.summary.total}
              tone="muted"
            />
            <Kpi
              label="Vencidos"
              value={replacements.summary.overdue}
              tone={replacements.summary.overdue > 0 ? 'critical' : 'ok'}
            />
            <Kpi
              label="Criticos"
              value={replacements.summary.critical}
              tone={replacements.summary.critical > 0 ? 'critical' : 'ok'}
            />
            <Kpi
              label="Alertas"
              value={replacements.summary.warn}
              tone={replacements.summary.warn > 0 ? 'warn' : 'ok'}
            />
          </div>
          {replacements.rows.length === 0 ? (
            <p className="page-lead">Nenhuma troca no horizonte filtrado.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table report-table">
                <thead>
                  <tr>
                    <th>Prioridade</th>
                    <th>Trabalhador</th>
                    <th>EPI</th>
                    <th>Proxima troca</th>
                    <th>Recibo</th>
                    <th className="report-no-print" />
                  </tr>
                </thead>
                <tbody>
                  {replacements.rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span
                          className={`status-pill ${
                            row.tone === 'warn'
                              ? 'status-pill--warn'
                              : 'status-pill--critical'
                          }`}
                        >
                          {row.toneLabel}
                        </span>
                        <div className="table-sub">
                          {daysLabel(row.daysRemaining)}
                        </div>
                      </td>
                      <td>
                        <strong>{row.workerName}</strong>
                        <div className="table-sub">
                          {[row.sectorName, row.jobFunctionName]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </div>
                      </td>
                      <td>
                        <strong>{row.epiName}</strong>
                        <div className="table-sub">
                          {row.needName}
                          {row.caNumber ? ` · CA ${row.caNumber}` : ''}
                        </div>
                      </td>
                      <td>{formatDate(row.nextReplacementAt)}</td>
                      <td className="mono">{row.receiptNumber}</td>
                      <td className="report-no-print">
                        <Link
                          className="btn btn-secondary"
                          href={`/portal/entregas?worker=${row.workerId}`}
                        >
                          Trocar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportPanel>
      ) : null}

      {!loading && tab === 'deliveries' && deliveries ? (
        <ReportPanel
          title="Entregas"
          subtitle={`${deliveries.rows.length} registro(s) · ${deliveries.period.from} a ${deliveries.period.to}`}
        >
          {deliveries.rows.length === 0 ? (
            <p className="page-lead">Nenhuma entrega no periodo filtrado.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table report-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Recibo</th>
                    <th>Trabalhador</th>
                    <th>Itens</th>
                    <th>Status</th>
                    <th>Facial</th>
                    <th className="report-no-print" />
                  </tr>
                </thead>
                <tbody>
                  {deliveries.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.deliveredAt)}</td>
                      <td className="mono">{row.receiptNumber}</td>
                      <td>
                        <strong>{row.worker.name}</strong>
                        <div className="table-sub">
                          {[
                            row.worker.unitName,
                            row.worker.sectorName,
                            row.worker.jobFunctionName,
                          ]
                            .filter(Boolean)
                            .join(' / ') || '—'}
                        </div>
                      </td>
                      <td>{row.itemsSummary || '—'}</td>
                      <td>{row.statusLabel}</td>
                      <td>{row.hasFacialEvidence ? 'Sim' : 'Nao'}</td>
                      <td className="report-no-print">
                        <Link href={`/portal/entregas/${row.id}`}>
                          Comprovante
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportPanel>
      ) : null}

      {!loading && tab === 'activity' && activity ? (
        <ReportPanel
          title="Atividade operacional"
          subtitle={`${activity.period.from} a ${activity.period.to}`}
        >
          <div className="report-kpi-grid report-kpi-grid--4">
            <Kpi label="Entregas" value={activity.summary.deliveries} />
            <Kpi label="Itens" value={activity.summary.itemsDelivered} />
            <Kpi
              label="Trabalhadores"
              value={activity.summary.workersWithActivity}
            />
            <Kpi label="Setores" value={activity.summary.sectorsWithActivity} />
          </div>

          <div className="report-split">
            <div>
              <h3 className="report-subtitle">Por trabalhador</h3>
              {activity.byWorker.length === 0 ? (
                <p className="page-lead">Sem atividade no periodo.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table report-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Trabalhador</th>
                        <th>Entregas</th>
                        <th>Itens</th>
                        <th>Facial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.byWorker.map((row, index) => (
                        <tr key={row.workerId}>
                          <td className="mono">{index + 1}</td>
                          <td>
                            <strong>{row.workerName}</strong>
                            <div className="table-sub">
                              {[row.sectorName, row.jobFunctionName]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </div>
                          </td>
                          <td>{row.deliveries}</td>
                          <td>{row.itemsDelivered}</td>
                          <td>{row.facialRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <h3 className="report-subtitle">Por setor</h3>
              {activity.bySector.length === 0 ? (
                <p className="page-lead">Sem atividade por setor.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table report-table">
                    <thead>
                      <tr>
                        <th>Setor</th>
                        <th>Entregas</th>
                        <th>Itens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.bySector.map((row) => (
                        <tr key={row.sectorId ?? row.sectorName}>
                          <td>
                            <strong>{row.sectorName}</strong>
                          </td>
                          <td>{row.deliveries}</td>
                          <td>{row.itemsDelivered}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </ReportPanel>
      ) : null}

      {!loading && tab === 'stock' && stock ? (
        <ReportPanel title="Estoque" subtitle="Saldos por EPI e local">
          <div className="report-kpi-grid report-kpi-grid--4">
            <Kpi label="Total" value={stock.summary.total} />
            <Kpi label="OK" value={stock.summary.ok} tone="ok" />
            <Kpi
              label="Baixo"
              value={stock.summary.baixo}
              tone={stock.summary.baixo > 0 ? 'warn' : 'ok'}
            />
            <Kpi
              label="Zerado"
              value={stock.summary.zerado}
              tone={stock.summary.zerado > 0 ? 'critical' : 'ok'}
            />
          </div>
          {stock.rows.length === 0 ? (
            <p className="page-lead">Nenhum saldo de estoque encontrado.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table report-table">
                <thead>
                  <tr>
                    <th>EPI</th>
                    <th>CA</th>
                    <th>Necessidade</th>
                    <th>Local</th>
                    <th>Saldo</th>
                    <th>Status</th>
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
                      <td>
                        {row.quantity}
                        {row.minQuantity != null ? (
                          <div className="table-sub">min {row.minQuantity}</div>
                        ) : null}
                      </td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportPanel>
      ) : null}

      {!loading && tab === 'returns' && returns ? (
        <ReportPanel
          title="Devolucoes e cancelamentos"
          subtitle={`${returns.period.from} a ${returns.period.to}`}
        >
          {returns.rows.length === 0 ? (
            <p className="page-lead">
              Nenhuma devolucao ou cancelamento no periodo.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table report-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Trabalhador</th>
                    <th>Item</th>
                    <th>Qtd</th>
                    <th>Condicao</th>
                    <th>Recibo</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.at)}</td>
                      <td>{row.typeLabel}</td>
                      <td>
                        <strong>{row.workerName}</strong>
                      </td>
                      <td>{row.itemLabel}</td>
                      <td>{row.quantity}</td>
                      <td>{conditionLabel(row.condition)}</td>
                      <td>
                        <Link href={`/portal/entregas/${row.deliveryId}`}>
                          {row.receiptNumber}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportPanel>
      ) : null}

      {!loading && tab === 'coverage' && coverage ? (
        <ReportPanel title="Cobertura" subtitle="Necessidade x estoque por funcao">
          <div className="report-kpi-grid report-kpi-grid--4">
            <Kpi label="Necessidades" value={coverage.summary.totalNeeds} />
            <Kpi
              label="Disponivel"
              value={coverage.summary.disponivel}
              tone="ok"
            />
            <Kpi
              label="Sem estoque"
              value={coverage.summary.semEstoque}
              tone={coverage.summary.semEstoque > 0 ? 'warn' : 'ok'}
            />
            <Kpi
              label="Sem EPI real"
              value={coverage.summary.semEpiReal}
              tone={coverage.summary.semEpiReal > 0 ? 'critical' : 'ok'}
            />
          </div>
          {coverage.byJobFunction.length === 0 ? (
            <p className="page-lead">Nenhuma necessidade de cobertura encontrada.</p>
          ) : (
            coverage.byJobFunction.map((job) => (
              <div key={job.jobFunctionId} className="report-job-block">
                <h3 className="report-subtitle">
                  {job.jobFunctionName}
                  {job.sectorName ? (
                    <span className="table-sub"> · {job.sectorName}</span>
                  ) : null}
                </h3>
                <div className="table-wrap">
                  <table className="data-table report-table">
                    <thead>
                      <tr>
                        <th>Necessidade</th>
                        <th>EPIs</th>
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
                              <div className="table-sub">
                                {need.warnings.join(' ')}
                              </div>
                            ) : null}
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
              </div>
            ))
          )}
        </ReportPanel>
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
