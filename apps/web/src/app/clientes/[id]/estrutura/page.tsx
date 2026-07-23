'use client';

import type {
  ClientJobFunction,
  ClientSector,
  OccupationalRisk,
  OccupationalRiskCategory,
  OperationalUnit,
  ServedClient,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { RequireAuth } from '../../../../components/RequireAuth';
import {
  createClientJobFunction,
  createClientSector,
  linkJobFunctionRisk,
  listClientJobFunctions,
  listClientSectors,
  listOccupationalRisks,
  suggestOccupationalRiskDefaults,
  unlinkJobFunctionRisk,
  updateClientJobFunctionStatus,
  updateClientSectorStatus,
} from '../../../../lib/client-structure';
import { listOperationalUnits } from '../../../../lib/operational-units';
import { getServedClient } from '../../../../lib/served-clients';

const RISK_CATEGORIES: { value: OccupationalRiskCategory; label: string }[] = [
  { value: 'FISICO', label: 'Fisico' },
  { value: 'QUIMICO', label: 'Quimico' },
  { value: 'BIOLOGICO', label: 'Biologico' },
  { value: 'ERGONOMICO', label: 'Ergonomico' },
  { value: 'MECANICO', label: 'Mecanico' },
  { value: 'ACIDENTE', label: 'Acidente' },
  { value: 'PSICOSSOCIAL', label: 'Psicossocial' },
  { value: 'OUTROS', label: 'Outros' },
];

function riskCategoryLabel(value: OccupationalRiskCategory) {
  return RISK_CATEGORIES.find((item) => item.value === value)?.label ?? value;
}

function EstruturaContent({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<ServedClient | null>(null);
  const [units, setUnits] = useState<OperationalUnit[]>([]);
  const [sectors, setSectors] = useState<ClientSector[]>([]);
  const [jobs, setJobs] = useState<ClientJobFunction[]>([]);
  const [risks, setRisks] = useState<OccupationalRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [sectorName, setSectorName] = useState('');
  const [sectorUnitId, setSectorUnitId] = useState('');
  const [sectorDesc, setSectorDesc] = useState('');
  const [sectorError, setSectorError] = useState<string | null>(null);
  const [sectorSaving, setSectorSaving] = useState(false);

  const [jobSectorId, setJobSectorId] = useState('');
  const [jobName, setJobName] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [jobEnv, setJobEnv] = useState('');
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobSaving, setJobSaving] = useState(false);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [linkRiskId, setLinkRiskId] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const status = showInactive ? 'all' : 'active';
      const [served, unitList, sectorList, jobList, riskList] =
        await Promise.all([
          getServedClient(clientId),
          listOperationalUnits(clientId),
          listClientSectors(clientId, status),
          listClientJobFunctions({ servedClientId: clientId, status }),
          listOccupationalRisks({ status: 'active' }),
        ]);
      setClient(served);
      setUnits(unitList);
      setSectors(sectorList);
      setJobs(jobList);
      setRisks(riskList);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar a estrutura.',
      );
    } finally {
      setLoading(false);
    }
  }, [clientId, showInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredSectors = useMemo(() => {
    if (!sectorFilter) return sectors;
    return sectors.filter((s) => s.id === sectorFilter);
  }, [sectors, sectorFilter]);

  const jobsBySector = useMemo(() => {
    const map = new Map<string, ClientJobFunction[]>();
    for (const job of jobs) {
      const list = map.get(job.sectorId) ?? [];
      list.push(job);
      map.set(job.sectorId, list);
    }
    return map;
  }, [jobs]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );

  async function onCreateSector(event: FormEvent) {
    event.preventDefault();
    setSectorError(null);
    setSectorSaving(true);
    try {
      await createClientSector({
        servedClientId: clientId,
        name: sectorName.trim(),
        operationalUnitId: sectorUnitId || null,
        description: sectorDesc.trim() || null,
      });
      setSectorName('');
      setSectorUnitId('');
      setSectorDesc('');
      await load();
    } catch (err) {
      setSectorError(
        err instanceof Error ? err.message : 'Falha ao criar setor.',
      );
    } finally {
      setSectorSaving(false);
    }
  }

  async function onCreateJob(event: FormEvent) {
    event.preventDefault();
    setJobError(null);
    setJobSaving(true);
    try {
      await createClientJobFunction({
        servedClientId: clientId,
        sectorId: jobSectorId,
        name: jobName.trim(),
        description: jobDesc.trim() || null,
        environmentDescription: jobEnv.trim() || null,
      });
      setJobName('');
      setJobDesc('');
      setJobEnv('');
      await load();
    } catch (err) {
      setJobError(
        err instanceof Error ? err.message : 'Falha ao criar funcao.',
      );
    } finally {
      setJobSaving(false);
    }
  }

  async function onSuggestRisks() {
    setError(null);
    try {
      const result = await suggestOccupationalRiskDefaults();
      await load();
      window.alert(
        result.createdCount > 0
          ? `${result.createdCount} risco(s) adicionados. ${result.skippedCount} ja existiam.`
          : 'Nenhum risco novo: as sugestoes iniciais ja existem.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel gerar riscos comuns.',
      );
    }
  }

  async function onLinkRisk(event: FormEvent) {
    event.preventDefault();
    if (!selectedJobId || !linkRiskId) return;
    setLinkError(null);
    try {
      await linkJobFunctionRisk(selectedJobId, { riskId: linkRiskId });
      setLinkRiskId('');
      await load();
    } catch (err) {
      setLinkError(
        err instanceof Error ? err.message : 'Falha ao vincular risco.',
      );
    }
  }

  async function onUnlinkRisk(riskId: string) {
    if (!selectedJobId) return;
    try {
      await unlinkJobFunctionRisk(selectedJobId, riskId);
      await load();
    } catch (err) {
      setLinkError(
        err instanceof Error ? err.message : 'Falha ao remover risco.',
      );
    }
  }

  if (loading && !client) {
    return <p className="page-lead">Carregando estrutura...</p>;
  }

  if (!client) {
    return (
      <p className="error" role="alert">
        {error ?? 'Cliente nao encontrado.'}
      </p>
    );
  }

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Estrutura do cliente</p>
          <h1 className="page-title">
            {client.tradeName || client.legalName}
          </h1>
          <p className="page-lead">
            Setores, funcoes/cargos e riscos ocupacionais. Preparacao para PGRO
            e trabalhadores.
          </p>
        </div>
        <div className="header-actions header-actions--wrap">
          <Link className="btn btn-secondary" href={`/clientes/${clientId}`}>
            Voltar ao cliente
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void onSuggestRisks()}
          >
            Gerar riscos comuns
          </button>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="quota-summary" aria-label="Resumo">
        <div className="quota-summary-item">
          <span className="quota-summary-label">Unidades</span>
          <strong className="quota-summary-value">{units.length}</strong>
        </div>
        <div className="quota-summary-item">
          <span className="quota-summary-label">Setores</span>
          <strong className="quota-summary-value">{sectors.length}</strong>
        </div>
        <div className="quota-summary-item">
          <span className="quota-summary-label">Funcoes</span>
          <strong className="quota-summary-value">{jobs.length}</strong>
        </div>
        <div className="quota-summary-item">
          <span className="quota-summary-label">Riscos catalogo</span>
          <strong className="quota-summary-value">{risks.length}</strong>
        </div>
      </section>

      <div className="form-grid" style={{ marginBottom: '1rem' }}>
        <div className="field">
          <label htmlFor="filter-sector">Filtrar setor</label>
          <select
            id="filter-sector"
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
          >
            <option value="">Todos</option>
            {sectors.map((sector) => (
              <option key={sector.id} value={sector.id}>
                {sector.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="show-inactive">Status</label>
          <label className="field-check" htmlFor="show-inactive">
            <input
              id="show-inactive"
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <span>Mostrar inativos</span>
          </label>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--ops">
        <section className="surface" aria-labelledby="new-sector-title">
          <h2 id="new-sector-title" className="page-title page-title--sm">
            Novo setor
          </h2>
          <form className="form" onSubmit={onCreateSector}>
            <div className="field">
              <label htmlFor="sector-name">Nome</label>
              <input
                id="sector-name"
                required
                minLength={2}
                value={sectorName}
                onChange={(e) => setSectorName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="sector-unit">Unidade (opcional)</label>
              <select
                id="sector-unit"
                value={sectorUnitId}
                onChange={(e) => setSectorUnitId(e.target.value)}
              >
                <option value="">Sem unidade</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="sector-desc">Descricao</label>
              <input
                id="sector-desc"
                value={sectorDesc}
                onChange={(e) => setSectorDesc(e.target.value)}
              />
            </div>
            {sectorError ? (
              <p className="error" role="alert">
                {sectorError}
              </p>
            ) : null}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={sectorSaving}
            >
              {sectorSaving ? 'Salvando...' : 'Cadastrar setor'}
            </button>
          </form>
        </section>

        <section className="surface" aria-labelledby="new-job-title">
          <h2 id="new-job-title" className="page-title page-title--sm">
            Nova funcao
          </h2>
          <form className="form" onSubmit={onCreateJob}>
            <div className="field">
              <label htmlFor="job-sector">Setor</label>
              <select
                id="job-sector"
                required
                value={jobSectorId}
                onChange={(e) => setJobSectorId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {sectors
                  .filter((s) => s.isActive)
                  .map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="job-name">Nome da funcao</label>
              <input
                id="job-name"
                required
                minLength={2}
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="job-desc">Descricao</label>
              <input
                id="job-desc"
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="job-env">Ambiente / descricao do local</label>
              <input
                id="job-env"
                value={jobEnv}
                onChange={(e) => setJobEnv(e.target.value)}
              />
            </div>
            {jobError ? (
              <p className="error" role="alert">
                {jobError}
              </p>
            ) : null}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={jobSaving || sectors.length === 0}
            >
              {jobSaving ? 'Salvando...' : 'Cadastrar funcao'}
            </button>
          </form>
        </section>
      </div>

      {filteredSectors.length === 0 ? (
        <section className="surface">
          <div className="empty-state">
            <p className="page-title page-title--sm">Nenhum setor</p>
            <p className="page-lead">
              Cadastre o primeiro setor do cliente para organizar funcoes e
              riscos.
            </p>
          </div>
        </section>
      ) : (
        filteredSectors.map((sector) => {
          const sectorJobs = jobsBySector.get(sector.id) ?? [];
          return (
            <section
              key={sector.id}
              className="surface"
              aria-labelledby={`sector-${sector.id}`}
              style={{ marginTop: '1rem' }}
            >
              <div className="form-section-header">
                <div>
                  <p className="page-kicker">Setor</p>
                  <h2
                    id={`sector-${sector.id}`}
                    className="page-title page-title--sm"
                  >
                    {sector.name}
                  </h2>
                  <p className="field-hint">
                    {sector.operationalUnit
                      ? `Unidade: ${sector.operationalUnit.name}`
                      : 'Sem unidade vinculada'}
                    {' · '}
                    {sectorJobs.length} funcao(oes)
                    {!sector.isActive ? ' · Inativo' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={() =>
                    void updateClientSectorStatus(
                      sector.id,
                      !sector.isActive,
                    ).then(load)
                  }
                >
                  {sector.isActive ? 'Inativar setor' : 'Reativar setor'}
                </button>
              </div>

              {sectorJobs.length === 0 ? (
                <p className="field-hint">
                  Nenhuma funcao neste setor. Cadastre a primeira ao lado.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Funcao</th>
                        <th scope="col">Riscos</th>
                        <th scope="col">Status</th>
                        <th scope="col">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectorJobs.map((job) => (
                        <tr key={job.id}>
                          <td>
                            <strong>{job.name}</strong>
                            {job.description ? (
                              <span className="table-sub">
                                {job.description}
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <div className="epi-need-picker">
                              {(job.risks ?? []).length === 0 ? (
                                <span className="field-hint">Sem riscos</span>
                              ) : (
                                (job.risks ?? []).map((link) => (
                                  <span
                                    key={link.id}
                                    className="status-pill status-pill--info"
                                  >
                                    {link.risk.name}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`status-pill status-pill--${
                                job.isActive ? 'active' : 'inactive'
                              }`}
                            >
                              {job.isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button
                                type="button"
                                className="btn btn-primary btn-compact"
                                onClick={() => {
                                  setSelectedJobId(job.id);
                                  setLinkError(null);
                                  setLinkRiskId('');
                                }}
                              >
                                Riscos
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-compact"
                                onClick={() =>
                                  void updateClientJobFunctionStatus(
                                    job.id,
                                    !job.isActive,
                                  ).then(load)
                                }
                              >
                                {job.isActive ? 'Inativar' : 'Reativar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="field-hint" style={{ marginTop: '0.75rem' }}>
                EPIs da funcao: disponivel em etapa futura (vinculo
                necessidade/risco).
              </p>
            </section>
          );
        })
      )}

      {selectedJob ? (
        <section className="surface" aria-labelledby="job-risks-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">Riscos da funcao</p>
              <h2 id="job-risks-title" className="page-title page-title--sm">
                {selectedJob.name}
              </h2>
              <p className="field-hint">
                Setor: {selectedJob.sector?.name ?? '—'}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedJobId(null)}
            >
              Fechar
            </button>
          </div>

          <form className="form" onSubmit={onLinkRisk}>
            <div className="form-grid">
              <div className="field field--span-2">
                <label htmlFor="link-risk">Vincular risco do catalogo</label>
                <select
                  id="link-risk"
                  required
                  value={linkRiskId}
                  onChange={(e) => setLinkRiskId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {risks.map((risk) => (
                    <option key={risk.id} value={risk.id}>
                      {risk.name} ({riskCategoryLabel(risk.category)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {linkError ? (
              <p className="error" role="alert">
                {linkError}
              </p>
            ) : null}
            <div className="btn-row">
              <button type="submit" className="btn btn-primary">
                Vincular risco
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void onSuggestRisks()}
              >
                Gerar riscos comuns
              </button>
            </div>
          </form>

          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Risco</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {(selectedJob.risks ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3}>Nenhum risco vinculado.</td>
                  </tr>
                ) : (
                  (selectedJob.risks ?? []).map((link) => (
                    <tr key={link.id}>
                      <td>
                        <strong>{link.risk.name}</strong>
                      </td>
                      <td>{riskCategoryLabel(link.risk.category)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          onClick={() => void onUnlinkRisk(link.riskId)}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function ClienteEstruturaPage() {
  const params = useParams();
  const clientId = String(params.id ?? '');
  return (
    <RequireAuth>
      {() => <EstruturaContent clientId={clientId} />}
    </RequireAuth>
  );
}
