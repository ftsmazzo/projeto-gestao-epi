'use client';

import type {
  PortalEpiCoverageNeedRow,
  PortalEpiCoverageResponse,
  PortalEpiCoverageStatus,
  PortalEntregaWorkerOption,
  PortalEntregasPreparacaoResponse,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import {
  fetchPortalEntregasPreparacao,
  fetchPortalWorkerEpiCoverage,
} from '../../../lib/client-auth';

function stripDiacritics(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function statusLabel(status: PortalEpiCoverageStatus) {
  switch (status) {
    case 'DISPONIVEL':
      return 'Disponivel';
    case 'SEM_ESTOQUE':
      return 'Sem estoque';
    case 'SEM_EPI_REAL_VINCULADO':
      return 'Sem EPI real';
    case 'SEM_REQUISITO':
      return 'Sem requisito';
    default:
      return status;
  }
}

function statusPillClass(status: PortalEpiCoverageStatus) {
  if (status === 'DISPONIVEL') return 'status-pill status-pill--active';
  if (status === 'SEM_ESTOQUE') return 'status-pill status-pill--warn';
  return 'status-pill status-pill--inactive';
}

function NeedCard({ row }: { row: PortalEpiCoverageNeedRow }) {
  return (
    <article className="portal-coverage-need">
      <header className="portal-coverage-need__header">
        <div>
          <h3 className="portal-coverage-need__title">{row.needName}</h3>
          <p className="table-sub">
            {row.isRequired ? 'Obrigatorio' : 'Recomendado'}
            {row.riskName ? ` · Risco: ${row.riskName}` : ''}
            {row.quantity > 1 ? ` · Qtd ${row.quantity}` : ''}
            {row.replacementLabel
              ? ` · Periodicidade: ${row.replacementLabel}`
              : ''}
          </p>
        </div>
        <span className={statusPillClass(row.status)}>
          {statusLabel(row.status)}
        </span>
      </header>

      {row.guidance ? (
        <p className="field-hint" role="status">
          {row.guidance}
        </p>
      ) : null}

      {row.linkedEpis.length > 0 ? (
        <ul className="portal-coverage-epis">
          {row.linkedEpis.map((epi) => (
            <li key={epi.epiItemId}>
              <strong>
                {epi.name}
                {row.suggestedEpiItemId === epi.epiItemId
                  ? ' (sugerido)'
                  : ''}
              </strong>
              <span className="table-sub">
                CA {epi.caNumber ?? '—'}
                {epi.usefulLifeLabel ? ` · Vida util ${epi.usefulLifeLabel}` : ''}
                {' · '}
                Saldo total: {epi.totalQuantity}
              </span>
              {epi.balances.length > 0 ? (
                <span className="table-sub">
                  {epi.balances
                    .map((b) => `${b.locationName}: ${b.quantity}`)
                    .join(' · ')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-hint">Nenhum EPI real vinculado a esta necessidade.</p>
      )}
    </article>
  );
}

function PortalEntregasContent() {
  const [prep, setPrep] = useState<PortalEntregasPreparacaoResponse | null>(
    null,
  );
  const [coverage, setCoverage] = useState<PortalEpiCoverageResponse | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [unitId, setUnitId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [jobId, setJobId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPortalEntregasPreparacao()
      .then((res) => {
        if (!cancelled) {
          setPrep(res);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Falha ao carregar preparacao de entrega.',
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredWorkers = useMemo(() => {
    if (!prep) return [];
    const needle = stripDiacritics(query.trim());
    return prep.workers.filter((worker) => {
      if (unitId && worker.unitId !== unitId) return false;
      if (sectorId && worker.sectorId !== sectorId) return false;
      if (jobId && worker.jobFunctionId !== jobId) return false;
      if (!needle) return true;
      const hay = stripDiacritics(
        [
          worker.name,
          worker.registration ?? '',
          worker.cpfMasked ?? '',
          worker.jobFunctionName ?? '',
          worker.sectorName ?? '',
          worker.unitName ?? '',
        ].join(' '),
      );
      return hay.includes(needle);
    });
  }, [prep, query, unitId, sectorId, jobId]);

  const jobsForFilter = useMemo(() => {
    if (!prep) return [];
    if (!sectorId) return prep.filters.jobs;
    return prep.filters.jobs.filter((job) => job.sectorId === sectorId);
  }, [prep, sectorId]);

  async function selectWorker(worker: PortalEntregaWorkerOption) {
    setSelectedId(worker.id);
    setLoadingCoverage(true);
    setError(null);
    try {
      const res = await fetchPortalWorkerEpiCoverage(worker.id);
      setCoverage(res);
    } catch (err) {
      setCoverage(null);
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar cobertura de EPIs.',
      );
    } finally {
      setLoadingCoverage(false);
    }
  }

  return (
    <div className="portal-home">
      <header className="portal-home-header">
        <div>
          <p className="page-kicker">Dia a dia</p>
          <h1 className="page-title page-title--sm">Preparar entrega de EPI</h1>
          <p className="page-lead">
            Selecione um trabalhador para ver os EPIs necessarios. Esta tela so
            prepara a operacao — o registro da entrega e a baixa de estoque
            entram na proxima etapa.
          </p>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="page-lead">Carregando trabalhadores...</p> : null}

      {prep ? (
        <>
          <section className="quota-summary" aria-label="Resumo">
            <div className="quota-summary-item">
              <span className="quota-summary-label">Ativos</span>
              <strong className="quota-summary-value">
                {prep.summary.activeWorkers}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Com funcao</span>
              <strong className="quota-summary-value">
                {prep.summary.withJobFunction}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Sem funcao</span>
              <strong className="quota-summary-value">
                {prep.summary.withoutJobFunction}
              </strong>
            </div>
          </section>

          <section className="portal-card" aria-labelledby="worker-select-title">
            <h2 id="worker-select-title" className="page-title page-title--sm">
              Trabalhadores
            </h2>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="entrega-worker-search">Buscar</label>
                <input
                  id="entrega-worker-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nome, matricula ou CPF mascarado"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="entrega-unit">Unidade</label>
                <select
                  id="entrega-unit"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                >
                  <option value="">Todas</option>
                  {prep.filters.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="entrega-sector">Setor</label>
                <select
                  id="entrega-sector"
                  value={sectorId}
                  onChange={(e) => {
                    setSectorId(e.target.value);
                    setJobId('');
                  }}
                >
                  <option value="">Todos</option>
                  {prep.filters.sectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="entrega-job">Funcao</label>
                <select
                  id="entrega-job"
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                >
                  <option value="">Todas</option>
                  {jobsForFilter.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Matricula</th>
                    <th>Unidade</th>
                    <th>Setor</th>
                    <th>Funcao</th>
                    <th>EPIs</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkers.length === 0 ? (
                    <tr>
                      <td colSpan={7}>Nenhum trabalhador ativo encontrado.</td>
                    </tr>
                  ) : (
                    filteredWorkers.map((worker) => (
                      <tr
                        key={worker.id}
                        className={
                          selectedId === worker.id ? 'is-selected-row' : undefined
                        }
                      >
                        <td>
                          <strong>{worker.name}</strong>
                          {worker.cpfMasked ? (
                            <span className="table-sub mono">
                              {worker.cpfMasked}
                            </span>
                          ) : null}
                        </td>
                        <td className="mono">{worker.registration ?? '—'}</td>
                        <td>{worker.unitName ?? '—'}</td>
                        <td>{worker.sectorName ?? '—'}</td>
                        <td>
                          {worker.jobFunctionName ?? (
                            <span className="status-pill status-pill--warn">
                              Sem funcao
                            </span>
                          )}
                        </td>
                        <td className="mono">{worker.requiredEpiCount}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => void selectWorker(worker)}
                          >
                            Selecionar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="portal-card" aria-labelledby="coverage-title">
            <h2 id="coverage-title" className="page-title page-title--sm">
              EPIs necessarios
            </h2>
            {!selectedId ? (
              <p className="page-lead">
                Selecione um trabalhador para ver os EPIs necessarios.
              </p>
            ) : null}
            {loadingCoverage ? (
              <p className="page-lead">Carregando cobertura...</p>
            ) : null}

            {coverage ? (
              <>
                <div className="portal-coverage-worker">
                  <p>
                    <strong>{coverage.worker.name}</strong>
                    {coverage.worker.registration
                      ? ` · Mat. ${coverage.worker.registration}`
                      : ''}
                  </p>
                  <p className="table-sub">
                    {coverage.worker.unitName ?? 'Sem unidade'}
                    {' · '}
                    {coverage.worker.sectorName ?? 'Sem setor'}
                    {' · '}
                    {coverage.worker.jobFunctionName ?? 'Sem funcao'}
                  </p>
                </div>

                {coverage.summary.message ? (
                  <p
                    className={
                      coverage.summary.status === 'OK'
                        ? 'notice notice--info'
                        : coverage.summary.status === 'ATENCAO'
                          ? 'notice notice--warn'
                          : 'notice notice--warn'
                    }
                    role="status"
                  >
                    {coverage.summary.message}
                  </p>
                ) : null}

                <section className="quota-summary" aria-label="Cobertura">
                  <div className="quota-summary-item">
                    <span className="quota-summary-label">Necessidades</span>
                    <strong className="quota-summary-value">
                      {coverage.summary.totalNeeds}
                    </strong>
                  </div>
                  <div className="quota-summary-item">
                    <span className="quota-summary-label">Disponiveis</span>
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

                {coverage.needs.length === 0 ? (
                  <p className="page-lead">
                    {coverage.summary.message ??
                      'Nenhum EPI necessario para este trabalhador.'}
                  </p>
                ) : (
                  <div className="portal-coverage-list">
                    {coverage.needs.map((need) => (
                      <NeedCard key={need.requirementId} row={need} />
                    ))}
                  </div>
                )}

                <div className="btn-row" style={{ marginTop: '1rem' }}>
                  <button type="button" className="btn btn-primary" disabled>
                    Registrar entrega (proxima etapa)
                  </button>
                  <Link className="btn btn-secondary" href="/portal/estoque">
                    Ir ao estoque
                  </Link>
                  <Link className="btn btn-secondary" href="/portal">
                    Voltar ao painel
                  </Link>
                </div>
              </>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function PortalEntregasPage() {
  return (
    <RequireClientAuth>
      {() => <PortalEntregasContent />}
    </RequireClientAuth>
  );
}
