'use client';

import type {
  ClientLifeSummary,
  OperationalUnit,
  ServedClient,
  Worker,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '../../../components/RequireAuth';
import { formatCnpj, formatCnpjInput, normalizeCnpj } from '../../../lib/cnpj';
import { formatCpf, formatCpfInput, stripCpf } from '../../../lib/cpf';
import {
  createOperationalUnit,
  listOperationalUnits,
  updateOperationalUnit,
  updateOperationalUnitStatus,
} from '../../../lib/operational-units';
import { getServedClient } from '../../../lib/served-clients';
import {
  createWorker,
  getClientLifeSummary,
  listWorkers,
  updateWorker,
  updateWorkerStatus,
} from '../../../lib/workers';

type FormMode = 'closed' | 'create' | 'edit';
type Panel = 'units' | 'workers';

type UnitFormState = {
  name: string;
  code: string;
  cnpj: string;
  addressLine: string;
  city: string;
  state: string;
  notes: string;
};

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

const emptyUnitForm: UnitFormState = {
  name: '',
  code: '',
  cnpj: '',
  addressLine: '',
  city: '',
  state: '',
  notes: '',
};

const emptyWorkerForm: WorkerFormState = {
  name: '',
  cpf: '',
  registration: '',
  role: '',
  department: '',
  operationalUnitId: '',
  admissionDate: '',
  notes: '',
};

function statusLabel(status: 'ACTIVE' | 'INACTIVE') {
  return status === 'ACTIVE' ? 'Ativo' : 'Inativo';
}

function locationLabel(unit: OperationalUnit) {
  const parts = [unit.city, unit.state].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : '—';
}

function toDateInput(value: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function ClienteDetalheContent() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [client, setClient] = useState<ServedClient | null>(null);
  const [units, setUnits] = useState<OperationalUnit[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [lifeSummary, setLifeSummary] = useState<ClientLifeSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitFormError, setUnitFormError] = useState<string | null>(null);
  const [workerFormError, setWorkerFormError] = useState<string | null>(null);
  const [unitMode, setUnitMode] = useState<FormMode>('closed');
  const [workerMode, setWorkerMode] = useState<FormMode>('closed');
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [unitForm, setUnitForm] = useState<UnitFormState>(emptyUnitForm);
  const [workerForm, setWorkerForm] =
    useState<WorkerFormState>(emptyWorkerForm);
  const [activePanel, setActivePanel] = useState<Panel>('workers');

  const load = useCallback(async () => {
    if (!clientId) return;
    setError(null);
    setLoading(true);
    try {
      const [servedClient, unitList, workerList, lives] = await Promise.all([
        getServedClient(clientId),
        listOperationalUnits(clientId),
        listWorkers(clientId),
        getClientLifeSummary(clientId),
      ]);
      setClient(servedClient);
      setUnits(unitList);
      setWorkers(workerList);
      setLifeSummary(lives);
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

  function openCreateUnit() {
    setActivePanel('units');
    setWorkerMode('closed');
    setUnitMode('create');
    setEditingUnitId(null);
    setUnitForm(emptyUnitForm);
    setUnitFormError(null);
  }

  function openEditUnit(unit: OperationalUnit) {
    setActivePanel('units');
    setWorkerMode('closed');
    setUnitMode('edit');
    setEditingUnitId(unit.id);
    setUnitForm({
      name: unit.name,
      code: unit.code ?? '',
      cnpj: unit.cnpj ? formatCnpj(unit.cnpj) : '',
      addressLine: unit.addressLine ?? '',
      city: unit.city ?? '',
      state: unit.state ?? '',
      notes: unit.notes ?? '',
    });
    setUnitFormError(null);
  }

  function closeUnitForm() {
    setUnitMode('closed');
    setEditingUnitId(null);
    setUnitForm(emptyUnitForm);
    setUnitFormError(null);
  }

  function openCreateWorker() {
    setActivePanel('workers');
    setUnitMode('closed');
    setWorkerMode('create');
    setEditingWorkerId(null);
    setWorkerForm(emptyWorkerForm);
    setWorkerFormError(null);
  }

  function openEditWorker(worker: Worker) {
    setActivePanel('workers');
    setUnitMode('closed');
    setWorkerMode('edit');
    setEditingWorkerId(worker.id);
    setWorkerForm({
      name: worker.name,
      cpf: worker.cpf ? formatCpf(worker.cpf) : '',
      registration: worker.registration ?? '',
      role: worker.role ?? '',
      department: worker.department ?? '',
      operationalUnitId: worker.operationalUnitId ?? '',
      admissionDate: toDateInput(worker.admissionDate),
      notes: worker.notes ?? '',
    });
    setWorkerFormError(null);
  }

  function closeWorkerForm() {
    setWorkerMode('closed');
    setEditingWorkerId(null);
    setWorkerForm(emptyWorkerForm);
    setWorkerFormError(null);
  }

  async function onSubmitUnit(event: FormEvent) {
    event.preventDefault();
    if (!clientId) return;
    setUnitFormError(null);
    setSaving(true);

    const payload = {
      name: unitForm.name.trim(),
      code: unitForm.code.trim() || null,
      cnpj: normalizeCnpj(unitForm.cnpj) || null,
      addressLine: unitForm.addressLine.trim() || null,
      city: unitForm.city.trim() || null,
      state: unitForm.state.trim() || null,
      notes: unitForm.notes.trim() || null,
    };

    try {
      if (unitMode === 'create') {
        await createOperationalUnit(clientId, {
          name: payload.name,
          code: payload.code ?? undefined,
          cnpj: payload.cnpj ?? undefined,
          addressLine: payload.addressLine ?? undefined,
          city: payload.city ?? undefined,
          state: payload.state ?? undefined,
          notes: payload.notes ?? undefined,
        });
      } else if (unitMode === 'edit' && editingUnitId) {
        await updateOperationalUnit(editingUnitId, payload);
      }
      closeUnitForm();
      await load();
    } catch (err) {
      setUnitFormError(
        err instanceof Error ? err.message : 'Nao foi possivel salvar.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitWorker(event: FormEvent) {
    event.preventDefault();
    if (!clientId) return;
    setWorkerFormError(null);
    setSaving(true);

    const payload = {
      name: workerForm.name.trim(),
      cpf: stripCpf(workerForm.cpf) || null,
      registration: workerForm.registration.trim() || null,
      role: workerForm.role.trim() || null,
      department: workerForm.department.trim() || null,
      operationalUnitId:
        units.length === 0 ? null : workerForm.operationalUnitId || null,
      admissionDate: workerForm.admissionDate || null,
      notes: workerForm.notes.trim() || null,
    };

    try {
      if (workerMode === 'create') {
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
      } else if (workerMode === 'edit' && editingWorkerId) {
        await updateWorker(editingWorkerId, payload);
      }
      closeWorkerForm();
      await load();
    } catch (err) {
      setWorkerFormError(
        err instanceof Error ? err.message : 'Nao foi possivel salvar.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleUnitStatus(unit: OperationalUnit) {
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

  async function toggleWorkerStatus(worker: Worker) {
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
            Gerencie unidades operacionais e trabalhadores (vidas) deste CNPJ.
          </p>
        </div>
        <div className="header-actions header-actions--wrap">
          <Link className="btn btn-secondary" href="/clientes">
            Voltar
          </Link>
          <Link
            className="btn btn-secondary"
            href={`/clientes/${client.id}/estrutura`}
          >
            Estrutura
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={openCreateUnit}
          >
            Nova unidade
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreateWorker}
          >
            Novo trabalhador
          </button>
        </div>
      </header>

      {lifeSummary ? (
        <section className="quota-summary" aria-label="Resumo de vidas">
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
            <span className="quota-summary-label">Trabalhadores ativos</span>
            <strong className="quota-summary-value">
              {lifeSummary.activeWorkers}
            </strong>
          </div>
        </section>
      ) : null}

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
        </dl>
      </section>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="panel-tabs" role="tablist" aria-label="Secoes do cliente">
        <button
          type="button"
          role="tab"
          className={`panel-tab ${activePanel === 'workers' ? 'is-active' : ''}`}
          aria-selected={activePanel === 'workers'}
          onClick={() => setActivePanel('workers')}
        >
          Trabalhadores
        </button>
        <button
          type="button"
          role="tab"
          className={`panel-tab ${activePanel === 'units' ? 'is-active' : ''}`}
          aria-selected={activePanel === 'units'}
          onClick={() => setActivePanel('units')}
        >
          Unidades
        </button>
      </div>

      {activePanel === 'workers' ? (
        <>
          {workerMode !== 'closed' ? (
            <section className="surface" aria-labelledby="worker-form-title">
              <div className="form-section-header">
                <div>
                  <p className="page-kicker">
                    {workerMode === 'create' ? 'Novo cadastro' : 'Editar'}
                  </p>
                  <h2
                    id="worker-form-title"
                    className="page-title page-title--sm"
                  >
                    {workerMode === 'create'
                      ? 'Novo trabalhador'
                      : 'Editar trabalhador'}
                  </h2>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeWorkerForm}
                >
                  Cancelar
                </button>
              </div>

              <form
                className="form form--wide"
                onSubmit={onSubmitWorker}
                noValidate
              >
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="worker-name">Nome</label>
                    <input
                      id="worker-name"
                      required
                      minLength={2}
                      value={workerForm.name}
                      onChange={(e) =>
                        setWorkerForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="worker-cpf">CPF (opcional)</label>
                    <input
                      id="worker-cpf"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={workerForm.cpf}
                      onChange={(e) =>
                        setWorkerForm((prev) => ({
                          ...prev,
                          cpf: formatCpfInput(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="worker-registration">
                      Matricula (opcional)
                    </label>
                    <input
                      id="worker-registration"
                      value={workerForm.registration}
                      onChange={(e) =>
                        setWorkerForm((prev) => ({
                          ...prev,
                          registration: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="worker-role">Cargo/funcao (opcional)</label>
                    <input
                      id="worker-role"
                      value={workerForm.role}
                      onChange={(e) =>
                        setWorkerForm((prev) => ({
                          ...prev,
                          role: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="worker-department">
                      Departamento (opcional)
                    </label>
                    <input
                      id="worker-department"
                      value={workerForm.department}
                      onChange={(e) =>
                        setWorkerForm((prev) => ({
                          ...prev,
                          department: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="worker-unit">
                      Unidade operacional (opcional)
                    </label>
                    {units.length === 0 ? (
                      <div className="empty-unit-slot">
                        <p className="field-hint" id="worker-unit-empty">
                          Nenhuma unidade cadastrada para este cliente. Voce
                          pode salvar o trabalhador sem unidade ou cadastrar
                          uma unidade na aba Unidades.
                        </p>
                        <input
                          id="worker-unit"
                          type="hidden"
                          value=""
                          readOnly
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-compact"
                          onClick={() => {
                            closeWorkerForm();
                            setActivePanel('units');
                            openCreateUnit();
                          }}
                        >
                          Ir para Unidades
                        </button>
                      </div>
                    ) : (
                      <select
                        id="worker-unit"
                        value={workerForm.operationalUnitId}
                        onChange={(e) =>
                          setWorkerForm((prev) => ({
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
                    )}
                  </div>
                  <div className="field">
                    <label htmlFor="worker-admission">
                      Admissao (opcional)
                    </label>
                    <input
                      id="worker-admission"
                      type="date"
                      value={workerForm.admissionDate}
                      onChange={(e) =>
                        setWorkerForm((prev) => ({
                          ...prev,
                          admissionDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="worker-notes">Observacoes (opcional)</label>
                  <textarea
                    id="worker-notes"
                    rows={3}
                    value={workerForm.notes}
                    onChange={(e) =>
                      setWorkerForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>

                <aside className="cnpj-lookup-slot" aria-label="Consulta de CPF">
                  <p className="page-kicker">Consulta cadastral</p>
                  <p className="field-hint">
                    Em breve: validacao/consulta externa de CPF. Por enquanto,
                    informe os dados manualmente.
                  </p>
                  <button type="button" className="btn btn-secondary" disabled>
                    Consultar CPF (em breve)
                  </button>
                </aside>

                {workerFormError ? (
                  <p className="error" role="alert">
                    {workerFormError}
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
                      : workerMode === 'create'
                        ? 'Cadastrar trabalhador'
                        : 'Salvar alteracoes'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeWorkerForm}
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
                <h2
                  id="workers-list-title"
                  className="page-title page-title--sm"
                >
                  Trabalhadores
                </h2>
              </div>
              {workerMode === 'closed' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openCreateWorker}
                >
                  Novo trabalhador
                </button>
              ) : null}
            </div>

            {loading ? (
              <p className="page-lead">Carregando trabalhadores...</p>
            ) : workers.length === 0 ? (
              <div className="empty-state">
                <p className="page-title page-title--sm">
                  Nenhum trabalhador cadastrado
                </p>
                <p className="page-lead">
                  Cadastre vidas ativas deste cliente. Cada trabalhador ativo
                  consome 1 vida da cota alocada.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openCreateWorker}
                >
                  Cadastrar primeiro trabalhador
                </button>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Nome</th>
                      <th scope="col">CPF</th>
                      <th scope="col">Matricula</th>
                      <th scope="col">Unidade</th>
                      <th scope="col">Status</th>
                      <th scope="col">Acoes</th>
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
                        <td className="mono">
                          {worker.registration || '—'}
                        </td>
                        <td>{unitNameById(worker.operationalUnitId)}</td>
                        <td>
                          <span
                            className={`status-pill status-pill--${worker.status.toLowerCase()}`}
                          >
                            {statusLabel(worker.status)}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="btn btn-secondary btn-compact"
                              onClick={() => openEditWorker(worker)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-compact"
                              onClick={() => void toggleWorkerStatus(worker)}
                            >
                              {worker.status === 'ACTIVE'
                                ? 'Inativar'
                                : 'Reativar'}
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
        </>
      ) : null}

      {activePanel === 'units' ? (
        <>
          {unitMode !== 'closed' ? (
            <section className="surface" aria-labelledby="unit-form-title">
              <div className="form-section-header">
                <div>
                  <p className="page-kicker">
                    {unitMode === 'create' ? 'Novo cadastro' : 'Editar'}
                  </p>
                  <h2 id="unit-form-title" className="page-title page-title--sm">
                    {unitMode === 'create'
                      ? 'Nova unidade operacional'
                      : 'Editar unidade'}
                  </h2>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeUnitForm}
                >
                  Cancelar
                </button>
              </div>

              <form
                className="form form--wide"
                onSubmit={onSubmitUnit}
                noValidate
              >
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="unit-name">Nome</label>
                    <input
                      id="unit-name"
                      required
                      minLength={2}
                      value={unitForm.name}
                      onChange={(e) =>
                        setUnitForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="unit-code">Codigo (opcional)</label>
                    <input
                      id="unit-code"
                      value={unitForm.code}
                      onChange={(e) =>
                        setUnitForm((prev) => ({
                          ...prev,
                          code: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="field field--span-2">
                    <label htmlFor="unit-cnpj">
                      CNPJ da unidade (opcional)
                    </label>
                    <input
                      id="unit-cnpj"
                      autoComplete="off"
                      placeholder="00.000.000/0000-00"
                      value={unitForm.cnpj}
                      onChange={(e) =>
                        setUnitForm((prev) => ({
                          ...prev,
                          cnpj: formatCnpjInput(e.target.value),
                        }))
                      }
                    />
                    <p className="field-hint">
                      Use quando a unidade for uma filial formal com CNPJ
                      proprio. Para setor/obra/local sem CNPJ, deixe em branco.
                    </p>
                  </div>
                  <div className="field field--span-2">
                    <label htmlFor="unit-address">Endereco (opcional)</label>
                    <input
                      id="unit-address"
                      value={unitForm.addressLine}
                      onChange={(e) =>
                        setUnitForm((prev) => ({
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
                      value={unitForm.city}
                      onChange={(e) =>
                        setUnitForm((prev) => ({
                          ...prev,
                          city: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="unit-state">UF (opcional)</label>
                    <input
                      id="unit-state"
                      maxLength={2}
                      value={unitForm.state}
                      onChange={(e) =>
                        setUnitForm((prev) => ({
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
                    value={unitForm.notes}
                    onChange={(e) =>
                      setUnitForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>
                {unitFormError ? (
                  <p className="error" role="alert">
                    {unitFormError}
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
                      : unitMode === 'create'
                        ? 'Cadastrar unidade'
                        : 'Salvar alteracoes'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeUnitForm}
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
              {unitMode === 'closed' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openCreateUnit}
                >
                  Nova unidade
                </button>
              ) : null}
            </div>

            {loading ? (
              <p className="page-lead">Carregando unidades...</p>
            ) : units.length === 0 ? (
              <div className="empty-state">
                <p className="page-title page-title--sm">
                  Nenhuma unidade cadastrada
                </p>
                <p className="page-lead">
                  Cadastre filiais, obras ou locais de entrega deste cliente.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openCreateUnit}
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
                      <th scope="col">CNPJ</th>
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
                        <td className="mono">
                          {unit.cnpj ? formatCnpj(unit.cnpj) : '—'}
                        </td>
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
                              onClick={() => openEditUnit(unit)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-compact"
                              onClick={() => void toggleUnitStatus(unit)}
                            >
                              {unit.status === 'ACTIVE'
                                ? 'Inativar'
                                : 'Reativar'}
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
        </>
      ) : null}
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
