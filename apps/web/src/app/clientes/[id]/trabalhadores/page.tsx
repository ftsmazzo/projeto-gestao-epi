'use client';

import type {
  ClientJobFunction,
  ClientLifeSummary,
  ClientSector,
  JobFunctionEpiRequirement,
  OperationalUnit,
  WorkerFacialEnrollmentLinkGenerated,
  WorkerImportPreviewResponse,
  WorkerListItem,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  listClientJobFunctions,
  listClientSectors,
  listJobFunctionEpiRequirements,
} from '../../../../lib/client-structure';
import { formatCpf, formatCpfInput, stripCpf } from '../../../../lib/cpf';
import { readCsvFileForImport } from '../../../../lib/csv-file';
import { listOperationalUnits } from '../../../../lib/operational-units';
import {
  confirmWorkerCsvImport,
  createWorker,
  downloadCsvText,
  generateWorkerFacialEnrollmentLink,
  getClientLifeSummary,
  getWorkerCsvTemplate,
  listWorkers,
  previewWorkerCsvImport,
  updateWorker,
  updateWorkerStatus,
} from '../../../../lib/workers';
import { WorkerFacialReferencePanel } from '../../../../components/WorkerFacialReferencePanel';

function biometricStatusLabel(worker: WorkerListItem): {
  label: string;
  ok: boolean;
  title: string;
} {
  switch (worker.biometricStatus) {
    case 'OK':
      return {
        label: 'Biometria ok',
        ok: true,
        title: 'Template e foto de referencia disponiveis',
      };
    case 'OK_MISSING_IMAGE':
      return {
        label: 'Biometria ok (sem foto)',
        ok: true,
        title:
          'Matching ativo. Foto de referencia ausente no storage — recadastre se precisar exibir a imagem.',
      };
    case 'NEEDS_REENROLLMENT':
      return {
        label: 'Recadastrar biometria',
        ok: false,
        title: 'Biometria desatualizada ou incompleta. Gere um novo link facial.',
      };
    case 'REVOKED':
      return {
        label: 'Biometria revogada',
        ok: false,
        title: 'Biometria revogada. Gere um novo link facial.',
      };
    case 'INCOMPLETE':
      return {
        label: 'Biometria incompleta',
        ok: false,
        title: 'Cadastro facial incompleto. Gere um novo link facial.',
      };
    default:
      return {
        label: 'Sem biometria',
        ok: false,
        title: 'Nenhuma biometria cadastrada',
      };
  }
}

type FormMode = 'closed' | 'create' | 'edit';
type PanelMode = 'list' | 'import';

type WorkerFormState = {
  name: string;
  cpf: string;
  registration: string;
  operationalUnitId: string;
  clientSectorId: string;
  clientJobFunctionId: string;
  admissionDate: string;
  notes: string;
};

const emptyForm: WorkerFormState = {
  name: '',
  cpf: '',
  registration: '',
  operationalUnitId: '',
  clientSectorId: '',
  clientJobFunctionId: '',
  admissionDate: '',
  notes: '',
};

function toDateInput(value: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function ClienteTrabalhadoresPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  const [workers, setWorkers] = useState<WorkerListItem[]>([]);
  const [units, setUnits] = useState<OperationalUnit[]>([]);
  const [sectors, setSectors] = useState<ClientSector[]>([]);
  const [jobs, setJobs] = useState<ClientJobFunction[]>([]);
  const [epiPreview, setEpiPreview] = useState<JobFunctionEpiRequirement[]>(
    [],
  );
  const [lifeSummary, setLifeSummary] = useState<ClientLifeSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdEnrollmentLink, setCreatedEnrollmentLink] =
    useState<WorkerFacialEnrollmentLinkGenerated | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [generatingLinkFor, setGeneratingLinkFor] = useState<string | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [mode, setMode] = useState<FormMode>('closed');
  const [panel, setPanel] = useState<PanelMode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkerFormState>(emptyForm);
  const [workerQuery, setWorkerQuery] = useState('');
  const [bioFilter, setBioFilter] = useState<'all' | 'pending' | 'ok'>('all');

  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importPreview, setImportPreview] =
    useState<WorkerImportPreviewResponse | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const activeSectors = useMemo(
    () => sectors.filter((sector) => sector.isActive),
    [sectors],
  );
  const jobsForSector = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.isActive &&
          (!form.clientSectorId || job.sectorId === form.clientSectorId),
      ),
    [jobs, form.clientSectorId],
  );
  const hasStructure = activeSectors.length > 0;

  const filteredWorkers = useMemo(() => {
    const q = workerQuery.trim().toLowerCase();
    return workers.filter((worker) => {
      const bio = biometricStatusLabel(worker);
      if (bioFilter === 'ok' && !bio.ok) return false;
      if (bioFilter === 'pending' && bio.ok) return false;
      if (!q) return true;
      const hay = [
        worker.name,
        worker.registration ?? '',
        worker.cpf ?? '',
        worker.unitName ?? '',
        worker.sectorName ?? '',
        worker.jobFunctionName ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [workers, workerQuery, bioFilter]);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const [workerList, unitList, lives, sectorList, jobList] =
        await Promise.all([
          listWorkers(clientId),
          listOperationalUnits(clientId),
          getClientLifeSummary(clientId),
          listClientSectors(clientId, 'all'),
          listClientJobFunctions({
            servedClientId: clientId,
            status: 'all',
          }),
        ]);
      setWorkers(workerList);
      setUnits(unitList);
      setLifeSummary(lives);
      setSectors(sectorList);
      setJobs(jobList);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar trabalhadores.',
      );
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!form.clientJobFunctionId) {
      setEpiPreview([]);
      return;
    }
    let cancelled = false;
    void listJobFunctionEpiRequirements(form.clientJobFunctionId)
      .then((rows) => {
        if (!cancelled) {
          setEpiPreview(rows.filter((row) => row.isActive));
        }
      })
      .catch(() => {
        if (!cancelled) setEpiPreview([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.clientJobFunctionId]);

  function openCreate() {
    setPanel('list');
    setMode('create');
    setEditingId(null);
    setForm({
      ...emptyForm,
      operationalUnitId:
        units.find((unit) => unit.name.toLowerCase() === 'matriz')?.id ??
        units[0]?.id ??
        '',
    });
    setFormError(null);
  }

  function openEdit(worker: WorkerListItem) {
    setPanel('list');
    setMode('edit');
    setEditingId(worker.id);
    setForm({
      name: worker.name,
      cpf: worker.cpf ? formatCpf(worker.cpf) : '',
      registration: worker.registration ?? '',
      operationalUnitId: worker.operationalUnitId ?? '',
      clientSectorId: worker.clientSectorId ?? '',
      clientJobFunctionId: worker.clientJobFunctionId ?? '',
      admissionDate: toDateInput(worker.admissionDate),
      notes: worker.notes ?? '',
    });
    setFormError(null);
  }

  function closeForm() {
    setMode('closed');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setEpiPreview([]);
  }

  function openImport() {
    setMode('closed');
    setPanel('import');
    setImportPreview(null);
    setImportFileName(null);
    setImportMessage(null);
    setError(null);
  }

  function closeImport() {
    setPanel('list');
    setImportPreview(null);
    setImportFileName(null);
    setImportMessage(null);
  }

  async function onDownloadTemplate() {
    if (!clientId) return;
    setImportMessage(null);
    try {
      const template = await getWorkerCsvTemplate(clientId);
      downloadCsvText(template.fileName, template.csvText);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel baixar o modelo CSV.',
      );
    }
  }

  async function onPreviewFile(file: File | null) {
    if (!clientId || !file) return;
    setImportBusy(true);
    setImportMessage(null);
    setError(null);
    setImportFileName(file.name);
    try {
      const filePayload = await readCsvFileForImport(file);
      const preview = await previewWorkerCsvImport(clientId, {
        csvBase64: filePayload.csvBase64,
        csvText: filePayload.csvText,
      });
      setImportPreview(preview);
    } catch (err) {
      setImportPreview(null);
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao gerar previa da importacao.',
      );
    } finally {
      setImportBusy(false);
    }
  }

  async function onConfirmImport() {
    if (!clientId || !importPreview) return;
    const rows = importPreview.rows
      .filter((row) => row.status === 'valid' && row.payload)
      .map((row) => ({
        rowNumber: row.rowNumber,
        payload: row.payload!,
      }));
    if (rows.length === 0) {
      setError('Nenhuma linha valida para confirmar.');
      return;
    }
    setImportBusy(true);
    setError(null);
    setImportMessage(null);
    try {
      const result = await confirmWorkerCsvImport(clientId, rows);
      setImportMessage(
        `Importacao concluida: ${result.created} criado(s), ${result.updated} atualizado(s)` +
          (result.skipped ? `, ${result.skipped} ignorado(s).` : '.'),
      );
      setImportPreview(null);
      setImportFileName(null);
      setLifeSummary(result.lifeSummary);
      await load();
      setPanel('list');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao confirmar a importacao.',
      );
    } finally {
      setImportBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!clientId) return;
    setFormError(null);

    if (hasStructure && !form.clientSectorId) {
      setFormError('Selecione o setor da estrutura.');
      return;
    }
    if (hasStructure && !form.clientJobFunctionId) {
      setFormError('Selecione a funcao da estrutura.');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      cpf: stripCpf(form.cpf) || null,
      registration: form.registration.trim() || null,
      operationalUnitId:
        units.length === 0 ? null : form.operationalUnitId || null,
      clientSectorId: form.clientSectorId || null,
      clientJobFunctionId: form.clientJobFunctionId || null,
      admissionDate: form.admissionDate || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (mode === 'create') {
        const created = await createWorker(clientId, {
          ...payload,
          cpf: payload.cpf ?? undefined,
          registration: payload.registration ?? undefined,
          operationalUnitId: payload.operationalUnitId ?? undefined,
          clientSectorId: payload.clientSectorId ?? undefined,
          clientJobFunctionId: payload.clientJobFunctionId ?? undefined,
          admissionDate: payload.admissionDate ?? undefined,
          notes: payload.notes ?? undefined,
        });
        setCreatedEnrollmentLink(created.facialEnrollmentLink);
        setLinkCopied(false);
      } else if (mode === 'edit' && editingId) {
        await updateWorker(editingId, payload);
        setCreatedEnrollmentLink(null);
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Nao foi possivel salvar.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function generateLinkFromList(worker: WorkerListItem) {
    setError(null);
    if (worker.hasValidBiometrics) {
      setError(
        'Este trabalhador ja possui biometria valida. Revogue a biometria em Editar antes de gerar um novo link.',
      );
      return;
    }
    setGeneratingLinkFor(worker.id);
    setLinkCopied(false);
    try {
      if (!worker.cpf || stripCpf(worker.cpf).length < 4) {
        throw new Error(
          'Informe o CPF do trabalhador (Editar) antes de gerar o link.',
        );
      }
      const link = await generateWorkerFacialEnrollmentLink(worker.id);
      setCreatedEnrollmentLink(link);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel gerar o link facial.',
      );
    } finally {
      setGeneratingLinkFor(null);
    }
  }

  async function toggleStatus(worker: WorkerListItem) {
    setError(null);
    try {
      await updateWorkerStatus(
        worker.id,
        worker.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel atualizar o status.',
      );
    }
  }

  return (
    <div className="workspace-section">
      {lifeSummary ? (
        <section className="quota-summary" aria-label="Vidas">
          <div className="quota-summary-item">
            <span className="quota-summary-label">Cota alocada</span>
            <strong className="quota-summary-value">
              {lifeSummary.allocated}
            </strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Vidas usadas</span>
            <strong className="quota-summary-value">{lifeSummary.used}</strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Disponiveis</span>
            <strong className="quota-summary-value">
              {lifeSummary.available}
            </strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Ativos</span>
            <strong className="quota-summary-value">
              {lifeSummary.activeWorkers}
            </strong>
          </div>
        </section>
      ) : null}

      {panel === 'import' ? (
        <section className="surface" aria-labelledby="worker-import-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">Lote</p>
              <h2 id="worker-import-title" className="page-title page-title--sm">
                Importar trabalhadores
              </h2>
              <p className="page-lead">
                CSV com unidade, setor e funcao ja existentes na estrutura do
                cliente. EPIs necessarios vem da funcao (sem copia fixa).
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeImport}
              disabled={importBusy}
            >
              Voltar
            </button>
          </div>

          <div className="btn-row" style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void onDownloadTemplate()}
              disabled={importBusy}
            >
              Baixar modelo CSV
            </button>
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              {importBusy ? 'Processando...' : 'Selecionar CSV'}
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                disabled={importBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  void onPreviewFile(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {importFileName ? (
            <p className="field-hint">Arquivo: {importFileName}</p>
          ) : null}
          {importMessage ? (
            <p className="notice notice--info" role="status">
              {importMessage}
            </p>
          ) : null}
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}

          {importPreview ? (
            <>
              {importPreview.warnings.length > 0 ? (
                <ul className="page-lead">
                  {importPreview.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}

              <section className="quota-summary" aria-label="Impacto na cota">
                <div className="quota-summary-item">
                  <span className="quota-summary-label">Linhas lidas</span>
                  <strong className="quota-summary-value">
                    {importPreview.totals.rowsRead}
                  </strong>
                </div>
                <div className="quota-summary-item">
                  <span className="quota-summary-label">Validas</span>
                  <strong className="quota-summary-value">
                    {importPreview.totals.valid}
                  </strong>
                </div>
                <div className="quota-summary-item">
                  <span className="quota-summary-label">Com erro</span>
                  <strong className="quota-summary-value">
                    {importPreview.totals.withErrors}
                  </strong>
                </div>
                <div className="quota-summary-item">
                  <span className="quota-summary-label">Novos / updates</span>
                  <strong className="quota-summary-value">
                    {importPreview.totals.creates} /{' '}
                    {importPreview.totals.updates}
                  </strong>
                </div>
                <div className="quota-summary-item">
                  <span className="quota-summary-label">Excedem cota</span>
                  <strong className="quota-summary-value">
                    {importPreview.totals.exceedQuota}
                  </strong>
                </div>
                <div className="quota-summary-item">
                  <span className="quota-summary-label">Vidas apos</span>
                  <strong className="quota-summary-value">
                    {importPreview.lifeImpact.availableAfter} disp.
                  </strong>
                </div>
              </section>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>Nome</th>
                      <th>Acao</th>
                      <th>Setor / Funcao</th>
                      <th>EPIs</th>
                      <th>Status linha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="mono">{row.rowNumber}</td>
                        <td>
                          <strong>
                            {row.payload?.name ??
                              row.raw.nome ??
                              row.raw.name ??
                              '—'}
                          </strong>
                          <span className="table-sub">
                            {row.payload?.registration ??
                              row.raw.matricula ??
                              '—'}
                          </span>
                        </td>
                        <td>
                          {row.action === 'create'
                            ? 'Novo'
                            : row.action === 'update'
                              ? `Atualizar (${row.matchBy ?? '—'})`
                              : '—'}
                        </td>
                        <td>
                          {row.resolved.sectorName ?? '—'}
                          <span className="table-sub">
                            {row.resolved.jobFunctionName ?? '—'}
                          </span>
                        </td>
                        <td className="mono">
                          {row.resolved.requiredEpiCount}
                        </td>
                        <td>
                          {row.status === 'valid' ? (
                            <span className="status-pill status-pill--active">
                              Valida
                            </span>
                          ) : (
                            <span className="status-pill status-pill--inactive">
                              Erro
                            </span>
                          )}
                          {row.errors.length > 0 ? (
                            <span className="table-sub">
                              {row.errors.join(' · ')}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="btn-row" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={
                    importBusy || importPreview.totals.valid === 0
                  }
                  onClick={() => void onConfirmImport()}
                >
                  {importBusy
                    ? 'Confirmando...'
                    : `Confirmar importacao (${importPreview.totals.valid})`}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={importBusy}
                  onClick={closeImport}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {mode !== 'closed' ? (
        <section className="surface" aria-labelledby="worker-form-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">
                {mode === 'create' ? 'Novo cadastro' : 'Editar'}
              </p>
              <h2 id="worker-form-title" className="page-title page-title--sm">
                {mode === 'create' ? 'Novo trabalhador' : 'Editar trabalhador'}
              </h2>
            </div>
            <button type="button" className="btn btn-secondary" onClick={closeForm}>
              Cancelar
            </button>
          </div>
          <form className="form-panel" onSubmit={onSubmit} noValidate>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="worker-name">Nome</label>
                <input
                  id="worker-name"
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="worker-cpf">CPF</label>
                <input
                  id="worker-cpf"
                  value={form.cpf}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      cpf: formatCpfInput(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="worker-registration">Matricula</label>
                <input
                  id="worker-registration"
                  value={form.registration}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      registration: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="worker-unit">Unidade</label>
                <select
                  id="worker-unit"
                  value={form.operationalUnitId}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      operationalUnitId: e.target.value,
                    }))
                  }
                >
                  <option value="">Sem unidade</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                      {unit.code ? ` (${unit.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="worker-sector">Setor</label>
                <select
                  id="worker-sector"
                  value={form.clientSectorId}
                  disabled={!hasStructure}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      clientSectorId: e.target.value,
                      clientJobFunctionId: '',
                    }))
                  }
                >
                  <option value="">
                    {hasStructure ? 'Selecione o setor' : 'Sem estrutura'}
                  </option>
                  {activeSectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="worker-job">Funcao</label>
                <select
                  id="worker-job"
                  value={form.clientJobFunctionId}
                  disabled={!form.clientSectorId}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      clientJobFunctionId: e.target.value,
                    }))
                  }
                >
                  <option value="">
                    {form.clientSectorId
                      ? 'Selecione a funcao'
                      : 'Selecione o setor antes'}
                  </option>
                  {jobsForSector.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="worker-admission">Admissao</label>
                <input
                  id="worker-admission"
                  type="date"
                  value={form.admissionDate}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      admissionDate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {!hasStructure ? (
              <div className="notice notice--warn" role="status">
                <p>
                  Este cliente ainda nao tem setores/funcoes na estrutura. Sem
                  funcao, o trabalhador <strong>nao herdara EPIs</strong>.
                </p>
                <div className="btn-row">
                  <Link
                    className="btn btn-secondary btn-compact"
                    href={`/clientes/${clientId}/estrutura`}
                  >
                    Configurar estrutura
                  </Link>
                  <Link
                    className="btn btn-secondary btn-compact"
                    href={`/clientes/${clientId}/atualizar-pgro`}
                  >
                    Importar PGR
                  </Link>
                </div>
              </div>
            ) : null}

            {form.clientJobFunctionId ? (
              <div className="notice notice--info" role="status">
                <p>
                  EPIs herdados da funcao:{' '}
                  <strong>{epiPreview.length}</strong>
                </p>
                {epiPreview.length > 0 ? (
                  <ul className="page-lead">
                    {epiPreview.slice(0, 8).map((req) => (
                      <li key={req.id}>
                        {req.epiNeed?.name ?? req.epiNeedId}
                        {req.isRequired ? '' : ' (opcional)'}
                      </li>
                    ))}
                    {epiPreview.length > 8 ? (
                      <li>… e mais {epiPreview.length - 8}</li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="field-hint">
                    Nenhuma necessidade de EPI ativa nesta funcao.
                  </p>
                )}
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="worker-notes">Observacoes</label>
              <textarea
                id="worker-notes"
                rows={3}
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>

            {mode === 'edit' && editingId ? (
              <div className="face-enroll-host">
                <WorkerFacialReferencePanel
                  workerId={editingId}
                  workerName={form.name.trim() || 'Trabalhador'}
                />
              </div>
            ) : null}

            {formError ? (
              <p className="error" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="btn-row">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeForm}
                disabled={saving}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {createdEnrollmentLink ? (
        <section
          className="notice notice--info enroll-link-banner"
          role="status"
        >
          <p>
            <strong>Link de cadastro facial gerado</strong> (valido 24h). O
            trabalhador usara os 4 ultimos digitos do CPF.
          </p>
          <div className="field">
            <label htmlFor="created-enroll-link">Copie e envie ao trabalhador</label>
            <input
              id="created-enroll-link"
              readOnly
              value={createdEnrollmentLink.url}
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                void navigator.clipboard
                  .writeText(createdEnrollmentLink.url)
                  .then(() => setLinkCopied(true))
                  .catch(() => setError('Nao foi possivel copiar o link.'));
              }}
            >
              {linkCopied ? 'Copiado' : 'Copiar link'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setCreatedEnrollmentLink(null);
                setLinkCopied(false);
              }}
            >
              Fechar
            </button>
          </div>
        </section>
      ) : null}

      {panel === 'list' ? (
        <section className="surface" aria-labelledby="workers-list-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">Vidas</p>
              <h2 id="workers-list-title" className="page-title page-title--sm">
                Trabalhadores
              </h2>
              <p className="page-lead">
                Cada trabalhador ativo consome 1 vida da cota alocada. Importacao
                e cadastro sao da Consultoria; o portal do cliente so consulta.
              </p>
            </div>
            {mode === 'closed' ? (
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={openImport}
                >
                  Importar trabalhadores
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openCreate}
                >
                  Novo trabalhador
                </button>
              </div>
            ) : null}
          </div>

          {error && panel === 'list' ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          {importMessage && panel === 'list' ? (
            <p className="notice notice--info" role="status">
              {importMessage}
            </p>
          ) : null}

          {loading ? (
            <p className="page-lead">Carregando...</p>
          ) : workers.length === 0 ? (
            <div className="empty-state">
              <p className="page-title page-title--sm">
                Nenhum trabalhador cadastrado
              </p>
              <p className="page-lead">
                Importe um CSV ou cadastre a primeira vida. Cada ativo consome
                1 vaga da cota.
              </p>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={openImport}
                >
                  Importar CSV
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openCreate}
                >
                  Cadastrar primeiro trabalhador
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="client-search">
                <label htmlFor="worker-search" className="field-hint">
                  Buscar trabalhador
                </label>
                <input
                  id="worker-search"
                  type="search"
                  placeholder="Nome, matricula, CPF, setor..."
                  value={workerQuery}
                  onChange={(e) => setWorkerQuery(e.target.value)}
                />
              </div>
              <div
                className="portal-section-tabs"
                role="tablist"
                aria-label="Filtro de biometria"
              >
                <button
                  type="button"
                  role="tab"
                  className={`portal-section-tab ${bioFilter === 'all' ? 'is-active' : ''}`}
                  aria-selected={bioFilter === 'all'}
                  onClick={() => setBioFilter('all')}
                >
                  Todos
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`portal-section-tab ${bioFilter === 'pending' ? 'is-active' : ''}`}
                  aria-selected={bioFilter === 'pending'}
                  onClick={() => setBioFilter('pending')}
                >
                  Biometria pendente
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`portal-section-tab ${bioFilter === 'ok' ? 'is-active' : ''}`}
                  aria-selected={bioFilter === 'ok'}
                  onClick={() => setBioFilter('ok')}
                >
                  Biometria ok
                </button>
              </div>
              {filteredWorkers.length === 0 ? (
                <div className="empty-state">
                  <p className="page-lead">Nenhum trabalhador neste filtro.</p>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setWorkerQuery('');
                      setBioFilter('all');
                    }}
                  >
                    Limpar filtros
                  </button>
                </div>
              ) : (
            <div className="stack-list" role="list" aria-label="Trabalhadores">
              {filteredWorkers.map((worker) => {
                const bio = biometricStatusLabel(worker);
                return (
                <article key={worker.id} role="listitem" className="stack-card">
                  <div className="stack-card__body stack-card__body--stack">
                    <div className="stack-card__main">
                      <strong className="stack-card__title">{worker.name}</strong>
                      <p className="stack-card__meta mono">
                        {worker.registration
                          ? `Mat. ${worker.registration}`
                          : 'Sem matricula'}
                        {worker.cpf ? ` · ${formatCpf(worker.cpf)}` : ''}
                      </p>
                      <p className="stack-card__meta">
                        {worker.unitName ?? 'Sem unidade'}
                        {' · '}
                        {worker.sectorName ?? 'Sem setor'}
                      </p>
                      <p className="stack-card__meta">
                        {worker.jobFunctionName ?? 'Sem funcao'}
                        {' · '}
                        {worker.requiredEpiCount} EPI
                        {worker.requiredEpiCount === 1 ? '' : 's'}
                      </p>
                      {worker.requiredEpiNeeds.length > 0 ? (
                        <p className="stack-card__meta">
                          {worker.requiredEpiNeeds
                            .slice(0, 3)
                            .map((need) => need.name)
                            .join(', ')}
                          {worker.requiredEpiNeeds.length > 3 ? '…' : ''}
                        </p>
                      ) : null}
                      <span
                        className={`status-pill status-pill--${worker.status.toLowerCase()}`}
                        style={{ marginTop: '0.45rem' }}
                      >
                        {worker.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                      </span>
                      <span
                        className={`status-pill ${
                          bio.ok
                            ? 'status-pill--active'
                            : 'status-pill--inactive'
                        }`}
                        style={{ marginTop: '0.35rem', marginLeft: '0.35rem' }}
                        title={bio.title}
                      >
                        {bio.label}
                      </span>
                    </div>
                    <div className="stack-card__actions">
                      <button
                        type="button"
                        className={`btn ${
                          worker.hasValidBiometrics
                            ? 'btn-muted'
                            : 'btn-primary'
                        }`}
                        onClick={() => void generateLinkFromList(worker)}
                        disabled={
                          worker.hasValidBiometrics ||
                          generatingLinkFor === worker.id
                        }
                        title={
                          worker.hasValidBiometrics
                            ? 'Biometria ja cadastrada. Revogue antes de gerar novo link.'
                            : 'Gera link de 24h para o trabalhador cadastrar no celular'
                        }
                      >
                        {worker.hasValidBiometrics
                          ? 'Biometria valida'
                          : generatingLinkFor === worker.id
                            ? 'Gerando link...'
                            : 'Gerar link facial'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => openEdit(worker)}
                      >
                        Editar / biometria
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void toggleStatus(worker)}
                      >
                        {worker.status === 'ACTIVE' ? 'Inativar' : 'Reativar'}
                      </button>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
              )}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
