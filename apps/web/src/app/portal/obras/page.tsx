'use client';

import type {
  ClientPortalUser,
  ClientWorkSite,
  ClientWorkSiteImportPreview,
  PortalTrabalhadoresResponse,
} from '@gestao-epi/shared';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import { formatCnpj } from '../../../lib/cnpj';
import {
  assignPortalWorkerToObra,
  confirmPortalObrasImport,
  createPortalObra,
  downloadPortalObrasImportTemplate,
  fetchPortalObras,
  fetchPortalTrabalhadores,
  finishPortalObra,
  previewPortalObrasImport,
  updatePortalObra,
} from '../../../lib/client-auth';
import { readCsvFileForImport } from '../../../lib/csv-file';

const emptyForm = {
  name: '',
  description: '',
  cnpj: '',
  addressLine: '',
  city: '',
  state: '',
  plannedStartAt: '',
  plannedEndAt: '',
};

function formatDay(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function PortalObrasContent({ user }: { user: ClientPortalUser }) {
  const enabled = user.servedClient.obrasModeEnabled === true;
  const [sites, setSites] = useState<ClientWorkSite[]>([]);
  const [workers, setWorkers] = useState<PortalTrabalhadoresResponse['workers']>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'list' | 'form' | 'import' | 'assign'>(
    'list',
  );
  const [saving, setSaving] = useState(false);
  const [assignWorkerId, setAssignWorkerId] = useState('');
  const [assignSiteId, setAssignSiteId] = useState('');
  const [assignStart, setAssignStart] = useState('');
  const [importPreview, setImportPreview] =
    useState<ClientWorkSiteImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [list, trab] = await Promise.all([
        fetchPortalObras(),
        fetchPortalTrabalhadores(),
      ]);
      setSites(list);
      setWorkers(trab.workers.filter((w) => w.status === 'ACTIVE'));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao carregar obras.',
      );
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const endingSoon = useMemo(
    () => sites.filter((s) => s.endingSoon),
    [sites],
  );
  const activeSites = useMemo(
    () => sites.filter((s) => s.status === 'ACTIVE'),
    [sites],
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage(null);
    setError(null);
    setPanel('form');
  }

  function startEdit(site: ClientWorkSite) {
    setEditingId(site.id);
    setForm({
      name: site.name,
      description: site.description ?? '',
      cnpj: site.cnpj ?? '',
      addressLine: site.addressLine ?? '',
      city: site.city ?? '',
      state: site.state ?? '',
      plannedStartAt: site.plannedStartAt?.slice(0, 10) ?? '',
      plannedEndAt: site.plannedEndAt?.slice(0, 10) ?? '',
    });
    setMessage(null);
    setError(null);
    setPanel('form');
  }

  function closePanels() {
    setPanel('list');
    setEditingId(null);
    setForm(emptyForm);
    setImportPreview(null);
    setAssignWorkerId('');
    setAssignSiteId('');
    setAssignStart('');
  }

  if (!enabled) {
    return (
      <div className="portal-home">
        <header className="portal-home-header portal-home-header--decision">
          <div className="portal-home-brand">
            <h1 className="portal-home-title">Obras</h1>
            <p className="portal-home-cnpj">Modulo nao liberado para este cliente</p>
          </div>
        </header>
        <p className="notice notice--warn" role="status">
          O Modo Obras nao esta ativo. Solicite a liberacao a consultoria.
        </p>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      cnpj: form.cnpj.trim() || null,
      addressLine: form.addressLine.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      plannedStartAt: form.plannedStartAt || null,
      plannedEndAt: form.plannedEndAt || null,
    };
    try {
      if (editingId) {
        await updatePortalObra(editingId, payload);
        setMessage(
          'Obra atualizada. Se o ciclo atrasar, basta estender a data de fim.',
        );
      } else {
        await createPortalObra(payload);
        setMessage('Obra cadastrada.');
      }
      closePanels();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar obra.');
    } finally {
      setSaving(false);
    }
  }

  async function onFinish(id: string, name: string) {
    if (
      !window.confirm(
        `Finalizar a obra "${name}" hoje? Trabalhadores vinculados serao liberados com data final de hoje. A obra nao encerra sozinha por data prevista.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await finishPortalObra(id);
      setMessage(`Obra "${name}" finalizada.`);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao finalizar obra.',
      );
    }
  }

  async function onAssign(e: FormEvent) {
    e.preventDefault();
    if (!assignWorkerId || !assignSiteId) return;
    setSaving(true);
    setError(null);
    try {
      await assignPortalWorkerToObra({
        workerId: assignWorkerId,
        workSiteId: assignSiteId,
        startAt: assignStart || undefined,
      });
      setMessage('Trabalhador vinculado a obra (uma obra por vez).');
      closePanels();
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao vincular trabalhador.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    setImportBusy(true);
    setError(null);
    setImportPreview(null);
    try {
      const payload = await readCsvFileForImport(file);
      const preview = await previewPortalObrasImport(payload);
      setImportPreview(preview);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha na previa da planilha.',
      );
    } finally {
      setImportBusy(false);
    }
  }

  async function onConfirmImport() {
    if (!importPreview) return;
    setImportBusy(true);
    setError(null);
    try {
      const lines = [
        'nome,descricao,cnpj,endereco,cidade,uf,inicio,fim',
        ...importPreview.rows
          .filter((r) => r.errors.length === 0)
          .map((r) =>
            [
              r.name,
              r.description ?? '',
              r.cnpj ?? '',
              r.addressLine ?? '',
              r.city ?? '',
              r.state ?? '',
              r.plannedStartAt ?? '',
              r.plannedEndAt ?? '',
            ]
              .map((v) => `"${String(v).replace(/"/g, '""')}"`)
              .join(','),
          ),
      ];
      const result = await confirmPortalObrasImport({
        csvText: lines.join('\n'),
      });
      setMessage(`${result.created} obra(s) importada(s).`);
      setImportPreview(null);
      closePanels();
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao confirmar importacao.',
      );
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div className="portal-home">
      <header className="portal-home-header portal-home-header--decision">
        <div className="portal-home-brand">
          <h1 className="portal-home-title">Obras</h1>
          <p className="portal-home-cnpj">
            Canteiros informativos para a ficha de EPI · fim previsto nao encerra
            sozinho
          </p>
        </div>
        {panel === 'list' ? (
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setImportPreview(null);
                setPanel('import');
              }}
            >
              Importar CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setAssignWorkerId('');
                setAssignSiteId('');
                setAssignStart('');
                setPanel('assign');
              }}
              disabled={activeSites.length === 0 || workers.length === 0}
            >
              Vincular trabalhador
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreate}
            >
              Nova obra
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={closePanels}
          >
            Voltar a lista
          </button>
        )}
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="notice notice--info" role="status">
          {message}
        </p>
      ) : null}

      {panel === 'list' && endingSoon.length > 0 ? (
        <p className="notice notice--warn" role="status">
          <strong>Lembrete:</strong> {endingSoon.length} obra(s) com ciclo a
          menos de 15 dias. Estenda a data de fim ou finalize manualmente — nada
          encerra sozinho.
          {' '}
          {endingSoon.map((s) => s.name).join(', ')}.
        </p>
      ) : null}

      {panel === 'form' ? (
        <section className="surface" aria-labelledby="obras-form-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">
                {editingId ? 'Editar' : 'Novo cadastro'}
              </p>
              <h2 id="obras-form-title" className="page-title page-title--sm">
                {editingId ? 'Editar obra' : 'Nova obra'}
              </h2>
              <p className="page-lead">
                Nome obrigatorio. CNPJ, endereco e datas sao opcionais. Para
                atrasar o fim, edite a data prevista.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closePanels}
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
                <label htmlFor="obra-name">Nome</label>
                <input
                  id="obra-name"
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="obra-description">Descricao</label>
                <input
                  id="obra-description"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="obra-cnpj">CNPJ</label>
                <input
                  id="obra-cnpj"
                  value={form.cnpj}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cnpj: e.target.value }))
                  }
                  placeholder="Opcional"
                />
              </div>
              <div className="field">
                <label htmlFor="obra-address">Endereco</label>
                <input
                  id="obra-address"
                  value={form.addressLine}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, addressLine: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="obra-city">Cidade</label>
                <input
                  id="obra-city"
                  value={form.city}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, city: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="obra-state">UF</label>
                <input
                  id="obra-state"
                  maxLength={2}
                  value={form.state}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, state: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="obra-start">Inicio previsto</label>
                <input
                  id="obra-start"
                  type="date"
                  value={form.plannedStartAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, plannedStartAt: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="obra-end">Fim previsto</label>
                <input
                  id="obra-end"
                  type="date"
                  value={form.plannedEndAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, plannedEndAt: e.target.value }))
                  }
                />
                <p className="field-hint">
                  So lembrete. Nao encerra a obra automaticamente.
                </p>
              </div>
            </div>
            <div className="btn-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving
                  ? 'Salvando…'
                  : editingId
                    ? 'Salvar alteracoes'
                    : 'Cadastrar obra'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {panel === 'import' ? (
        <section className="surface" aria-labelledby="obras-import-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">Planilha</p>
              <h2 id="obras-import-title" className="page-title page-title--sm">
                Importar obras
              </h2>
              <p className="page-lead">
                Baixe o modelo, preencha e envie para previa antes de gravar.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closePanels}
            >
              Cancelar
            </button>
          </div>
          <div className="form-panel">
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void downloadPortalObrasImportTemplate()}
              >
                Baixar modelo CSV
              </button>
              <label className="btn btn-primary" htmlFor="obras-import-file">
                {importBusy ? 'Lendo…' : 'Selecionar arquivo'}
              </label>
              <input
                id="obras-import-file"
                type="file"
                accept=".csv,text/csv"
                hidden
                disabled={importBusy}
                onChange={(e) => {
                  void onImportFile(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
            </div>
            {importPreview ? (
              <div className="field" style={{ marginTop: '1rem' }}>
                <p className="page-lead">
                  {importPreview.validRows} valida(s) ·{' '}
                  {importPreview.invalidRows} com erro ·{' '}
                  {importPreview.totalRows} no total
                </p>
                {importPreview.invalidRows > 0 ? (
                  <div className="stack-list" role="list">
                    {importPreview.rows
                      .filter((r) => r.errors.length > 0)
                      .slice(0, 8)
                      .map((row) => (
                        <article
                          key={row.rowNumber}
                          className="stack-card"
                          role="listitem"
                        >
                          <div className="stack-card__body stack-card__body--stack">
                            <div className="stack-card__main">
                              <strong className="stack-card__title">
                                Linha {row.rowNumber}
                                {row.name ? `: ${row.name}` : ''}
                              </strong>
                              <p className="stack-card__meta">
                                {row.errors.join(' · ')}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                  </div>
                ) : (
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={importBusy || importPreview.validRows === 0}
                      onClick={() => void onConfirmImport()}
                    >
                      Confirmar importacao
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {panel === 'assign' ? (
        <section className="surface" aria-labelledby="obras-assign-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">Vinculo</p>
              <h2 id="obras-assign-title" className="page-title page-title--sm">
                Vincular trabalhador a obra
              </h2>
              <p className="page-lead">
                Um trabalhador so pode estar em uma obra por vez. Ao vincular a
                outra, a anterior e encerrada no dia anterior.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closePanels}
            >
              Cancelar
            </button>
          </div>
          <form
            className="form-panel"
            onSubmit={(e) => void onAssign(e)}
            noValidate
          >
            <div className="form-grid">
              <div className="field">
                <label htmlFor="obra-assign-worker">Trabalhador</label>
                <select
                  id="obra-assign-worker"
                  required
                  value={assignWorkerId}
                  onChange={(e) => setAssignWorkerId(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.registration ? ` · ${w.registration}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="obra-assign-site">Obra ativa</label>
                <select
                  id="obra-assign-site"
                  required
                  value={assignSiteId}
                  onChange={(e) => setAssignSiteId(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {activeSites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="obra-assign-start">Inicio do vinculo</label>
                <input
                  id="obra-assign-start"
                  type="date"
                  value={assignStart}
                  onChange={(e) => setAssignStart(e.target.value)}
                />
                <p className="field-hint">
                  Vazio = hoje. Use para registrar periodo retroativo.
                </p>
              </div>
            </div>
            <div className="btn-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Vinculando…' : 'Vincular'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {panel === 'list' ? (
        <section className="surface" aria-labelledby="obras-list-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">Cadastro</p>
              <h2 id="obras-list-title" className="page-title page-title--sm">
                Lista de obras
              </h2>
            </div>
          </div>
          {loading ? <p className="page-lead">Carregando…</p> : null}
          {!loading && sites.length === 0 ? (
            <p className="page-lead">
              Nenhuma obra cadastrada. Use Nova obra ou Importar CSV.
            </p>
          ) : null}
          {!loading && sites.length > 0 ? (
            <div className="stack-list" role="list">
              {sites.map((site) => (
                <article key={site.id} className="stack-card" role="listitem">
                  <div className="stack-card__body stack-card__body--stack">
                    <div className="stack-card__main">
                      <strong className="stack-card__title">{site.name}</strong>
                      <p className="stack-card__meta">
                        <span
                          className={`status-pill ${
                            site.status === 'ACTIVE'
                              ? site.endingSoon
                                ? 'status-pill--warn'
                                : 'status-pill--active'
                              : 'status-pill--inactive'
                          }`}
                        >
                          <span className="dot" aria-hidden />
                          {site.status === 'ACTIVE'
                            ? site.endingSoon
                              ? 'Ativa · ≤15 dias'
                              : 'Ativa'
                            : 'Finalizada'}
                        </span>
                        {site.cnpj ? ` · CNPJ ${formatCnpj(site.cnpj)}` : ''}
                      </p>
                      <p className="stack-card__meta">
                        {formatDay(site.plannedStartAt)} a{' '}
                        {formatDay(site.plannedEndAt)}
                        {site.openAssignmentsCount
                          ? ` · ${site.openAssignmentsCount} vinculo(s) aberto(s)`
                          : ''}
                      </p>
                      {site.description ? (
                        <p className="stack-card__meta">{site.description}</p>
                      ) : null}
                      {site.city || site.addressLine ? (
                        <p className="stack-card__meta">
                          {[site.addressLine, site.city, site.state]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      ) : null}
                    </div>
                    {site.status === 'ACTIVE' ? (
                      <div className="stack-card__actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => startEdit(site)}
                        >
                          Editar / estender
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void onFinish(site.id, site.name)}
                        >
                          Finalizar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export default function PortalObrasPage() {
  return (
    <RequireClientAuth>
      {(user) => <PortalObrasContent user={user} />}
    </RequireClientAuth>
  );
}
