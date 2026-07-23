'use client';

import type { QuotaSummary, ServedClient } from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import { formatCnpj, formatCnpjInput, normalizeCnpj, cnpjClientValidationMessage } from '../../lib/cnpj';
import {
  createServedClient,
  getQuotaSummary,
  listServedClients,
  updateServedClient,
  updateServedClientStatus,
} from '../../lib/served-clients';

type ListTab = 'clients' | 'create';
type FormMode = 'closed' | 'edit';

type ClientFormState = {
  legalName: string;
  tradeName: string;
  cnpj: string;
  allocatedLifeQuota: string;
  notes: string;
};

const emptyForm: ClientFormState = {
  legalName: '',
  tradeName: '',
  cnpj: '',
  allocatedLifeQuota: '0',
  notes: '',
};

function statusLabel(status: ServedClient['status']) {
  return status === 'ACTIVE' ? 'Ativo' : 'Inativo';
}

function ClientesContent() {
  const [clients, setClients] = useState<ServedClient[]>([]);
  const [summary, setSummary] = useState<QuotaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [listTab, setListTab] = useState<ListTab>('clients');
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientFormState>(emptyForm);
  const [createdClient, setCreatedClient] = useState<ServedClient | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [list, quotas] = await Promise.all([
        listServedClients(),
        getQuotaSummary(),
      ]);
      setClients(list);
      setSummary(quotas);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar os clientes.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const availableForForm = useMemo(() => {
    if (!summary) return 0;
    if (formMode === 'edit' && editingId) {
      const current = clients.find((item) => item.id === editingId);
      // Cliente inativo nao consome franquia; a cota so volta a contar ao reativar.
      if (current?.status === 'ACTIVE') {
        return summary.available + (current.allocatedLifeQuota ?? 0);
      }
      return summary.available;
    }
    return summary.available;
  }, [summary, formMode, editingId, clients]);

  function openCreateTab() {
    const available = summary?.available ?? 0;
    setListTab('create');
    setFormMode('closed');
    setEditingId(null);
    setCreatedClient(null);
    setForm({
      ...emptyForm,
      allocatedLifeQuota: String(Math.min(available, 10)),
    });
    setFormError(null);
  }

  function openClientsTab() {
    setListTab('clients');
    setFormMode('closed');
    setEditingId(null);
    setCreatedClient(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function openEdit(client: ServedClient) {
    setListTab('clients');
    setFormMode('edit');
    setEditingId(client.id);
    setForm({
      legalName: client.legalName,
      tradeName: client.tradeName ?? '',
      cnpj: formatCnpj(client.cnpj),
      allocatedLifeQuota: String(client.allocatedLifeQuota),
      notes: client.notes ?? '',
    });
    setFormError(null);
  }

  function closeEditForm() {
    setFormMode('closed');
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const cnpjError = cnpjClientValidationMessage(form.cnpj);
    if (cnpjError) {
      setFormError(cnpjError);
      return;
    }

    setSaving(true);

    const payload = {
      legalName: form.legalName.trim(),
      tradeName: form.tradeName.trim() || undefined,
      cnpj: normalizeCnpj(form.cnpj),
      allocatedLifeQuota: Number(form.allocatedLifeQuota),
      notes: form.notes.trim() || undefined,
    };

    try {
      if (listTab === 'create') {
        const created = await createServedClient(payload);
        setCreatedClient(created);
        setForm({
          ...emptyForm,
          allocatedLifeQuota: String(
            Math.min(summary?.available ?? 0, 10),
          ),
        });
      } else if (formMode === 'edit' && editingId) {
        await updateServedClient(editingId, payload);
        closeEditForm();
      }
      await load();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Nao foi possivel salvar.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(client: ServedClient) {
    setError(null);
    const nextStatus = client.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    if (nextStatus === 'INACTIVE') {
      const confirmed = window.confirm(
        'A empresa sera inativada e sua cota deixara de consumir a franquia.',
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      await updateServedClientStatus(client.id, nextStatus);
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel atualizar o status.',
      );
    }
  }

  const isCreateTab = listTab === 'create';

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Cadastros</p>
          <h1 className="page-title">Clientes atendidos</h1>
          <p className="page-lead">
            Cadastre CNPJs, distribua a franquia de vidas e configure a
            estrutura operacional (setores, funcoes e riscos) de cada cliente.
          </p>
        </div>
        <div className="header-actions header-actions--wrap">
          <button
            type="button"
            className="btn btn-secondary"
            disabled
            title="Importacao CSV sera liberada em breve"
          >
            Importar CSV (em breve)
          </button>
          <Link className="btn btn-secondary" href="/clientes/importar-pgro">
            Importar PGRO
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreateTab}
          >
            Novo cliente
          </button>
        </div>
      </header>

      {summary ? (
        <section className="quota-summary" aria-label="Resumo de cotas">
          <div className="quota-summary-item">
            <span className="quota-summary-label">Contratadas</span>
            <strong className="quota-summary-value">{summary.contracted}</strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Alocadas (ativas)</span>
            <strong className="quota-summary-value">{summary.allocated}</strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Liberadas (inativas)</span>
            <strong className="quota-summary-value">
              {summary.inactiveAllocated}
            </strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Disponiveis</span>
            <strong className="quota-summary-value">{summary.available}</strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Clientes ativos</span>
            <strong className="quota-summary-value">
              {summary.activeClients}
            </strong>
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div
        className="panel-tabs"
        role="tablist"
        aria-label="Secoes de clientes"
      >
        <button
          type="button"
          role="tab"
          className={`panel-tab ${listTab === 'clients' ? 'is-active' : ''}`}
          aria-selected={listTab === 'clients'}
          onClick={openClientsTab}
        >
          Clientes
        </button>
        <button
          type="button"
          role="tab"
          className={`panel-tab ${isCreateTab ? 'is-active' : ''}`}
          aria-selected={isCreateTab}
          onClick={openCreateTab}
        >
          Novo cliente
        </button>
      </div>

      {isCreateTab ? (
        <section className="surface" aria-labelledby="client-form-title">
          {createdClient ? (
            <div className="empty-state">
              <p className="page-kicker">Cliente criado</p>
              <h2
                id="client-form-title"
                className="page-title page-title--sm"
              >
                {createdClient.tradeName || createdClient.legalName}
              </h2>
              <p className="page-lead">
                Configure agora setores, funcoes, riscos e EPIs necessarios.
              </p>
              <div className="btn-row">
                <Link
                  className="btn btn-primary"
                  href={`/clientes/${createdClient.id}/estrutura`}
                >
                  Configurar estrutura agora
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={openClientsTab}
                >
                  Voltar para lista
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="form-section-header">
                <div>
                  <p className="page-kicker">Novo cadastro</p>
                  <h2
                    id="client-form-title"
                    className="page-title page-title--sm"
                  >
                    Novo cliente atendido
                  </h2>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={openClientsTab}
                >
                  Voltar a lista
                </button>
              </div>

              <form className="form form--wide" onSubmit={onSubmit} noValidate>
                <ClientFormFields
                  form={form}
                  setForm={setForm}
                  availableForForm={availableForForm}
                />

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
                    {saving ? 'Salvando...' : 'Cadastrar cliente'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={openClientsTab}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      ) : (
        <>
          {formMode === 'edit' ? (
            <section className="surface" aria-labelledby="client-edit-title">
              <div className="form-section-header">
                <div>
                  <p className="page-kicker">Editar cadastro</p>
                  <h2
                    id="client-edit-title"
                    className="page-title page-title--sm"
                  >
                    Editar cliente
                  </h2>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeEditForm}
                >
                  Cancelar
                </button>
              </div>

              <form className="form form--wide" onSubmit={onSubmit} noValidate>
                <ClientFormFields
                  form={form}
                  setForm={setForm}
                  availableForForm={availableForForm}
                />

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
                    {saving ? 'Salvando...' : 'Salvar alteracoes'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeEditForm}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="surface" aria-labelledby="clients-list-title">
            <div className="form-section-header">
              <div>
                <p className="page-kicker">Lista operacional</p>
                <h2 id="clients-list-title" className="page-title page-title--sm">
                  Clientes da organizacao
                </h2>
              </div>
            </div>

            {loading ? (
              <p className="page-lead">Carregando clientes...</p>
            ) : clients.length === 0 ? (
              <div className="empty-state">
                <p className="page-title page-title--sm">
                  Nenhum cliente cadastrado
                </p>
                <p className="page-lead">
                  Cadastre o primeiro CNPJ atendido e aloque parte da franquia
                  de vidas.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openCreateTab}
                >
                  Cadastrar primeiro cliente
                </button>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Cliente</th>
                      <th scope="col">CNPJ</th>
                      <th scope="col">Status</th>
                      <th scope="col">Cota</th>
                      <th scope="col">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id}>
                        <td>
                          <strong>
                            {client.tradeName || client.legalName}
                          </strong>
                          {client.tradeName ? (
                            <span className="table-sub">
                              {client.legalName}
                            </span>
                          ) : null}
                        </td>
                        <td className="mono">{formatCnpj(client.cnpj)}</td>
                        <td>
                          <span
                            className={`status-pill status-pill--${client.status.toLowerCase()}`}
                          >
                            {statusLabel(client.status)}
                          </span>
                        </td>
                        <td className="mono">
                          {client.allocatedLifeQuota}
                          {client.status === 'INACTIVE' ? (
                            <span className="table-sub">
                              nao consome franquia
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <div className="table-actions">
                            <Link
                              className="btn btn-primary btn-compact"
                              href={`/clientes/${client.id}/estrutura`}
                            >
                              Estrutura
                            </Link>
                            <Link
                              className="btn btn-secondary btn-compact"
                              href={`/clientes/${client.id}`}
                            >
                              Abrir
                            </Link>
                            <button
                              type="button"
                              className="btn btn-secondary btn-compact"
                              onClick={() => openEdit(client)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-compact"
                              onClick={() => void toggleStatus(client)}
                            >
                              {client.status === 'ACTIVE'
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
      )}
    </div>
  );
}

function ClientFormFields({
  form,
  setForm,
  availableForForm,
}: {
  form: ClientFormState;
  setForm: Dispatch<SetStateAction<ClientFormState>>;
  availableForForm: number;
}) {
  return (
    <>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="legalName">Razao social</label>
          <input
            id="legalName"
            required
            minLength={2}
            value={form.legalName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, legalName: e.target.value }))
            }
          />
        </div>
        <div className="field">
          <label htmlFor="tradeName">Nome fantasia (opcional)</label>
          <input
            id="tradeName"
            value={form.tradeName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, tradeName: e.target.value }))
            }
          />
        </div>
        <div className="field">
          <label htmlFor="cnpj">CNPJ</label>
          <input
            id="cnpj"
            autoComplete="off"
            required
            placeholder="00.000.000/0000-00"
            value={form.cnpj}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                cnpj: formatCnpjInput(e.target.value),
              }))
            }
          />
          <p className="field-hint">
            Aceita CNPJ numerico ou alfanumerico, com ou sem mascara.
            Armazenado sem formatacao.
          </p>
        </div>
        <div className="field">
          <label htmlFor="allocatedLifeQuota">Cota de vidas</label>
          <input
            id="allocatedLifeQuota"
            type="number"
            min={0}
            max={availableForForm}
            required
            value={form.allocatedLifeQuota}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                allocatedLifeQuota: e.target.value,
              }))
            }
          />
          <p className="field-hint">
            Disponivel nesta franquia: {availableForForm} vidas.
          </p>
        </div>
      </div>

      <div className="field">
        <label htmlFor="notes">Observacoes (opcional)</label>
        <textarea
          id="notes"
          rows={3}
          value={form.notes}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, notes: e.target.value }))
          }
        />
      </div>

      <aside className="cnpj-lookup-slot" aria-label="Consulta de CNPJ">
        <p className="page-kicker">Consulta cadastral</p>
        <p className="field-hint">
          Em breve: preencher razao social automaticamente pela Receita
          Federal. Por enquanto, informe os dados manualmente.
        </p>
        <button type="button" className="btn btn-secondary" disabled>
          Consultar CNPJ (em breve)
        </button>
      </aside>
    </>
  );
}

export default function ClientesPage() {
  return (
    <RequireAuth>
      {() => <ClientesContent />}
    </RequireAuth>
  );
}
