'use client';

import type {
  ClientLifeSummary,
  OperationalUnit,
  Worker,
} from '@gestao-epi/shared';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { formatCpf, formatCpfInput, stripCpf } from '../../../../lib/cpf';
import { listOperationalUnits } from '../../../../lib/operational-units';
import {
  createWorker,
  getClientLifeSummary,
  listWorkers,
  updateWorker,
  updateWorkerStatus,
} from '../../../../lib/workers';

type FormMode = 'closed' | 'create' | 'edit';

type WorkerFormState = {
  name: string;
  cpf: string;
  registration: string;
  role: string;
  department: string;
  operationalUnitId: string;
  admissionDate: string;
  notes: string;
};

const emptyForm: WorkerFormState = {
  name: '',
  cpf: '',
  registration: '',
  role: '',
  department: '',
  operationalUnitId: '',
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
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [units, setUnits] = useState<OperationalUnit[]>([]);
  const [lifeSummary, setLifeSummary] = useState<ClientLifeSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [mode, setMode] = useState<FormMode>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkerFormState>(emptyForm);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const [workerList, unitList, lives] = await Promise.all([
        listWorkers(clientId),
        listOperationalUnits(clientId),
        getClientLifeSummary(clientId),
      ]);
      setWorkers(workerList);
      setUnits(unitList);
      setLifeSummary(lives);
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

  function openCreate() {
    setMode('create');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function openEdit(worker: Worker) {
    setMode('edit');
    setEditingId(worker.id);
    setForm({
      name: worker.name,
      cpf: worker.cpf ? formatCpf(worker.cpf) : '',
      registration: worker.registration ?? '',
      role: worker.role ?? '',
      department: worker.department ?? '',
      operationalUnitId: worker.operationalUnitId ?? '',
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!clientId) return;
    setFormError(null);
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      cpf: stripCpf(form.cpf) || null,
      registration: form.registration.trim() || null,
      role: form.role.trim() || null,
      department: form.department.trim() || null,
      operationalUnitId:
        units.length === 0 ? null : form.operationalUnitId || null,
      admissionDate: form.admissionDate || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (mode === 'create') {
        await createWorker(clientId, {
          ...payload,
          cpf: payload.cpf ?? undefined,
          registration: payload.registration ?? undefined,
          role: payload.role ?? undefined,
          department: payload.department ?? undefined,
          operationalUnitId: payload.operationalUnitId ?? undefined,
          admissionDate: payload.admissionDate ?? undefined,
          notes: payload.notes ?? undefined,
        });
      } else if (mode === 'edit' && editingId) {
        await updateWorker(editingId, payload);
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

  async function toggleStatus(worker: Worker) {
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

  function unitNameById(id: string | null) {
    if (!id) return '—';
    return units.find((unit) => unit.id === id)?.name ?? '—';
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
                <label htmlFor="worker-role">Cargo / funcao</label>
                <input
                  id="worker-role"
                  value={form.role}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, role: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="worker-department">Departamento</label>
                <input
                  id="worker-department"
                  value={form.department}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      department: e.target.value,
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

      <section className="surface" aria-labelledby="workers-list-title">
        <div className="form-section-header">
          <div>
            <p className="page-kicker">Vidas</p>
            <h2 id="workers-list-title" className="page-title page-title--sm">
              Trabalhadores
            </h2>
            <p className="page-lead">
              Cada trabalhador ativo consome 1 vida da cota alocada.
            </p>
          </div>
          {mode === 'closed' ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Novo trabalhador
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
        ) : workers.length === 0 ? (
          <div className="empty-state">
            <p className="page-lead">Nenhum trabalhador cadastrado.</p>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Cadastrar primeiro trabalhador
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Matricula</th>
                  <th>Unidade</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((worker) => (
                  <tr key={worker.id}>
                    <td>
                      <strong>{worker.name}</strong>
                      {worker.role ? (
                        <span className="table-sub">{worker.role}</span>
                      ) : null}
                    </td>
                    <td className="mono">
                      {worker.cpf ? formatCpf(worker.cpf) : '—'}
                    </td>
                    <td className="mono">{worker.registration || '—'}</td>
                    <td>{unitNameById(worker.operationalUnitId)}</td>
                    <td>
                      <span
                        className={`status-pill status-pill--${worker.status.toLowerCase()}`}
                      >
                        {worker.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          onClick={() => openEdit(worker)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          onClick={() => void toggleStatus(worker)}
                        >
                          {worker.status === 'ACTIVE' ? 'Inativar' : 'Reativar'}
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
