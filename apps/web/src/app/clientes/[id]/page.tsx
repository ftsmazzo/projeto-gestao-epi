'use client';

import type { OperationalUnit, ServedClient } from '@gestao-epi/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '../../../components/RequireAuth';
import { formatCnpj } from '../../../lib/cnpj';
import { getServedClient } from '../../../lib/served-clients';
import {
  createOperationalUnit,
  listOperationalUnits,
  updateOperationalUnit,
  updateOperationalUnitStatus,
} from '../../../lib/operational-units';

type FormMode = 'closed' | 'create' | 'edit';

type UnitFormState = {
  name: string;
  code: string;
  addressLine: string;
  city: string;
  state: string;
  notes: string;
};

const emptyForm: UnitFormState = {
  name: '',
  code: '',
  addressLine: '',
  city: '',
  state: '',
  notes: '',
};

function statusLabel(status: 'ACTIVE' | 'INACTIVE') {
  return status === 'ACTIVE' ? 'Ativo' : 'Inativo';
}

function locationLabel(unit: OperationalUnit) {
  const parts = [unit.city, unit.state].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : '—';
}

function ClienteDetalheContent() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [client, setClient] = useState<ServedClient | null>(null);
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
    setError(null);
    setLoading(true);
    try {
      const [servedClient, list] = await Promise.all([
        getServedClient(clientId),
        listOperationalUnits(clientId),
      ]);
      setClient(servedClient);
      setUnits(list);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar o cliente.',
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

  if (loading && !client) {
    return <p className="page-lead">Carregando cliente...</p>;
  }

  if (!client) {
    return (
      <div className="module-page">
        <p className="error" role="alert">
          {error ?? 'Cliente atendido nao encontrado.'}
        </p>
        <Link className="btn btn-secondary" href="/clientes">
          Voltar para clientes
        </Link>
      </div>
    );
  }

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Cliente atendido</p>
          <h1 className="page-title">
            {client.tradeName || client.legalName}
          </h1>
          <p className="page-lead">
            Unidades operacionais (filiais, obras, plantas ou locais de
            entrega) vinculadas a este CNPJ.
          </p>
        </div>
        <div className="header-actions header-actions--wrap">
          <Link className="btn btn-secondary" href="/clientes">
            Voltar
          </Link>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Nova unidade
          </button>
        </div>
      </header>

      <section className="surface" aria-labelledby="client-summary-title">
        <p className="page-kicker">Resumo</p>
        <h2 id="client-summary-title" className="page-title page-title--sm">
          Dados do cliente
        </h2>
        <dl className="meta-list">
          <div>
            <dt>Razao social</dt>
            <dd>{client.legalName}</dd>
          </div>
          {client.tradeName ? (
            <div>
              <dt>Nome fantasia</dt>
              <dd>{client.tradeName}</dd>
            </div>
          ) : null}
          <div>
            <dt>CNPJ</dt>
            <dd className="mono">{formatCnpj(client.cnpj)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span
                className={`status-pill status-pill--${client.status.toLowerCase()}`}
              >
                {statusLabel(client.status)}
              </span>
            </dd>
          </div>
          <div>
            <dt>Cota alocada</dt>
            <dd className="mono">{client.allocatedLifeQuota} vidas</dd>
          </div>
        </dl>
      </section>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {mode !== 'closed' ? (
        <section className="surface" aria-labelledby="unit-form-title">
          <div className="form-section-header">
            <div>
              <p className="page-kicker">
                {mode === 'create' ? 'Novo cadastro' : 'Editar cadastro'}
              </p>
              <h2 id="unit-form-title" className="page-title page-title--sm">
                {mode === 'create'
                  ? 'Nova unidade operacional'
                  : 'Editar unidade'}
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
                <label htmlFor="unit-code">Codigo (opcional)</label>
                <input
                  id="unit-code"
                  value={form.code}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, code: e.target.value }))
                  }
                />
                <p className="field-hint">
                  Unico dentro deste cliente. Ex.: OBRA-01, FILIAL-SP.
                </p>
              </div>
              <div className="field field--span-2">
                <label htmlFor="unit-address">Endereco (opcional)</label>
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
                <label htmlFor="unit-city">Cidade (opcional)</label>
                <input
                  id="unit-city"
                  value={form.city}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, city: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="unit-state">UF (opcional)</label>
                <input
                  id="unit-state"
                  maxLength={2}
                  placeholder="SP"
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
              <label htmlFor="unit-notes">Observacoes (opcional)</label>
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
              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Salvando...'
                  : mode === 'create'
                    ? 'Cadastrar unidade'
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

      <section className="surface" aria-labelledby="units-list-title">
        <div className="form-section-header">
          <div>
            <p className="page-kicker">Unidades</p>
            <h2 id="units-list-title" className="page-title page-title--sm">
              Unidades operacionais
            </h2>
          </div>
        </div>

        {loading ? (
          <p className="page-lead">Carregando unidades...</p>
        ) : units.length === 0 ? (
          <div className="empty-state">
            <p className="page-title page-title--sm">
              Nenhuma unidade cadastrada
            </p>
            <p className="page-lead">
              Cadastre filiais, obras ou locais de entrega deste cliente. Em
              etapas futuras, trabalhadores e entregas poderao ser vinculados
              aqui.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreate}
            >
              Cadastrar primeira unidade
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Unidade</th>
                  <th scope="col">Codigo</th>
                  <th scope="col">Local</th>
                  <th scope="col">Status</th>
                  <th scope="col">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit.id}>
                    <td>
                      <strong>{unit.name}</strong>
                      {unit.addressLine ? (
                        <span className="table-sub">{unit.addressLine}</span>
                      ) : null}
                    </td>
                    <td className="mono">{unit.code || '—'}</td>
                    <td>{locationLabel(unit)}</td>
                    <td>
                      <span
                        className={`status-pill status-pill--${unit.status.toLowerCase()}`}
                      >
                        {statusLabel(unit.status)}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          onClick={() => openEdit(unit)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          onClick={() => void toggleStatus(unit)}
                        >
                          {unit.status === 'ACTIVE' ? 'Inativar' : 'Reativar'}
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

export default function ClienteDetalhePage() {
  return (
    <RequireAuth>
      {() => <ClienteDetalheContent />}
    </RequireAuth>
  );
}
