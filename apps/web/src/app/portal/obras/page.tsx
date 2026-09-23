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

  if (!enabled) {
    return (
      <div className="portal-home">
        <p className="page-kicker">Obras</p>
        <h1 className="page-title">Modulo nao liberado</h1>
        <p className="page-lead">
          O Modo Obras nao esta ativo para este cliente. Solicite a liberacao a
          consultoria.
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
        setMessage('Obra atualizada. Se o ciclo atrasar, basta estender a data de fim.');
      } else {
        await createPortalObra(payload);
        setMessage('Obra cadastrada.');
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar obra.');
    } finally {
      setSaving(false);
    }
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
      setAssignWorkerId('');
      setAssignStart('');
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
      // Reusa as linhas validas reconstruindo CSV minimo a partir do preview.
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
      <p className="page-kicker">Obras</p>
      <h1 className="page-title">Canteiros e obras</h1>
      <p className="page-lead">
        Cadastro informativo para vincular trabalhadores por periodo. A ficha de
        EPI usa esses dados. O fim previsto nao encerra a obra sozinho — estenda
        a data ou finalize manualmente.
      </p>

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

      {endingSoon.length > 0 ? (
        <section className="surface" aria-labelledby="obras-ending-title">
          <h2 id="obras-ending-title" className="page-title page-title--sm">
            Lembrete: ciclo a menos de 15 dias
          </h2>
          <p className="page-lead">
            Renove o periodo (editar data de fim) ou ignore se a obra vai
            mesmo acabar — so finaliza com o botao Finalizar.
          </p>
          <ul>
            {endingSoon.map((site) => (
              <li key={site.id}>
                <strong>{site.name}</strong> · fim previsto{' '}
                {formatDay(site.plannedEndAt)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="surface" aria-labelledby="obras-form-title">
        <h2 id="obras-form-title" className="page-title page-title--sm">
          {editingId ? 'Editar obra' : 'Nova obra'}
        </h2>
        <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          <label>
            Nome *
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            Descricao
            <input
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </label>
          <label>
            CNPJ
            <input
              value={form.cnpj}
              onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
            />
          </label>
          <label>
            Endereco
            <input
              value={form.addressLine}
              onChange={(e) =>
                setForm((f) => ({ ...f, addressLine: e.target.value }))
              }
            />
          </label>
          <label>
            Cidade
            <input
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </label>
          <label>
            UF
            <input
              maxLength={2}
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            />
          </label>
          <label>
            Inicio previsto
            <input
              type="date"
              value={form.plannedStartAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, plannedStartAt: e.target.value }))
              }
            />
          </label>
          <label>
            Fim previsto
            <input
              type="date"
              value={form.plannedEndAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, plannedEndAt: e.target.value }))
              }
            />
          </label>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : editingId ? 'Salvar' : 'Cadastrar'}
            </button>
            {editingId ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancelar edicao
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="surface" aria-labelledby="obras-import-title">
        <h2 id="obras-import-title" className="page-title page-title--sm">
          Importar planilha
        </h2>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void downloadPortalObrasImportTemplate()}
          >
            Baixar modelo CSV
          </button>
          <label className="btn btn-secondary">
            Selecionar arquivo
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) =>
                void onImportFile(e.target.files?.[0] ?? null)
              }
            />
          </label>
        </div>
        {importPreview ? (
          <div>
            <p className="page-lead">
              {importPreview.validRows} valida(s) · {importPreview.invalidRows}{' '}
              com erro
            </p>
            {importPreview.invalidRows === 0 ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={importBusy}
                onClick={() => void onConfirmImport()}
              >
                Confirmar importacao
              </button>
            ) : (
              <p className="error" role="alert">
                Corrija as linhas com erro na planilha e tente de novo.
              </p>
            )}
          </div>
        ) : null}
      </section>

      <section className="surface" aria-labelledby="obras-assign-title">
        <h2 id="obras-assign-title" className="page-title page-title--sm">
          Vincular trabalhador
        </h2>
        <p className="page-lead">
          Um trabalhador so pode estar em uma obra por vez. Ao vincular a outra,
          a anterior e encerrada no dia anterior.
        </p>
        <form className="form-grid" onSubmit={(e) => void onAssign(e)}>
          <label>
            Trabalhador
            <select
              required
              value={assignWorkerId}
              onChange={(e) => setAssignWorkerId(e.target.value)}
            >
              <option value="">Selecione</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Obra ativa
            <select
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
          </label>
          <label>
            Inicio do vinculo
            <input
              type="date"
              value={assignStart}
              onChange={(e) => setAssignStart(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            Vincular
          </button>
        </form>
      </section>

      <section className="surface" aria-labelledby="obras-list-title">
        <h2 id="obras-list-title" className="page-title page-title--sm">
          Lista de obras
        </h2>
        {loading ? <p className="page-lead">Carregando…</p> : null}
        {!loading && sites.length === 0 ? (
          <p className="page-lead">Nenhuma obra cadastrada.</p>
        ) : null}
        <ul className="stack-list">
          {sites.map((site) => (
            <li key={site.id} className="stack-list__item">
              <div>
                <strong>{site.name}</strong>
                {site.endingSoon ? (
                  <span className="badge"> ≤15 dias</span>
                ) : null}
                <p className="page-lead">
                  {site.status === 'ACTIVE' ? 'Ativa' : 'Finalizada'}
                  {site.cnpj ? ` · CNPJ ${formatCnpj(site.cnpj)}` : ''}
                  {' · '}
                  {formatDay(site.plannedStartAt)} a{' '}
                  {formatDay(site.plannedEndAt)}
                  {site.openAssignmentsCount
                    ? ` · ${site.openAssignmentsCount} vinculo(s) aberto(s)`
                    : ''}
                </p>
                {site.description ? (
                  <p className="page-lead">{site.description}</p>
                ) : null}
              </div>
              <div className="btn-row">
                {site.status === 'ACTIVE' ? (
                  <>
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
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
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
