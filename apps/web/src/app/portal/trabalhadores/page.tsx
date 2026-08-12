'use client';

import type {
  PortalEstruturaResponse,
  PortalTrabalhadorReplacementDue,
  PortalTrabalhadoresResponse,
  WorkerImportPreviewResponse,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import {
  confirmPortalWorkerCsvImport,
  createPortalWorker,
  downloadCsvText,
  fetchPortalEstrutura,
  fetchPortalTrabalhadores,
  generatePortalWorkerFacialEnrollmentLink,
  getPortalWorkerCsvTemplate,
  previewPortalWorkerCsvImport,
  resendPortalWorkerFacialEnrollmentWhatsapp,
  updatePortalWorker,
  updatePortalWorkerStatus,
} from '../../../lib/client-auth';
import { formatCpfInput, stripCpf } from '../../../lib/cpf';

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

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
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

function actionHint(
  due: PortalTrabalhadorReplacementDue,
  criticalDays: number,
) {
  if (due.overdue > 0) {
    return `Ha ${due.overdue} EPI(s) ja vencido(s). Registre a troca agora.`;
  }
  if (due.critical > 0) {
    return `${due.critical} item(ns) critico(s) nos proximos ${criticalDays} dias. Priorize a entrega.`;
  }
  return `${due.warn} item(ns) no horizonte de alerta. Planeje a troca.`;
}

function toDateInput(value: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

type PortalWorkerRow = PortalTrabalhadoresResponse['workers'][number];

function bioLabel(worker: PortalWorkerRow) {
  if (worker.hasValidBiometrics) {
    return { ok: true, text: 'Face ok' };
  }
  switch (worker.biometricStatus) {
    case 'NEEDS_REENROLLMENT':
      return { ok: false, text: 'Recadastrar face' };
    case 'INCOMPLETE':
      return { ok: false, text: 'Face incompleta' };
    case 'REVOKED':
      return { ok: false, text: 'Face revogada' };
    default:
      return { ok: false, text: 'Sem face' };
  }
}

function PortalTrabalhadoresContent() {
  const searchParams = useSearchParams();
  const filtro = searchParams.get('filtro');
  const onlyDue = filtro === 'trocas';

  const [data, setData] = useState<PortalTrabalhadoresResponse | null>(null);
  const [estrutura, setEstrutura] = useState<PortalEstruturaResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<FormMode>('closed');
  const [panel, setPanel] = useState<PanelMode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkerFormState>(emptyForm);
  const [enrollmentUrl, setEnrollmentUrl] = useState<string | null>(null);
  const [enrollmentWhatsappNotice, setEnrollmentWhatsappNotice] = useState<
    string | null
  >(null);
  const [enrollmentWhatsappOk, setEnrollmentWhatsappOk] = useState(false);
  const [enrollmentWorkerId, setEnrollmentWorkerId] = useState<string | null>(
    null,
  );
  const [enrollmentBusyFor, setEnrollmentBusyFor] = useState<string | null>(
    null,
  );
  const [linkCopied, setLinkCopied] = useState(false);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importPreview, setImportPreview] =
    useState<WorkerImportPreviewResponse | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [workersRes, estruturaRes] = await Promise.all([
        fetchPortalTrabalhadores(),
        fetchPortalEstrutura().catch(() => null),
      ]);
      setData(workersRes);
      setEstrutura(estruturaRes);
      if (onlyDue) {
        const firstDue = workersRes.workers.find((w) => w.replacementDue);
        if (firstDue) setExpandedId(firstDue.id);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar trabalhadores.',
      );
    } finally {
      setLoading(false);
    }
  }, [onlyDue]);

  useEffect(() => {
    void load();
  }, [load]);

  const sectors = estrutura?.sectors ?? [];
  const units = estrutura?.units ?? [];
  const hasStructure = sectors.length > 0;
  const jobsForSector = useMemo(() => {
    const sector = sectors.find((s) => s.id === form.clientSectorId);
    return sector?.jobs ?? [];
  }, [sectors, form.clientSectorId]);

  const workers = useMemo(() => {
    if (!data) return [];
    const base = onlyDue
      ? data.workers.filter((w) => w.replacementDue)
      : data.workers;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((w) => {
      const hay = [
        w.name,
        w.registration ?? '',
        w.role ?? '',
        w.department ?? '',
        w.unitName ?? '',
        w.sectorName ?? '',
        w.jobFunctionName ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, onlyDue, query]);

  const criticalDays = data?.replacementHorizon.criticalDays ?? 3;
  const warnDays = data?.replacementHorizon.warnDays ?? 5;

  function openCreate() {
    setPanel('list');
    setMode('create');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function openEdit(worker: PortalWorkerRow) {
    setPanel('list');
    setMode('edit');
    setEditingId(worker.id);
    setForm({
      name: worker.name,
      cpf: worker.cpf ? formatCpfInput(worker.cpf) : '',
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
  }

  function openImport() {
    setMode('closed');
    setPanel('import');
    setImportErrorClear();
    setImportFileName(null);
    setImportPreview(null);
    setImportMessage(null);
  }

  function setImportErrorClear() {
    setError(null);
  }

  function closeImport() {
    setPanel('list');
    setImportBusy(false);
    setImportPreview(null);
    setImportFileName(null);
  }

  async function onDownloadTemplate() {
    try {
      const template = await getPortalWorkerCsvTemplate();
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
    if (!file) return;
    setImportBusy(true);
    setError(null);
    setImportMessage(null);
    setImportFileName(file.name);
    try {
      const csvText = await file.text();
      const preview = await previewPortalWorkerCsvImport(csvText);
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
    if (!importPreview) return;
    const rows = importPreview.rows
      .filter((row) => row.status === 'valid' && row.payload)
      .map((row) => ({
        rowNumber: row.rowNumber,
        payload: row.payload!,
      }));
    if (rows.length === 0) {
      setError('Nenhuma linha valida para importar.');
      return;
    }
    setImportBusy(true);
    setError(null);
    try {
      const result = await confirmPortalWorkerCsvImport(rows);
      setImportMessage(
        `Importacao concluida: ${result.created} criado(s), ${result.updated} atualizado(s)` +
          (result.skipped ? `, ${result.skipped} ignorado(s).` : '.'),
      );
      setImportPreview(null);
      setImportFileName(null);
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
        await createPortalWorker({
          ...payload,
          cpf: payload.cpf ?? undefined,
          registration: payload.registration ?? undefined,
          operationalUnitId: payload.operationalUnitId ?? undefined,
          clientSectorId: payload.clientSectorId ?? undefined,
          clientJobFunctionId: payload.clientJobFunctionId ?? undefined,
          admissionDate: payload.admissionDate ?? undefined,
          notes: payload.notes ?? undefined,
        });
      } else if (mode === 'edit' && editingId) {
        await updatePortalWorker(editingId, payload);
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

  async function toggleStatus(worker: PortalWorkerRow) {
    setError(null);
    try {
      await updatePortalWorkerStatus(
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

  async function generateEnrollment(worker: PortalWorkerRow) {
    setError(null);
    setEnrollmentUrl(null);
    setEnrollmentWhatsappNotice(null);
    setEnrollmentWhatsappOk(false);
    setEnrollmentWorkerId(null);
    setLinkCopied(false);
    if (worker.hasValidBiometrics) {
      setError(
        'Este trabalhador ja tem face valida. Revogue na Consultoria se precisar recadastrar.',
      );
      return;
    }
    if (!worker.cpf || stripCpf(worker.cpf).length < 4) {
      setError('Informe o CPF do trabalhador (Editar) antes de gerar o link.');
      return;
    }
    setEnrollmentBusyFor(worker.id);
    try {
      const link = await generatePortalWorkerFacialEnrollmentLink(worker.id);
      setEnrollmentUrl(link.url);
      setEnrollmentWorkerId(worker.id);
      setEnrollmentWhatsappNotice(link.whatsappNotice);
      setEnrollmentWhatsappOk(link.whatsapp === 'SENT');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel gerar o link facial.',
      );
    } finally {
      setEnrollmentBusyFor(null);
    }
  }

  async function resendEnrollmentWhatsapp() {
    if (!enrollmentWorkerId) return;
    setError(null);
    setLinkCopied(false);
    setEnrollmentBusyFor(enrollmentWorkerId);
    try {
      const link = await resendPortalWorkerFacialEnrollmentWhatsapp(
        enrollmentWorkerId,
      );
      setEnrollmentUrl(link.url);
      setEnrollmentWhatsappNotice(link.whatsappNotice);
      setEnrollmentWhatsappOk(link.whatsapp === 'SENT');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel reenviar o WhatsApp.',
      );
    } finally {
      setEnrollmentBusyFor(null);
    }
  }

  async function copyEnrollmentUrl() {
    if (!enrollmentUrl) return;
    try {
      await navigator.clipboard.writeText(enrollmentUrl);
      setLinkCopied(true);
    } catch {
      setLinkCopied(false);
    }
  }

  return (
    <div className="portal-home">
      <header className="portal-home-header portal-home-header--decision">
        <div className="portal-home-brand">
          <h1 className="portal-home-title">Trabalhadores</h1>
          <p className="portal-home-cnpj">
            {onlyDue
              ? `Filtrado: trocas em ate ${warnDays} dias`
              : 'Cadastre vidas (individual ou planilha) e acompanhe trocas'}
          </p>
        </div>
        {mode === 'closed' && panel === 'list' ? (
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openImport}
            >
              Importar CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Novo trabalhador
            </button>
          </div>
        ) : null}
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {enrollmentUrl ? (
        <div
          className={`notice ${enrollmentWhatsappOk ? 'notice--ok' : 'notice--warn'} enroll-link-banner`}
          role="status"
        >
          <p>Link de cadastro facial gerado (valido por 24h).</p>
          {enrollmentWhatsappNotice ? (
            <p className="table-sub">{enrollmentWhatsappNotice}</p>
          ) : null}
          <div className="btn-row" style={{ marginTop: '0.5rem' }}>
            <input
              className="mono"
              readOnly
              value={enrollmentUrl}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void copyEnrollmentUrl()}
            >
              {linkCopied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void resendEnrollmentWhatsapp()}
              disabled={!enrollmentWorkerId || enrollmentBusyFor != null}
            >
              Reenviar WhatsApp
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setEnrollmentUrl(null);
                setEnrollmentWhatsappNotice(null);
                setEnrollmentWorkerId(null);
                setLinkCopied(false);
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
      {loading ? (
        <p className="page-lead">Carregando trabalhadores...</p>
      ) : null}

      {importMessage && panel === 'list' && mode === 'closed' ? (
        <p className="notice notice--ok" role="status">
          {importMessage}
        </p>
      ) : null}

      {panel === 'import' ? (
        <section className="surface" aria-labelledby="portal-worker-import-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">Lote</p>
              <h2
                id="portal-worker-import-title"
                className="page-title page-title--sm"
              >
                Importar trabalhadores
              </h2>
              <p className="page-lead">
                CSV com unidade, setor e funcao ja existentes na estrutura.
                Baixe o modelo, preencha e confirme a previa.
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
                      <th>Status</th>
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
                  disabled={importBusy || importPreview.totals.valid === 0}
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
        <section className="surface" aria-labelledby="portal-worker-form-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">
                {mode === 'create' ? 'Novo cadastro' : 'Editar'}
              </p>
              <h2
                id="portal-worker-form-title"
                className="page-title page-title--sm"
              >
                {mode === 'create' ? 'Novo trabalhador' : 'Editar trabalhador'}
              </h2>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeForm}
            >
              Cancelar
            </button>
          </div>
          <form
            className="form-panel"
            onSubmit={(e) => void onSubmit(e)}
            noValidate
          >
            <div className="form-grid">
              <div className="field">
                <label htmlFor="portal-worker-name">Nome</label>
                <input
                  id="portal-worker-name"
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="portal-worker-cpf">CPF</label>
                <input
                  id="portal-worker-cpf"
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
                <label htmlFor="portal-worker-registration">Matricula</label>
                <input
                  id="portal-worker-registration"
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
                <label htmlFor="portal-worker-unit">Unidade</label>
                <select
                  id="portal-worker-unit"
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
                <label htmlFor="portal-worker-sector">Setor</label>
                <select
                  id="portal-worker-sector"
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
                  {sectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="portal-worker-job">Funcao</label>
                <select
                  id="portal-worker-job"
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
                <label htmlFor="portal-worker-admission">Admissao</label>
                <input
                  id="portal-worker-admission"
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
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="portal-worker-notes">Observacoes</label>
                <textarea
                  id="portal-worker-notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
            </div>
            {formError ? (
              <p className="error" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="btn-row">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Salvando...'
                  : mode === 'create'
                    ? 'Cadastrar'
                    : 'Salvar'}
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

      {data && mode === 'closed' && panel === 'list' ? (
        <>
          <section
            className="quota-summary quota-summary--compact"
            aria-label="Resumo"
          >
            <div className="quota-summary-item">
              <span className="quota-summary-label">Vidas</span>
              <strong className="quota-summary-value">
                {data.lives.used}/{data.lives.allocated}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Com troca</span>
              <strong className="quota-summary-value">
                {data.summary.withReplacementDue}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Horizonte</span>
              <strong className="quota-summary-value">
                {criticalDays}/{warnDays}d
              </strong>
            </div>
          </section>

          <div className="btn-row" style={{ marginBottom: '0.75rem' }}>
            {onlyDue ? (
              <Link className="btn btn-secondary" href="/portal/trabalhadores">
                Ver todos
              </Link>
            ) : data.summary.withReplacementDue > 0 ? (
              <Link
                className="btn btn-primary"
                href="/portal/trabalhadores?filtro=trocas"
              >
                Abrir fila de trocas ({data.summary.withReplacementDue})
              </Link>
            ) : null}
            <Link className="btn btn-secondary" href="/portal/entregas">
              Nova entrega
            </Link>
          </div>

          {data.workers.length > 0 ? (
            <div className="client-search">
              <label htmlFor="portal-worker-search" className="field-hint">
                Buscar trabalhador
              </label>
              <input
                id="portal-worker-search"
                type="search"
                placeholder="Nome, matricula, funcao..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          ) : null}

          <section className="portal-worker-list" aria-label="Lista">
            {workers.length === 0 ? (
              <div className="empty-state">
                <p className="page-lead">
                  {onlyDue
                    ? 'Nenhum trabalhador com EPI vencendo no horizonte.'
                    : query
                      ? `Nenhum resultado para "${query}".`
                      : 'Nenhum trabalhador cadastrado para esta empresa.'}
                </p>
                {query ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setQuery('')}
                  >
                    Limpar busca
                  </button>
                ) : !onlyDue ? (
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
                ) : null}
              </div>
            ) : (
              workers.map((worker) => {
                const due = worker.replacementDue;
                const expanded = expandedId === worker.id;
                const urgentCount = due ? due.overdue + due.critical : 0;
                const bio = bioLabel(worker);

                return (
                  <article
                    key={worker.id}
                    className={`portal-worker-card${due ? ` portal-worker-card--${due.tone}` : ''}`}
                  >
                    <header className="portal-worker-card__header">
                      <div className="portal-worker-card__identity">
                        <h2 className="portal-worker-card__name">
                          {worker.name}
                        </h2>
                        <p className="portal-worker-card__meta">
                          <span className="mono">
                            {worker.registration ?? 'Sem matricula'}
                          </span>
                          {' · '}
                          {worker.jobFunctionName ||
                            worker.role ||
                            worker.department ||
                            'Sem funcao'}
                          {worker.needsReallocation
                            ? ' · funcao arquivada — realoque'
                            : ''}
                          {worker.unitName ? ` · ${worker.unitName}` : ''}
                        </p>
                      </div>
                      <div className="portal-worker-card__flags">
                        <span
                          className={`status-pill status-pill--${
                            worker.status === 'ACTIVE' ? 'active' : 'inactive'
                          }`}
                        >
                          {worker.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                        </span>
                        {worker.needsReallocation ? (
                          <span className="status-pill status-pill--warn">
                            Realocar
                          </span>
                        ) : null}
                        <span
                          className={`status-pill ${
                            bio.ok ? 'status-pill--active' : 'status-pill--warn'
                          }`}
                        >
                          {bio.text}
                        </span>
                        {due ? (
                          <span
                            className={`status-pill ${
                              due.tone === 'critical'
                                ? 'status-pill--critical'
                                : 'status-pill--warn'
                            }`}
                          >
                            {due.tone === 'critical'
                              ? `Urgente · ${due.count}`
                              : `Proxima · ${due.count}`}
                          </span>
                        ) : null}
                      </div>
                    </header>

                    {due ? (
                      <p className="portal-worker-card__hint" role="status">
                        {actionHint(due, criticalDays)}
                        {urgentCount > 0
                          ? ` · ${urgentCount} prioritario(s)`
                          : ''}
                      </p>
                    ) : null}

                    <div className="portal-worker-card__actions">
                      {due ? (
                        <>
                          <Link
                            className="btn btn-primary"
                            href={`/portal/entregas?worker=${worker.id}`}
                          >
                            Registrar troca
                          </Link>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() =>
                              setExpandedId(expanded ? null : worker.id)
                            }
                            aria-expanded={expanded}
                          >
                            {expanded
                              ? 'Ocultar itens'
                              : `Ver ${due.count} EPI(s)`}
                          </button>
                        </>
                      ) : null}
                      {!bio.ok ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={enrollmentBusyFor === worker.id}
                          onClick={() => void generateEnrollment(worker)}
                        >
                          {enrollmentBusyFor === worker.id
                            ? 'Gerando...'
                            : 'Link facial'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => openEdit(worker)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void toggleStatus(worker)}
                      >
                        {worker.status === 'ACTIVE' ? 'Inativar' : 'Ativar'}
                      </button>
                      <Link
                        className="btn btn-secondary"
                        href={`/portal/trabalhadores/${worker.id}/ficha-epi`}
                      >
                        Ficha de EPI
                      </Link>
                    </div>

                    {due && expanded ? (
                      <ul className="portal-worker-card__items">
                        {due.items.map((item) => (
                          <li key={item.id}>
                            <strong>{item.epiName}</strong>
                            {item.caNumber ? ` · CA ${item.caNumber}` : ''}
                            {' · '}
                            {daysLabel(item.daysRemaining)}
                            {' · '}
                            {formatDate(item.nextReplacementAt)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                );
              })
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function PortalTrabalhadoresPage() {
  return (
    <RequireClientAuth>
      {() => (
        <Suspense
          fallback={<p className="page-lead">Carregando trabalhadores...</p>}
        >
          <PortalTrabalhadoresContent />
        </Suspense>
      )}
    </RequireClientAuth>
  );
}
