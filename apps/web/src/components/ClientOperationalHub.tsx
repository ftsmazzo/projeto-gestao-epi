'use client';

import type {
  ClientInitialAccess,
  ClientUserMembership,
  ClientUserRole,
  ServedClientOverview,
} from '@gestao-epi/shared';
import {
  CLIENT_MANAGER_LIMIT,
  STOCK_OPERATOR_LIMIT,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ClientAccessCredentials } from './ClientAccessCredentials';
import {
  clientUserAccessLabel,
  clientUserRoleLabel,
  createClientUser,
  createInitialManager,
  getServedClientOverview,
  listClientUsers,
  resetClientUserAccess,
  updateClientUserStatus,
} from '../lib/served-clients';

type Props = {
  clientId: string;
  onOverviewLoaded?: (overview: ServedClientOverview) => void;
};

export function ClientOperationalHub({ clientId, onOverviewLoaded }: Props) {
  const [overview, setOverview] = useState<ServedClientOverview | null>(null);
  const [users, setUsers] = useState<ClientUserMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<ClientUserRole, 'WORKER'>>(
    'CLIENT_MANAGER',
  );
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [showManagerForm, setShowManagerForm] = useState(false);
  const [oneTimeAccess, setOneTimeAccess] =
    useState<ClientInitialAccess | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, userList] = await Promise.all([
        getServedClientOverview(clientId),
        listClientUsers(clientId),
      ]);
      setOverview(ov);
      setUsers(userList);
      onOverviewLoaded?.(ov);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar o painel do cliente.',
      );
    } finally {
      setLoading(false);
    }
  }, [clientId, onOverviewLoaded]);

  useEffect(() => {
    void load();
  }, [load]);

  const managers = useMemo(
    () => users.filter((u) => u.role === 'CLIENT_MANAGER'),
    [users],
  );
  const managersActive = overview?.counts.users.managers.active ?? 0;
  const stockActive = overview?.counts.users.stockOperators.active ?? 0;
  const canAddManager = managersActive < CLIENT_MANAGER_LIMIT;
  const canAddStock = stockActive < STOCK_OPERATOR_LIMIT;
  const canOperate = overview?.operational === true;
  const hasManager = managers.length > 0;

  const roleBlocked = useMemo(() => {
    if (role === 'CLIENT_MANAGER') return !canAddManager;
    return !canAddStock;
  }, [role, canAddManager, canAddStock]);

  async function onCreateUser(event: FormEvent) {
    event.preventDefault();
    if (!canOperate || roleBlocked) return;
    setUserError(null);
    setSaving(true);
    try {
      await createClientUser(clientId, {
        name: name.trim(),
        email: email.trim(),
        role,
      });
      setName('');
      setEmail('');
      await load();
    } catch (err) {
      setUserError(
        err instanceof Error ? err.message : 'Falha ao cadastrar usuario.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onCreateInitialManager(event: FormEvent) {
    event.preventDefault();
    if (!canOperate || !canAddManager) return;
    setUserError(null);
    setSaving(true);
    try {
      const access = await createInitialManager(clientId, {
        name: managerName.trim(),
        email: managerEmail.trim(),
        phone: managerPhone.trim() || undefined,
      });
      setOneTimeAccess(access);
      setShowManagerForm(false);
      setManagerName('');
      setManagerEmail('');
      setManagerPhone('');
      await load();
    } catch (err) {
      setUserError(
        err instanceof Error
          ? err.message
          : 'Falha ao gerar gestor inicial.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onResetAccess(user: ClientUserMembership) {
    if (!canOperate || !user.isActive) return;
    const confirmed = window.confirm(
      'Gerar nova senha temporaria? A senha anterior deixara de valer e a nova sera exibida apenas agora.',
    );
    if (!confirmed) return;

    setUserError(null);
    setSaving(true);
    try {
      const access = await resetClientUserAccess(clientId, user.id);
      setOneTimeAccess(access);
      await load();
    } catch (err) {
      setUserError(
        err instanceof Error
          ? err.message
          : 'Falha ao redefinir acesso.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onToggleUser(user: ClientUserMembership) {
    setUserError(null);
    setSaving(true);
    try {
      await updateClientUserStatus(clientId, user.id, !user.isActive);
      await load();
    } catch (err) {
      setUserError(
        err instanceof Error ? err.message : 'Falha ao atualizar status.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading && !overview) {
    return <p className="page-lead">Carregando painel operacional...</p>;
  }

  if (error || !overview) {
    return (
      <p className="error" role="alert">
        {error ?? 'Painel indisponivel.'}
      </p>
    );
  }

  const { client, counts, lives, lastPgroImport } = overview;
  const displayName = client.tradeName || client.legalName;

  return (
    <div className="client-hub">
      <div className="notice notice--info" role="status">
        <p>
          Voce esta operando o cliente <strong>{displayName}</strong>. Este e
          o painel operacional da empresa (CNPJ), separado da visao global da
          Consultoria.
        </p>
      </div>

      {!canOperate ? (
        <div className="notice notice--warn" role="status">
          <p>
            Cliente <strong>inativo</strong>: acoes operacionais e gestao de
            usuarios estao bloqueadas. Reative o cliente para continuar.
          </p>
        </div>
      ) : null}

      <section className="quota-summary" aria-label="Resumo operacional">
        <div className="quota-summary-item">
          <span className="quota-summary-label">Vidas (trabalhadores)</span>
          <strong className="quota-summary-value">
            {lives.used}/{lives.allocated}
          </strong>
          <span className="table-sub">{lives.available} disponiveis</span>
        </div>
        <div className="quota-summary-item">
          <span className="quota-summary-label">Setores</span>
          <strong className="quota-summary-value">
            {counts.sectors.active}
          </strong>
        </div>
        <div className="quota-summary-item">
          <span className="quota-summary-label">Funcoes</span>
          <strong className="quota-summary-value">
            {counts.jobFunctions.active}
          </strong>
        </div>
        <div className="quota-summary-item">
          <span className="quota-summary-label">Riscos / EPIs exigidos</span>
          <strong className="quota-summary-value">
            {counts.riskLinks} / {counts.epiRequirements}
          </strong>
        </div>
        <div className="quota-summary-item">
          <span className="quota-summary-label">EPIs reais (tenant)</span>
          <strong className="quota-summary-value">
            {counts.epiItems.active}
          </strong>
        </div>
        <div className="quota-summary-item">
          <span className="quota-summary-label">Estoque (tenant)</span>
          <strong className="quota-summary-value">
            {counts.stock.totalQuantity}
          </strong>
          <span className="table-sub">
            {counts.stock.low} baixo · {counts.stock.zero} zerado
          </span>
        </div>
      </section>

      <p className="table-sub">{lives.note}</p>

      <section className="surface" aria-labelledby="client-actions-title">
        <h2 id="client-actions-title" className="page-title page-title--sm">
          Acoes principais
        </h2>
        <div className="header-actions header-actions--wrap">
          <Link
            className={`btn btn-primary ${!canOperate ? 'is-disabled' : ''}`}
            href={`/clientes/${clientId}/estrutura`}
            aria-disabled={!canOperate}
            onClick={(e) => {
              if (!canOperate) e.preventDefault();
            }}
          >
            Configurar estrutura
          </Link>
          <Link
            className={`btn btn-secondary ${!canOperate ? 'is-disabled' : ''}`}
            href={`/clientes/importar-pgro?clientId=${clientId}`}
            aria-disabled={!canOperate}
            onClick={(e) => {
              if (!canOperate) e.preventDefault();
            }}
          >
            Importar PGRO
          </Link>
          <Link
            className="btn btn-secondary"
            href={`/epis?clientId=${clientId}`}
          >
            EPIs do cliente
          </Link>
          <Link
            className="btn btn-secondary"
            href={`/epi-needs?clientId=${clientId}`}
          >
            Necessidades de EPI
          </Link>
          <Link
            className="btn btn-secondary"
            href={`/estoque?clientId=${clientId}`}
          >
            Estoque
          </Link>
          <a className="btn btn-secondary" href="#usuarios-cliente">
            Usuarios do cliente
          </a>
          <button type="button" className="btn btn-secondary" disabled>
            Trabalhadores (em breve)
          </button>
        </div>
        {lastPgroImport ? (
          <p className="table-sub" style={{ marginTop: '0.75rem' }}>
            Ultimo PGRO: {lastPgroImport.fileName} · {lastPgroImport.status} ·{' '}
            {new Date(lastPgroImport.createdAt).toLocaleString('pt-BR')}
          </p>
        ) : (
          <p className="table-sub" style={{ marginTop: '0.75rem' }}>
            Nenhuma importacao PGRO vinculada a este cliente ainda.
          </p>
        )}
        <p className="table-sub">{counts.epiItems.note}</p>
        <p className="table-sub">{counts.stock.note}</p>
      </section>

      <section
        id="usuarios-cliente"
        className="surface"
        aria-labelledby="client-users-title"
      >
        <div className="form-section-header">
          <div>
            <p className="page-kicker">Acesso da empresa</p>
            <h2 id="client-users-title" className="page-title page-title--sm">
              Usuarios do cliente
            </h2>
            <p className="page-lead">
              Gestores e operadores nao consomem vidas. Vidas serao usadas para
              trabalhadores ativos. Acesso inicial preparado para login/portal
              futuro.
            </p>
          </div>
          <div className="quota-summary" aria-label="Limites de usuarios">
            <div className="quota-summary-item">
              <span className="quota-summary-label">Gestores</span>
              <strong className="quota-summary-value">
                {managersActive}/{CLIENT_MANAGER_LIMIT}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Estoque</span>
              <strong className="quota-summary-value">
                {stockActive}/{STOCK_OPERATOR_LIMIT}
              </strong>
            </div>
          </div>
        </div>

        {oneTimeAccess ? (
          <div style={{ marginBottom: '1.25rem' }}>
            <ClientAccessCredentials access={oneTimeAccess} />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOneTimeAccess(null)}
            >
              Ocultar dados de acesso
            </button>
          </div>
        ) : null}

        {!hasManager && canOperate ? (
          <div className="notice notice--info" style={{ marginBottom: '1rem' }}>
            <p>
              Nenhum gestor cadastrado. Gere o gestor inicial para entregar
              link, usuario e senha temporaria ao cliente.
            </p>
            {!showManagerForm ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canAddManager || saving}
                onClick={() => setShowManagerForm(true)}
              >
                Gerar gestor inicial
              </button>
            ) : (
              <form className="form-grid" onSubmit={onCreateInitialManager}>
                <label>
                  Nome do gestor
                  <input
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    required
                    minLength={2}
                  />
                </label>
                <label>
                  E-mail
                  <input
                    type="email"
                    value={managerEmail}
                    onChange={(e) => setManagerEmail(e.target.value)}
                    required
                  />
                </label>
                <label>
                  WhatsApp / telefone (opcional)
                  <input
                    value={managerPhone}
                    onChange={(e) => setManagerPhone(e.target.value)}
                  />
                </label>
                <div className="btn-row">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || !canAddManager}
                  >
                    {saving ? 'Gerando...' : 'Gerar acesso'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowManagerForm(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : null}

        {!canOperate && !hasManager ? (
          <p className="table-sub">
            Reative o cliente para gerar o gestor inicial.
          </p>
        ) : null}

        {canOperate ? (
          <form className="form-grid" onSubmit={onCreateUser}>
            <label>
              Nome
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </label>
            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Papel
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as Exclude<ClientUserRole, 'WORKER'>)
                }
              >
                <option value="CLIENT_MANAGER">Gestor do cliente</option>
                <option value="STOCK_OPERATOR">Operador de estoque</option>
              </select>
            </label>
            <div className="btn-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || roleBlocked}
              >
                {roleBlocked
                  ? 'Limite atingido'
                  : 'Cadastrar usuario preparado'}
              </button>
            </div>
          </form>
        ) : hasManager ? (
          <p className="table-sub">
            Reative o cliente para cadastrar gestores ou operadores.
          </p>
        ) : null}

        {userError ? (
          <p className="error" role="alert">
            {userError}
          </p>
        ) : null}

        {users.length === 0 ? (
          <p className="page-lead">Nenhum usuario operacional cadastrado.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Papel</th>
                  <th>Status</th>
                  <th>Acesso</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td className="mono">{user.email}</td>
                    <td>{clientUserRoleLabel(user.role)}</td>
                    <td>
                      <span
                        className={`status-pill status-pill--${user.isActive ? 'active' : 'inactive'}`}
                      >
                        {user.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <span className="mono">
                        {clientUserAccessLabel(user.accessStatus)}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        {user.role !== 'WORKER' && user.isActive ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={saving || !canOperate}
                            onClick={() => void onResetAccess(user)}
                          >
                            Redefinir acesso
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={saving || (!canOperate && !user.isActive)}
                          onClick={() => void onToggleUser(user)}
                        >
                          {user.isActive ? 'Inativar' : 'Reativar'}
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
