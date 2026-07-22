'use client';

import type { EpiItem } from '@gestao-epi/shared';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import {
  createEpiItem,
  listEpiItems,
  updateEpiItem,
  updateEpiItemStatus,
} from '../../lib/epis';

type FormMode = 'closed' | 'create' | 'edit';

type EpiFormState = {
  name: string;
  category: string;
  manufacturer: string;
  requiresCa: boolean;
  caNumber: string;
  caExpirationDate: string;
  defaultValidityDays: string;
  description: string;
  notes: string;
};

const emptyForm: EpiFormState = {
  name: '',
  category: '',
  manufacturer: '',
  requiresCa: true,
  caNumber: '',
  caExpirationDate: '',
  defaultValidityDays: '',
  description: '',
  notes: '',
};

function statusLabel(status: EpiItem['status']) {
  return status === 'ACTIVE' ? 'Ativo' : 'Inativo';
}

function toDateInput(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatDateBr(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function normalizeCaInput(value: string) {
  return value.replace(/\s+/g, '');
}

function EpisContent() {
  const [items, setItems] = useState<EpiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [mode, setMode] = useState<FormMode>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EpiFormState>(emptyForm);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setItems(await listEpiItems());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar os EPIs.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setMode('create');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function openEdit(item: EpiItem) {
    setMode('edit');
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category ?? '',
      manufacturer: item.manufacturer ?? '',
      requiresCa: item.requiresCa,
      caNumber: item.caNumber ?? '',
      caExpirationDate: toDateInput(item.caExpirationDate),
      defaultValidityDays:
        item.defaultValidityDays != null
          ? String(item.defaultValidityDays)
          : '',
      description: item.description ?? '',
      notes: item.notes ?? '',
    });
    setFormError(null);
  }

  function closeForm() {
    setMode('closed');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const caNumber = normalizeCaInput(form.caNumber.trim());
    if (form.requiresCa && !caNumber) {
      setFormError(
        'Este EPI exige CA. Informe o numero do Certificado de Aprovacao.',
      );
      return;
    }

    let defaultValidityDays: number | null = null;
    if (form.defaultValidityDays.trim()) {
      const parsed = Number(form.defaultValidityDays);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setFormError(
          'Validade padrao de uso deve ser um inteiro positivo (em dias).',
        );
        return;
      }
      defaultValidityDays = parsed;
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
      requiresCa: form.requiresCa,
      caNumber: caNumber || null,
      caExpirationDate: form.caExpirationDate || null,
      defaultValidityDays,
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
    };

    try {
      if (mode === 'create') {
        await createEpiItem({
          name: payload.name,
          category: payload.category ?? undefined,
          manufacturer: payload.manufacturer ?? undefined,
          requiresCa: payload.requiresCa,
          caNumber: payload.caNumber ?? undefined,
          caExpirationDate: payload.caExpirationDate ?? undefined,
          defaultValidityDays: payload.defaultValidityDays ?? undefined,
          description: payload.description ?? undefined,
          notes: payload.notes ?? undefined,
        });
      } else if (mode === 'edit' && editingId) {
        await updateEpiItem(editingId, payload);
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

  async function toggleStatus(item: EpiItem) {
    setError(null);
    try {
      await updateEpiItemStatus(
        item.id,
        item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
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
    <div className="module-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Catalogo</p>
          <h1 className="page-title">EPIs</h1>
          <p className="page-lead">
            Cadastre o book de equipamentos com CA e validade. Estoque e
            entregas virao nas proximas etapas.
          </p>
        </div>
        <div className="header-actions header-actions--wrap">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Novo EPI
          </button>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {mode !== 'closed' ? (
        <section className="surface" aria-labelledby="epi-form-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">
                {mode === 'create' ? 'Novo cadastro' : 'Editar cadastro'}
              </p>
              <h2 id="epi-form-title" className="page-title page-title--sm">
                {mode === 'create' ? 'Novo EPI' : 'Editar EPI'}
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

          <form className="form form--wide" onSubmit={onSubmit} noValidate>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="epi-name">Nome</label>
                <input
                  id="epi-name"
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="epi-category">Categoria (opcional)</label>
                <input
                  id="epi-category"
                  placeholder="Ex.: Protecao auditiva"
                  value={form.category}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, category: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="epi-manufacturer">Fabricante (opcional)</label>
                <input
                  id="epi-manufacturer"
                  value={form.manufacturer}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      manufacturer: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="epi-requires-ca">Exige CA?</label>
                <label className="field-check" htmlFor="epi-requires-ca">
                  <input
                    id="epi-requires-ca"
                    type="checkbox"
                    checked={form.requiresCa}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        requiresCa: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    {form.requiresCa
                      ? 'Sim — numero do CA obrigatorio'
                      : 'Nao — CA pode ficar em branco'}
                  </span>
                </label>
              </div>
              <div className="field">
                <label htmlFor="epi-ca">
                  Numero do CA{form.requiresCa ? '' : ' (opcional)'}
                </label>
                <input
                  id="epi-ca"
                  autoComplete="off"
                  required={form.requiresCa}
                  placeholder="Ex.: 12345"
                  value={form.caNumber}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      caNumber: normalizeCaInput(e.target.value),
                    }))
                  }
                />
                <p className="field-hint">
                  {form.requiresCa
                    ? 'Obrigatorio para este EPI. Informe o Certificado de Aprovacao.'
                    : 'Opcional. Use quando houver CA mesmo sem obrigatoriedade.'}
                </p>
              </div>
              <div className="field">
                <label htmlFor="epi-ca-exp">Validade do CA (opcional)</label>
                <input
                  id="epi-ca-exp"
                  type="date"
                  value={form.caExpirationDate}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      caExpirationDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="epi-validity-days">
                  Validade padrao de uso (dias)
                </label>
                <input
                  id="epi-validity-days"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Ex.: 180"
                  value={form.defaultValidityDays}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      defaultValidityDays: e.target.value,
                    }))
                  }
                />
                <p className="field-hint">
                  Sugestao operacional de vida util em dias. Estoque usara isso
                  depois.
                </p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="epi-description">Descricao (opcional)</label>
              <textarea
                id="epi-description"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="epi-notes">Observacoes (opcional)</label>
              <textarea
                id="epi-notes"
                rows={3}
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>

            <aside className="cnpj-lookup-slot" aria-label="Consulta de CA">
              <p className="page-kicker">Consulta CA</p>
              <p className="field-hint">
                Em breve: consultar validade e dados do CA na fonte oficial. Por
                enquanto, informe manualmente.
              </p>
              <button type="button" className="btn btn-secondary" disabled>
                Consultar CA (em breve)
              </button>
            </aside>

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
                    ? 'Cadastrar EPI'
                    : 'Salvar alteracoes'}
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

      <section className="surface" aria-labelledby="epis-list-title">
        <div className="form-section-header">
          <div>
            <p className="page-kicker">Lista</p>
            <h2 id="epis-list-title" className="page-title page-title--sm">
              Catalogo da organizacao
            </h2>
          </div>
        </div>

        {loading ? (
          <p className="page-lead">Carregando EPIs...</p>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <p className="page-title page-title--sm">Nenhum EPI cadastrado</p>
            <p className="page-lead">
              Cadastre o primeiro equipamento do catalogo. Estoque e entregas
              usarao estes itens depois.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreate}
            >
              Cadastrar primeiro EPI
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">CA</th>
                  <th scope="col">Validade CA</th>
                  <th scope="col">Status</th>
                  <th scope="col">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      {item.manufacturer ? (
                        <span className="table-sub">{item.manufacturer}</span>
                      ) : null}
                    </td>
                    <td>{item.category || '—'}</td>
                    <td className="mono">
                      {item.caNumber ? item.caNumber : 'Sem CA'}
                    </td>
                    <td>{formatDateBr(item.caExpirationDate)}</td>
                    <td>
                      <span
                        className={`status-pill status-pill--${item.status.toLowerCase()}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          onClick={() => openEdit(item)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          onClick={() => void toggleStatus(item)}
                        >
                          {item.status === 'ACTIVE' ? 'Inativar' : 'Reativar'}
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
    </div>
  );
}

export default function EpisPage() {
  return (
    <RequireAuth>
      {() => <EpisContent />}
    </RequireAuth>
  );
}
