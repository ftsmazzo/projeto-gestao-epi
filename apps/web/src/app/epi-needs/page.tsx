'use client';

import type {
  EpiCategory,
  EpiItem,
  EpiNeed,
  EpiNeedDetail,
} from '@gestao-epi/shared';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import {
  createEpiNeed,
  getEpiNeed,
  linkEpiToNeed,
  listEpiNeeds,
  suggestEpiNeedDefaults,
  unlinkEpiFromNeed,
  updateEpiNeed,
  updateEpiNeedStatus,
} from '../../lib/epi-needs';
import { listEpiItems } from '../../lib/epis';

type Mode = 'list' | 'create' | 'edit' | 'detail';

const CATEGORY_OPTIONS: { value: EpiCategory; label: string }[] = [
  { value: 'AUDITIVA', label: 'Auditiva' },
  { value: 'RESPIRATORIA', label: 'Respiratoria' },
  { value: 'QUEDA', label: 'Queda' },
  { value: 'MAOS', label: 'Maos' },
  { value: 'OLHOS', label: 'Olhos' },
  { value: 'CABECA', label: 'Cabeca' },
  { value: 'PES', label: 'Pes' },
  { value: 'TRONCO', label: 'Tronco' },
  { value: 'OUTROS', label: 'Outros' },
];

function categoryLabel(value: EpiCategory | null | undefined) {
  if (!value) return '—';
  return CATEGORY_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
}

function stockStatusLabel(status?: EpiNeed['stockStatus']) {
  if (status === 'UNLINKED') return 'Sem EPI real vinculado';
  if (status === 'WITH_STOCK') return 'Com estoque disponivel';
  if (status === 'NO_STOCK') return 'Sem saldo';
  return '—';
}

function stockStatusClass(status?: EpiNeed['stockStatus']) {
  if (status === 'WITH_STOCK') return 'status-pill status-pill--active';
  if (status === 'NO_STOCK') return 'status-pill status-pill--warn';
  return 'status-pill status-pill--inactive';
}

function EpiNeedsContent() {
  const [mode, setMode] = useState<Mode>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needs, setNeeds] = useState<EpiNeed[]>([]);
  const [detail, setDetail] = useState<EpiNeedDetail | null>(null);
  const [epis, setEpis] = useState<EpiItem[]>([]);

  const [q, setQ] = useState('');
  const [category, setCategory] = useState<EpiCategory | ''>('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [formCategory, setFormCategory] = useState<EpiCategory | ''>('');
  const [description, setDescription] = useState('');
  const [aliases, setAliases] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [linkEpiId, setLinkEpiId] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [list, epiList] = await Promise.all([
        listEpiNeeds({
          q: q || undefined,
          category: category || undefined,
          status,
        }),
        listEpiItems(),
      ]);
      setNeeds(list);
      setEpis(epiList.filter((item) => item.isActive));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar as necessidades.',
      );
    } finally {
      setLoading(false);
    }
  }, [q, category, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const unlinkedCount = useMemo(
    () => needs.filter((n) => n.stockStatus === 'UNLINKED').length,
    [needs],
  );

  function openCreate() {
    setMode('create');
    setEditingId(null);
    setName('');
    setFormCategory('');
    setDescription('');
    setAliases('');
    setFormError(null);
  }

  function openEdit(need: EpiNeed) {
    setMode('edit');
    setEditingId(need.id);
    setName(need.name);
    setFormCategory(need.category ?? '');
    setDescription(need.description ?? '');
    setAliases((need.aliases ?? []).join(', '));
    setFormError(null);
  }

  async function openDetail(needId: string) {
    setError(null);
    try {
      const data = await getEpiNeed(needId);
      setDetail(data);
      setMode('detail');
      setLinkEpiId('');
      setLinkError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel abrir a necessidade.',
      );
    }
  }

  function closeForm() {
    setMode('list');
    setDetail(null);
    setEditingId(null);
    setFormError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category: formCategory || null,
        description: description.trim() || null,
        aliases: aliases
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      };
      if (mode === 'create') {
        await createEpiNeed(payload);
      } else if (editingId) {
        await updateEpiNeed(editingId, payload);
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Falha ao salvar necessidade.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onSuggestDefaults() {
    setError(null);
    try {
      const result = await suggestEpiNeedDefaults();
      await load();
      setError(
        result.createdCount > 0
          ? null
          : 'Nenhuma sugestao nova: as necessidades iniciais ja existem.',
      );
      if (result.createdCount > 0) {
        window.alert(
          `${result.createdCount} necessidade(s) adicionada(s). ${result.skippedCount} ja existiam.`,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel gerar sugestoes iniciais.',
      );
    }
  }

  async function toggleStatus(need: EpiNeed) {
    setError(null);
    try {
      await updateEpiNeedStatus(need.id, !need.isActive);
      await load();
      if (detail?.id === need.id) {
        await openDetail(need.id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel atualizar o status.',
      );
    }
  }

  async function onLinkEpi(event: FormEvent) {
    event.preventDefault();
    if (!detail || !linkEpiId) return;
    setLinkError(null);
    try {
      await linkEpiToNeed(detail.id, { epiItemId: linkEpiId });
      setLinkEpiId('');
      await openDetail(detail.id);
      await load();
    } catch (err) {
      setLinkError(
        err instanceof Error ? err.message : 'Falha ao vincular EPI.',
      );
    }
  }

  async function onUnlink(epiItemId: string) {
    if (!detail) return;
    try {
      await unlinkEpiFromNeed(detail.id, epiItemId);
      await openDetail(detail.id);
      await load();
    } catch (err) {
      setLinkError(
        err instanceof Error ? err.message : 'Falha ao desvincular EPI.',
      );
    }
  }

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Catalogo operacional</p>
          <h1 className="page-title">Necessidades de EPI</h1>
          <p className="page-lead">
            Defina o que o trabalhador precisa usar e vincule aos EPIs reais
            (com CA) que atendem essa necessidade.
          </p>
        </div>
        <div className="header-actions header-actions--wrap">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void onSuggestDefaults()}
          >
            Gerar sugestoes iniciais
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Nova necessidade
          </button>
        </div>
      </header>

      <section className="quota-summary" aria-label="Resumo">
        <div className="quota-summary-item">
          <span className="quota-summary-label">Necessidades</span>
          <strong className="quota-summary-value">{needs.length}</strong>
        </div>
        <div className="quota-summary-item">
          <span className="quota-summary-label">Sem EPI vinculado</span>
          <strong className="quota-summary-value">{unlinkedCount}</strong>
        </div>
      </section>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {(mode === 'create' || mode === 'edit') && (
        <section className="surface" aria-labelledby="need-form-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">
                {mode === 'create' ? 'Nova' : 'Editar'}
              </p>
              <h2 id="need-form-title" className="page-title page-title--sm">
                Necessidade de EPI
              </h2>
            </div>
            <button type="button" className="btn btn-secondary" onClick={closeForm}>
              Cancelar
            </button>
          </div>
          <form className="form form--wide" onSubmit={onSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="need-name">Nome</label>
                <input
                  id="need-name"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="need-category">Categoria</label>
                <select
                  id="need-category"
                  value={formCategory}
                  onChange={(e) =>
                    setFormCategory(e.target.value as EpiCategory | '')
                  }
                >
                  <option value="">Sem categoria</option>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field field--span-2">
                <label htmlFor="need-desc">Descricao</label>
                <textarea
                  id="need-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="field field--span-2">
                <label htmlFor="need-aliases">
                  Aliases (separados por virgula)
                </label>
                <input
                  id="need-aliases"
                  value={aliases}
                  onChange={(e) => setAliases(e.target.value)}
                  placeholder="Ex.: plug, auricular plug"
                />
              </div>
            </div>
            {formError ? (
              <p className="error" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="btn-row">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </section>
      )}

      {mode === 'detail' && detail ? (
        <section className="surface" aria-labelledby="need-detail-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">Detalhe</p>
              <h2 id="need-detail-title" className="page-title page-title--sm">
                {detail.name}
              </h2>
              <p className="page-lead">
                {categoryLabel(detail.category)} ·{' '}
                <span className={stockStatusClass(detail.stockStatus)}>
                  {stockStatusLabel(detail.stockStatus)}
                </span>{' '}
                · Saldo total: {detail.totalStockQuantity ?? 0}
              </p>
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => openEdit(detail)}
              >
                Editar
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeForm}
              >
                Voltar
              </button>
            </div>
          </div>

          {detail.stockStatus === 'UNLINKED' ? (
            <p className="caepi-message" role="status">
              Nenhum EPI real vinculado. Vincule um item do catalogo para
              permitir atendimento futuro desta necessidade.
            </p>
          ) : null}

          <form className="form" onSubmit={onLinkEpi}>
            <div className="form-grid">
              <div className="field field--span-2">
                <label htmlFor="link-epi">Vincular EPI real</label>
                <select
                  id="link-epi"
                  value={linkEpiId}
                  onChange={(e) => setLinkEpiId(e.target.value)}
                  required
                >
                  <option value="">Selecione um EPI...</option>
                  {epis.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.caNumber ? ` (CA ${item.caNumber})` : ''}
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
                Vincular EPI
              </button>
            </div>
          </form>

          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">EPI real</th>
                  <th scope="col">CA</th>
                  <th scope="col">Saldo</th>
                  <th scope="col">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {(detail.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4}>Nenhum EPI vinculado.</td>
                  </tr>
                ) : (
                  detail.items.map((link) => (
                    <tr key={link.id}>
                      <td>
                        <strong>{link.epiItem?.name ?? '—'}</strong>
                      </td>
                      <td className="mono">
                        {link.epiItem?.caNumber ?? '—'}
                      </td>
                      <td className="mono">{link.stockQuantity ?? 0}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          onClick={() => void onUnlink(link.epiItemId)}
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

      {mode === 'list' ? (
        <section className="surface" aria-labelledby="needs-list-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">Lista</p>
              <h2 id="needs-list-title" className="page-title page-title--sm">
                Necessidades do tenant
              </h2>
            </div>
          </div>

          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <div className="field">
              <label htmlFor="need-q">Busca</label>
              <input
                id="need-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome ou alias"
              />
            </div>
            <div className="field">
              <label htmlFor="need-cat">Categoria</label>
              <select
                id="need-cat"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as EpiCategory | '')
                }
              >
                <option value="">Todas</option>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="need-status">Status</label>
              <select
                id="need-status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as 'all' | 'active' | 'inactive')
                }
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p className="page-lead">Carregando...</p>
          ) : needs.length === 0 ? (
            <div className="empty-state">
              <p className="page-title page-title--sm">
                Nenhuma necessidade cadastrada
              </p>
              <p className="page-lead">
                Gere as sugestoes iniciais ou cadastre a primeira necessidade.
              </p>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void onSuggestDefaults()}
                >
                  Gerar sugestoes iniciais
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openCreate}
                >
                  Nova necessidade
                </button>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Necessidade</th>
                    <th scope="col">Categoria</th>
                    <th scope="col">EPIs</th>
                    <th scope="col">Saldo</th>
                    <th scope="col">Situacao</th>
                    <th scope="col">Status</th>
                    <th scope="col">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {needs.map((need) => (
                    <tr key={need.id}>
                      <td>
                        <strong>{need.name}</strong>
                        {need.aliases?.length ? (
                          <span className="table-sub">
                            {need.aliases.slice(0, 3).join(', ')}
                          </span>
                        ) : null}
                      </td>
                      <td>{categoryLabel(need.category)}</td>
                      <td className="mono">{need.linkedItemsCount ?? 0}</td>
                      <td className="mono">{need.totalStockQuantity ?? 0}</td>
                      <td>
                        <span className={stockStatusClass(need.stockStatus)}>
                          {stockStatusLabel(need.stockStatus)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-pill status-pill--${
                            need.isActive ? 'active' : 'inactive'
                          }`}
                        >
                          {need.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-compact"
                            onClick={() => void openDetail(need.id)}
                          >
                            Abrir
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => openEdit(need)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => void toggleStatus(need)}
                          >
                            {need.isActive ? 'Inativar' : 'Reativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

export default function EpiNeedsPage() {
  return <RequireAuth>{() => <EpiNeedsContent />}</RequireAuth>;
}
