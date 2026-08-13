'use client';

import type { QuotaSummary, ServedClient } from '@gestao-epi/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import { PageHeader } from '../../components/ui/PageHeader';
import { storeClientAccessOnce } from '../../lib/client-access-session';
import {
  formatCnpj,
  formatCnpjInput,
  normalizeCnpj,
  cnpjClientValidationMessage,
} from '../../lib/cnpj';
import {
  createServedClient,
  getQuotaSummary,
  listServedClients,
  updateServedClient,
  updateServedClientStatus,
} from '../../lib/served-clients';

type ListTab = 'clients' | 'create';
type CreateStep = 'choose' | 'manual';
type FormMode = 'closed' | 'edit';

type ClientFormState = {
  legalName: string;
  tradeName: string;
  cnpj: string;
  allocatedLifeQuota: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  initialManagerName: string;
  initialManagerEmail: string;
  initialManagerPhone: string;
};

const emptyForm: ClientFormState = {
  legalName: '',
  tradeName: '',
  cnpj: '',
  allocatedLifeQuota: '0',
  contactEmail: '',
  contactPhone: '',
  notes: '',
  initialManagerName: '',
  initialManagerEmail: '',
  initialManagerPhone: '',
};

function statusLabel(status: ServedClient['status']) {
  return status === 'ACTIVE' ? 'Ativo' : 'Inativo';
}

function ClientesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<ServedClient[]>([]);
  const [summary, setSummary] = useState<QuotaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [listTab, setListTab] = useState<ListTab>('clients');
  const [createStep, setCreateStep] = useState<CreateStep>('choose');
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientFormState>(emptyForm);
  const [clientQuery, setClientQuery] = useState('');

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
    setCreateStep('choose');
    setFormMode('closed');
    setEditingId(null);
    setForm({
      ...emptyForm,
      allocatedLifeQuota: String(Math.min(available, 10)),
    });
    setFormError(null);
  }

  useEffect(() => {
    if (searchParams.get('novo') !== '1') return;
    const available = summary?.available ?? 0;
    setListTab('create');
    setCreateStep('choose');
    setFormMode('closed');
    setEditingId(null);
    setForm({
      ...emptyForm,
      allocatedLifeQuota: String(Math.min(available, 10)),
    });
    setFormError(null);
    router.replace('/clientes');
  }, [searchParams, router, summary?.available]);

  function openManualCreate() {
    setCreateStep('manual');
    setFormError(null);
  }

  function openClientsTab() {
    setListTab('clients');
    setCreateStep('choose');
    setFormMode('closed');
    setEditingId(null);
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
      contactEmail: client.contactEmail ?? '',
      contactPhone: client.contactPhone ?? '',
      notes: client.notes ?? '',
      initialManagerName: '',
      initialManagerEmail: '',
      initialManagerPhone: '',
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

    const managerName = form.initialManagerName.trim();
    const managerEmail = form.initialManagerEmail.trim();
    if (listTab === 'create' && (managerName || managerEmail)) {
      if (!managerName || !managerEmail) {
        setFormError(
          'Para criar o gestor inicial, informe nome e e-mail.',
        );
        return;
      }
    }

    setSaving(true);

    const payload = {
      legalName: form.legalName.trim(),
      tradeName: form.tradeName.trim() || undefined,
      cnpj: normalizeCnpj(form.cnpj),
      allocatedLifeQuota: Number(form.allocatedLifeQuota),
      contactEmail: form.contactEmail.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      notes: form.notes.trim() || undefined,
      ...(listTab === 'create' && managerName && managerEmail
        ? {
            initialManagerName: managerName,
            initialManagerEmail: managerEmail,
            initialManagerPhone:
              form.initialManagerPhone.trim() || undefined,
          }
        : {}),
    };

    try {
      if (listTab === 'create') {
        const result = await createServedClient(payload);
        if (result.initialAccess) {
          storeClientAccessOnce(result.client.id, result.initialAccess);
        }
        await load();
        router.push(`/clientes/${result.client.id}/usuarios`);
        return;
      }
      if (formMode === 'edit' && editingId) {
        await updateServedClient(editingId, {
          legalName: payload.legalName,
          tradeName: payload.tradeName ?? null,
          cnpj: payload.cnpj,
          allocatedLifeQuota: payload.allocatedLifeQuota,
          contactEmail: form.contactEmail.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          notes: payload.notes ?? null,
        });
        closeEditForm();
        await load();
      }
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

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) => {
      const hay = [
        client.legalName,
        client.tradeName ?? '',
        client.cnpj,
        formatCnpj(client.cnpj),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [clients, clientQuery]);

  return (
    <div className="module-page">
      <PageHeader
        kicker="Cadastros"
        title="Clientes atendidos"
        lead="Implante um CNPJ: cadastre os dados ou importe o PGR. Depois abra o workspace para estrutura, vidas e acesso ao portal."
        actions={
          listTab === 'clients' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateTab}
            >
              Novo cliente
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openClientsTab}
            >
              Voltar a lista
            </button>
          )
        }
      />

      {summary && listTab === 'clients' ? (
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

      {isCreateTab ? (
        createStep === 'choose' ? (
          <section
            className="surface ux-enter"
            aria-labelledby="create-choose-title"
          >
            <div className="form-section-header">
              <div>
                <p className="page-kicker">Novo cliente</p>
                <h2
                  id="create-choose-title"
                  className="page-title page-title--sm"
                >
                  Como deseja comecar?
                </h2>
                <p className="page-lead">
                  Escolha uma forma de implantar. As duas levam ao workspace do
                  cliente — a diferenca e so o ponto de partida.
                </p>
              </div>
            </div>

            <div className="action-strip" aria-label="Opcoes de cadastro">
              <button
                type="button"
                className="action-tile action-tile--primary"
                onClick={openManualCreate}
              >
                <p className="action-tile__kicker">Opcao 1</p>
                <h3 className="action-tile__title">Inserir dados</h3>
                <p className="action-tile__desc">
                  Informe CNPJ, razao social e cotas. Depois importe o PGR no
                  workspace, se quiser.
                </p>
              </button>
              <Link
                href="/clientes/importar-pgro?origem=novo-cliente"
                className="action-tile"
              >
                <p className="action-tile__kicker">Opcao 2</p>
                <h3 className="action-tile__title">Importar PGR</h3>
                <p className="action-tile__desc">
                  Use o PDF do PGR para criar o cliente e a estrutura de
                  uma vez.
                </p>
              </Link>
            </div>
          </section>
        ) : (
          <section
            className="surface ux-enter"
            aria-labelledby="client-form-title"
          >
            <div className="form-section-header">
              <div>
                <p className="page-kicker">Novo cliente · dados manuais</p>
                <h2
                  id="client-form-title"
                  className="page-title page-title--sm"
                >
                  Dados da empresa
                </h2>
                <p className="page-lead">
                  Preencha o essencial. Apos salvar, abrimos o workspace para
                  estrutura/PGR, trabalhadores e usuarios do portal.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCreateStep('choose')}
              >
                Trocar forma de cadastro
              </button>
            </div>

            <form className="form form--wide" onSubmit={onSubmit} noValidate>
              <ClientFormFields
                form={form}
                setForm={setForm}
                availableForForm={availableForForm}
                showInitialManager
              />

              {formError ? (
                <p className="error" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="flow-sticky-bar">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCreateStep('choose')}
                  disabled={saving}
                >
                  Voltar
                </button>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? 'Salvando e abrindo painel...'
                    : 'Cadastrar e continuar'}
                </button>
              </div>
            </form>
          </section>
        )
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
                <p className="page-kicker">Lista</p>
                <h2 id="clients-list-title" className="page-title page-title--sm">
                  Clientes da organizacao
                </h2>
              </div>
            </div>

            {clients.length > 0 ? (
              <div className="client-search">
                <label htmlFor="client-search" className="field-hint">
                  Buscar por nome ou CNPJ
                </label>
                <input
                  id="client-search"
                  type="search"
                  placeholder="Ex.: Acme ou 12.345.678/0001-90"
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                />
              </div>
            ) : null}

            {loading ? (
              <p className="page-lead">Carregando clientes...</p>
            ) : clients.length === 0 ? (
              <div className="empty-state">
                <p className="page-title page-title--sm">
                  Nenhum cliente cadastrado
                </p>
                <p className="page-lead">
                  Comece pelo cadastro: inserir dados manuais ou importar o
                  PGR.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openCreateTab}
                >
                  Novo cliente
                </button>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="empty-state">
                <p className="page-lead">
                  Nenhum cliente encontrado para &quot;{clientQuery}&quot;.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setClientQuery('')}
                >
                  Limpar busca
                </button>
              </div>
            ) : (
              <div className="stack-list" role="list" aria-label="Clientes">
                {filteredClients.map((client) => (
                  <article key={client.id} role="listitem" className="stack-card">
                    <div className="stack-card__body stack-card__body--stack">
                      <div className="stack-card__main">
                        <strong className="stack-card__title">
                          {client.tradeName || client.legalName}
                        </strong>
                        {client.tradeName ? (
                          <p className="stack-card__meta">{client.legalName}</p>
                        ) : null}
                        <p className="stack-card__meta mono">
                          {formatCnpj(client.cnpj)}
                        </p>
                        <p className="stack-card__meta">
                          Alocadas {client.allocatedLifeQuota} · Utilizadas{' '}
                          {client.usedLives ?? 0}
                          {client.status === 'INACTIVE'
                            ? ' · nao consome franquia'
                            : ''}
                        </p>
                        <span
                          className={`status-pill status-pill--${client.status.toLowerCase()}`}
                          style={{ marginTop: '0.45rem' }}
                        >
                          {statusLabel(client.status)}
                        </span>
                      </div>
                      <div className="stack-card__actions">
                        <Link
                          className="btn btn-primary"
                          href={`/clientes/${client.id}`}
                        >
                          Abrir
                        </Link>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => openEdit(client)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => void toggleStatus(client)}
                        >
                          {client.status === 'ACTIVE' ? 'Inativar' : 'Reativar'}
                        </button>
                      </div>
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

function ClientFormFields({
  form,
  setForm,
  availableForForm,
  showInitialManager = false,
}: {
  form: ClientFormState;
  setForm: Dispatch<SetStateAction<ClientFormState>>;
  availableForForm: number;
  showInitialManager?: boolean;
}) {
  return (
    <>
      <fieldset className="epi-form-section">
        <div className="epi-form-section__head">
          <h3>Empresa</h3>
          <p>Identificacao e cotas de vidas deste cliente.</p>
        </div>
        <div className="form-grid">
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
              Disponivel na franquia: {availableForForm}.
            </p>
          </div>
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
        </div>
      </fieldset>

      <fieldset className="epi-form-section">
        <div className="epi-form-section__head">
          <h3>Contato institucional (opcional)</h3>
          <p>Para alertas da consultoria. Pode ser diferente do gestor do portal.</p>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="contactEmail">E-mail</label>
            <input
              id="contactEmail"
              type="email"
              value={form.contactEmail}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contactEmail: e.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="contactPhone">WhatsApp / telefone</label>
            <input
              id="contactPhone"
              value={form.contactPhone}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contactPhone: e.target.value }))
              }
            />
          </div>
          <div className="field field--span-2">
            <label htmlFor="notes">Observacoes</label>
            <textarea
              id="notes"
              rows={2}
              value={form.notes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </div>
        </div>
      </fieldset>

      {showInitialManager ? (
        <fieldset className="epi-form-section">
          <div className="epi-form-section__head">
            <h3>Gestor do portal (opcional)</h3>
            <p>
              Se informar agora, a senha temporaria aparece uma unica vez apos
              salvar. Voce tambem pode criar depois em Usuarios.
            </p>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="initialManagerName">Nome</label>
              <input
                id="initialManagerName"
                value={form.initialManagerName}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    initialManagerName: e.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="initialManagerEmail">E-mail</label>
              <input
                id="initialManagerEmail"
                type="email"
                value={form.initialManagerEmail}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    initialManagerEmail: e.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="initialManagerPhone">WhatsApp</label>
              <input
                id="initialManagerPhone"
                value={form.initialManagerPhone}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    initialManagerPhone: e.target.value,
                  }))
                }
                placeholder="11999999999"
              />
            </div>
          </div>
        </fieldset>
      ) : null}
    </>
  );
}

export default function ClientesPage() {
  return (
    <RequireAuth>
      {() => (
        <Suspense fallback={<p className="page-lead">Carregando clientes...</p>}>
          <ClientesContent />
        </Suspense>
      )}
    </RequireAuth>
  );
}
