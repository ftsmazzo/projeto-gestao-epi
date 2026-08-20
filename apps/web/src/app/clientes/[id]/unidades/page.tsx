'use client';

import type { OperationalUnit } from '@gestao-epi/shared';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  formatCnpj,
  formatCnpjInput,
  normalizeCnpj,
} from '../../../../lib/cnpj';
import {
  createOperationalUnit,
  listOperationalUnits,
  updateOperationalUnit,
  updateOperationalUnitStatus,
} from '../../../../lib/operational-units';

type FormMode = 'closed' | 'create' | 'edit';

type UnitFormState = {
  name: string;
  code: string;
  cnpj: string;
  addressLine: string;
  city: string;
  state: string;
  notes: string;
};

const emptyForm: UnitFormState = {
  name: '',
  code: '',
  cnpj: '',
  addressLine: '',
  city: '',
  state: '',
  notes: '',
};

function locationLabel(unit: OperationalUnit) {
  const parts = [
    unit.addressLine,
    [unit.city, unit.state].filter(Boolean).join(' - '),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

export default function ClienteUnidadesPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  const [units, setUnits] = useState<OperationalUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [mode, setMode] = useState<FormMode>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UnitFormState>(emptyForm);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      setUnits(await listOperationalUnits(clientId));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar unidades.',
      );
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setMode('create');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function openEdit(unit: OperationalUnit) {
    setMode('edit');
    setEditingId(unit.id);
    setForm({
      name: unit.name,
      code: unit.code ?? '',
      cnpj: unit.cnpj ? formatCnpj(unit.cnpj) : '',
      addressLine: unit.addressLine ?? '',
      city: unit.city ?? '',
      state: unit.state ?? '',
      notes: unit.notes ?? '',
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
    if (!clientId) return;
    setFormError(null);
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      cnpj: normalizeCnpj(form.cnpj) || null,
      addressLine: form.addressLine.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (mode === 'create') {
        await createOperationalUnit(clientId, {
          name: payload.name,
          code: payload.code ?? undefined,
          cnpj: payload.cnpj ?? undefined,
          addressLine: payload.addressLine ?? undefined,
          city: payload.city ?? undefined,
          state: payload.state ?? undefined,
          notes: payload.notes ?? undefined,
        });
      } else if (mode === 'edit' && editingId) {
        await updateOperationalUnit(editingId, payload);
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

  async function toggleStatus(unit: OperationalUnit) {
    setError(null);
    try {
      await updateOperationalUnitStatus(
        unit.id,
        unit.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
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
      {mode !== 'closed' ? (
        <section className="surface" aria-labelledby="unit-form-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">
                {mode === 'create' ? 'Novo cadastro' : 'Editar'}
              </p>
              <h2 id="unit-form-title" className="page-title page-title--sm">
                {mode === 'create' ? 'Nova unidade' : 'Editar unidade'}
              </h2>
            </div>
            <button type="button" className="btn btn-secondary" onClick={closeForm}>
              Cancelar
            </button>
          </div>
          <form className="form-panel" onSubmit={onSubmit} noValidate>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="unit-name">Nome</label>
                <input
                  id="unit-name"
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="unit-code">Codigo</label>
                <input
                  id="unit-code"
                  value={form.code}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, code: e.target.value }))
                  }
                />
              </div>
              <div className="field field--span-2">
                <label htmlFor="unit-cnpj">CNPJ da unidade</label>
                <input
                  id="unit-cnpj"
                  value={form.cnpj}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      cnpj: formatCnpjInput(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="field field--span-2">
                <label htmlFor="unit-address">Endereco</label>
                <input
                  id="unit-address"
                  value={form.addressLine}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      addressLine: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="unit-city">Cidade</label>
                <input
                  id="unit-city"
                  value={form.city}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, city: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="unit-state">UF</label>
                <input
                  id="unit-state"
                  maxLength={2}
                  value={form.state}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      state: e.target.value.toUpperCase().slice(0, 2),
                    }))
                  }
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="unit-notes">Observacoes</label>
              <textarea
                id="unit-notes"
                rows={3}
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
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

      <section className="surface" aria-labelledby="units-list-title">
        <div className="form-section-header">
          <div>
            <p className="page-kicker">Unidades</p>
            <h2 id="units-list-title" className="page-title page-title--sm">
              Unidades operacionais
            </h2>
            <p className="page-lead">
              Filiais, obras ou locais de entrega deste cliente.
            </p>
          </div>
          {mode === 'closed' ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Nova unidade
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="page-lead">Carregando...</p>
        ) : units.length === 0 ? (
          <div className="empty-state">
            <p className="page-lead">Nenhuma unidade cadastrada.</p>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Cadastrar primeira unidade
            </button>
          </div>
        ) : (
          <div className="stack-list" role="list" aria-label="Unidades">
            {units.map((unit) => (
              <article key={unit.id} role="listitem" className="stack-card">
                <div className="stack-card__body stack-card__body--stack">
                  <div className="stack-card__main">
                    <strong className="stack-card__title">{unit.name}</strong>
                    <p className="stack-card__meta">{locationLabel(unit)}</p>
                    <p className="stack-card__meta mono">
                      {unit.code || 'Sem codigo'}
                      {unit.cnpj ? ` · ${formatCnpj(unit.cnpj)}` : ''}
                    </p>
                    <span
                      className={`status-pill status-pill--${unit.status.toLowerCase()}`}
                      style={{ marginTop: '0.45rem' }}
                    >
                      {unit.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="stack-card__actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => openEdit(unit)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void toggleStatus(unit)}
                    >
                      {unit.status === 'ACTIVE' ? 'Inativar' : 'Reativar'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
