'use client';

import type {
  TrainingAssetKind,
  TrainingIssuanceListItem,
  TrainingTemplate,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import { PageHeader } from '../../components/ui/PageHeader';
import {
  createTrainingTemplate,
  deleteTrainingAsset,
  fetchTrainingAssetObjectUrl,
  listTrainingIssuances,
  listTrainingTemplates,
  reprintTrainingIssuance,
  updateTrainingTemplate,
  uploadTrainingAsset,
} from '../../lib/training';

type Mode = 'list' | 'create' | 'edit';

const ASSET_LABELS: Array<{ kind: TrainingAssetKind; label: string; hint: string }> =
  [
    { kind: 'HEADER', label: 'Logo INSEG', hint: 'Topo direito do diploma' },
    { kind: 'LEFT_LOGO', label: 'Logo do curso', hint: 'Integração ou selo NR-35' },
    { kind: 'RIGHT_LOGO', label: 'Arte do verso', hint: 'Ex.: INTEGRAR É PRECISO' },
    { kind: 'SEAL', label: 'Marca NR (opcional)', hint: 'NR-35 no rodapé direito' },
  ];

const emptyForm = {
  name: '',
  courseTitle: '',
  nrLabel: '',
  defaultHours: '8',
  defaultLocation: 'Sala de Treinamento',
  certificateCourseClause: '',
  topics: '',
  registerSummary: '',
  instructorName: '',
  instructorRole: 'Tecnico em Seguranca do Trabalho',
  instructorRegistry: '',
  includeCertificate: true,
  includeRegister: true,
  isActive: true,
};

function formatDay(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
  } catch {
    return iso;
  }
}

function CertificadosContent() {
  const [templates, setTemplates] = useState<TrainingTemplate[]>([]);
  const [issuances, setIssuances] = useState<TrainingIssuanceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [previews, setPreviews] = useState<Partial<Record<TrainingAssetKind, string>>>(
    {},
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, history] = await Promise.all([
        listTrainingTemplates(),
        listTrainingIssuances().catch(() => ({ issuances: [] })),
      ]);
      setTemplates(list.templates);
      setIssuances(history.issuances);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const urls = Object.values(previews).filter((url): url is string => Boolean(url));
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [previews]);

  function openCreate() {
    setMode('create');
    setEditingId(null);
    setForm(emptyForm);
    setPreviews({});
    setError(null);
  }

  function openEdit(row: TrainingTemplate) {
    setMode('edit');
    setEditingId(row.id);
    setForm({
      name: row.name,
      courseTitle: row.courseTitle,
      nrLabel: row.nrLabel,
      defaultHours: String(row.defaultHours),
      defaultLocation: row.defaultLocation,
      certificateCourseClause: row.certificateCourseClause,
      topics: row.topics.join('\n'),
      registerSummary: row.registerSummary,
      instructorName: row.instructorName,
      instructorRole: row.instructorRole,
      instructorRegistry: row.instructorRegistry,
      includeCertificate: row.includeCertificate,
      includeRegister: row.includeRegister,
      isActive: row.isActive,
    });
    setError(null);
    void loadPreviews(row);
  }

  async function loadPreviews(row: TrainingTemplate) {
    const next: Partial<Record<TrainingAssetKind, string>> = {};
    await Promise.all(
      row.assets
        .filter((asset) => asset.present)
        .map(async (asset) => {
          const url = await fetchTrainingAssetObjectUrl(row.id, asset.kind);
          if (url) next[asset.kind] = url;
        }),
    );
    setPreviews((prev) => {
      for (const url of Object.values(prev)) {
        if (url) URL.revokeObjectURL(url);
      }
      return next;
    });
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      courseTitle: form.courseTitle,
      nrLabel: form.nrLabel,
      defaultHours: Number(form.defaultHours) || 8,
      defaultLocation: form.defaultLocation,
      certificateCourseClause: form.certificateCourseClause,
      topics: form.topics
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      registerSummary: form.registerSummary,
      instructorName: form.instructorName,
      instructorRole: form.instructorRole,
      instructorRegistry: form.instructorRegistry,
      includeCertificate: form.includeCertificate,
      includeRegister: form.includeRegister,
      isActive: form.isActive,
    };
    try {
      if (mode === 'edit' && editingId) {
        const updated = await updateTrainingTemplate(editingId, payload);
        setTemplates((prev) =>
          prev.map((row) => (row.id === updated.id ? updated : row)),
        );
        setNotice('Modelo salvo.');
      } else {
        const created = await createTrainingTemplate(payload);
        setTemplates((prev) => [created, ...prev]);
        setMode('edit');
        setEditingId(created.id);
        setNotice('Modelo criado. Agora voce pode enviar as imagens.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function onUploadAsset(kind: TrainingAssetKind, file: File | undefined) {
    if (!editingId || !file) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await uploadTrainingAsset(editingId, kind, file);
      setTemplates((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
      const url = await fetchTrainingAssetObjectUrl(editingId, kind);
      setPreviews((prev) => {
        if (prev[kind]) URL.revokeObjectURL(prev[kind]!);
        return url ? { ...prev, [kind]: url } : prev;
      });
      setNotice('Imagem salva neste modelo.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar imagem.');
    } finally {
      setSaving(false);
    }
  }

  async function onRemoveAsset(kind: TrainingAssetKind) {
    if (!editingId) return;
    setSaving(true);
    try {
      const updated = await deleteTrainingAsset(editingId, kind);
      setTemplates((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
      setPreviews((prev) => {
        if (prev[kind]) URL.revokeObjectURL(prev[kind]!);
        const next = { ...prev };
        delete next[kind];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover imagem.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="module-page">
      <PageHeader
        kicker="Consultoria"
        title="Certificados e registros"
        lead="Cadastre os modelos (textos, carga, instrutor e imagens) e gere folhas A4 preenchidas com os trabalhadores do cliente."
        actions={
          <div className="btn-row">
            <Link className="btn btn-primary" href="/certificados/gerar">
              Gerar certificado
            </Link>
            {mode === 'list' ? (
              <button type="button" className="btn btn-secondary" onClick={openCreate}>
                Novo modelo
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setMode('list');
                  setEditingId(null);
                }}
              >
                Voltar a lista
              </button>
            )}
          </div>
        }
      />

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="notice notice--info" role="status">
          {notice}
        </p>
      ) : null}

      {mode !== 'list' ? (
        <section className="surface">
          <h2 className="page-title page-title--sm">
            {mode === 'create' ? 'Novo modelo' : 'Editar modelo'}
          </h2>
          <form className="form" onSubmit={(e) => void onSave(e)}>
            <div className="field">
              <label htmlFor="tpl-name">Nome interno</label>
              <input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="tpl-course">Titulo do curso</label>
              <input
                id="tpl-course"
                value={form.courseTitle}
                onChange={(e) =>
                  setForm({ ...form, courseTitle: e.target.value })
                }
                required
              />
            </div>
            <div className="field">
              <label htmlFor="tpl-nr">NR</label>
              <input
                id="tpl-nr"
                value={form.nrLabel}
                onChange={(e) => setForm({ ...form, nrLabel: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tpl-hours">Carga horaria padrao</label>
              <input
                id="tpl-hours"
                type="number"
                min={1}
                max={80}
                value={form.defaultHours}
                onChange={(e) =>
                  setForm({ ...form, defaultHours: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="tpl-local">Local padrao</label>
              <input
                id="tpl-local"
                value={form.defaultLocation}
                onChange={(e) =>
                  setForm({ ...form, defaultLocation: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="tpl-clause">Texto do diploma (sem o nome)</label>
              <textarea
                id="tpl-clause"
                rows={4}
                value={form.certificateCourseClause}
                onChange={(e) =>
                  setForm({ ...form, certificateCourseClause: e.target.value })
                }
                required
              />
              <p className="field-hint">
                O sistema completa: Certificamos que o Senhor [nome], [este
                texto], realizado no periodo de [data], carga horaria.
              </p>
            </div>
            <div className="field">
              <label htmlFor="tpl-topics">Conteudo programatico (um por linha)</label>
              <textarea
                id="tpl-topics"
                rows={8}
                value={form.topics}
                onChange={(e) => setForm({ ...form, topics: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tpl-summary">Resumo do registro</label>
              <textarea
                id="tpl-summary"
                rows={4}
                value={form.registerSummary}
                onChange={(e) =>
                  setForm({ ...form, registerSummary: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="tpl-inst">Instrutor padrao</label>
              <input
                id="tpl-inst"
                value={form.instructorName}
                onChange={(e) =>
                  setForm({ ...form, instructorName: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="tpl-role">Cargo do instrutor</label>
              <input
                id="tpl-role"
                value={form.instructorRole}
                onChange={(e) =>
                  setForm({ ...form, instructorRole: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="tpl-mtb">Registro MTE / MTB</label>
              <input
                id="tpl-mtb"
                value={form.instructorRegistry}
                onChange={(e) =>
                  setForm({ ...form, instructorRegistry: e.target.value })
                }
              />
            </div>
            <label className="field">
              <input
                type="checkbox"
                checked={form.includeCertificate}
                onChange={(e) =>
                  setForm({ ...form, includeCertificate: e.target.checked })
                }
              />{' '}
              Gerar certificado (A4 paisagem)
            </label>
            <label className="field">
              <input
                type="checkbox"
                checked={form.includeRegister}
                onChange={(e) =>
                  setForm({ ...form, includeRegister: e.target.checked })
                }
              />{' '}
              Gerar registro da turma (A4 retrato)
            </label>
            <label className="field">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />{' '}
              Modelo ativo
            </label>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar modelo'}
            </button>
          </form>

          {editingId ? (
            <div className="stack-list" style={{ marginTop: '1.25rem' }}>
              <h3 className="page-title page-title--sm">Imagens do modelo</h3>
              {ASSET_LABELS.map((item) => (
                <article key={item.kind} className="stack-card">
                  <div className="stack-card__body">
                    <div className="stack-card__main">
                      <strong>{item.label}</strong>
                      <p className="stack-card__meta">{item.hint}</p>
                      {previews[item.kind] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previews[item.kind]}
                          alt=""
                          style={{
                            maxHeight: 72,
                            marginTop: 8,
                            objectFit: 'contain',
                          }}
                        />
                      ) : (
                        <p className="field-hint">Nenhuma imagem ainda.</p>
                      )}
                    </div>
                    <div className="stack-card__actions">
                      <label className="btn btn-secondary">
                        Enviar
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          hidden
                          onChange={(e) =>
                            void onUploadAsset(item.kind, e.target.files?.[0])
                          }
                        />
                      </label>
                      {previews[item.kind] ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void onRemoveAsset(item.kind)}
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="field-hint">
              Salve o modelo primeiro para enviar as imagens.
            </p>
          )}
        </section>
      ) : (
        <>
          <section className="surface">
            <h2 className="page-title page-title--sm">Modelos</h2>
            {loading ? (
              <p className="page-lead">Carregando...</p>
            ) : templates.length === 0 ? (
              <p className="page-lead">Nenhum modelo ainda.</p>
            ) : (
              <div className="stack-list">
                {templates.map((row) => (
                  <article key={row.id} className="stack-card">
                    <div className="stack-card__body">
                      <div className="stack-card__main">
                        <strong className="stack-card__title">{row.name}</strong>
                        <p className="stack-card__meta">
                          {row.courseTitle}
                          {row.nrLabel ? ` · ${row.nrLabel}` : ''} ·{' '}
                          {row.defaultHours}h
                        </p>
                        <p className="stack-card__meta">
                          {row.includeCertificate ? 'Certificado' : ''}
                          {row.includeCertificate && row.includeRegister
                            ? ' + '
                            : ''}
                          {row.includeRegister ? 'Registro' : ''}
                          {row.isActive ? '' : ' · inativo'}
                        </p>
                      </div>
                      <div className="stack-card__actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => openEdit(row)}
                        >
                          Editar
                        </button>
                        <Link
                          className="btn btn-primary"
                          href={`/certificados/gerar?modelo=${row.id}`}
                        >
                          Gerar
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="surface">
            <h2 className="page-title page-title--sm">Ultimas emissoes</h2>
            {issuances.length === 0 ? (
              <p className="page-lead">Nenhuma geracao ainda.</p>
            ) : (
              <div className="stack-list">
                {issuances.map((row) => (
                  <article key={row.id} className="stack-card">
                    <div className="stack-card__body">
                      <div className="stack-card__main">
                        <strong>{row.templateName}</strong>
                        <p className="stack-card__meta">
                          {row.clientName} · {formatDay(row.heldOn)} ·{' '}
                          {row.workerCount} trabalhador(es)
                          {row.controlNumber ? ` · ${row.controlNumber}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void reprintTrainingIssuance(row.id)}
                      >
                        Reimprimir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function CertificadosPage() {
  return (
    <RequireAuth>
      {() => <CertificadosContent />}
    </RequireAuth>
  );
}
