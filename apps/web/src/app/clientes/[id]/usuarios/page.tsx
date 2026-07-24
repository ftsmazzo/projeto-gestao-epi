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
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ClientAccessCredentials } from '../../../../components/ClientAccessCredentials';
import { consumeClientAccessOnce } from '../../../../lib/client-access-session';
import {
  clientUserAccessLabel,
  clientUserRoleLabel,
  createClientUser,
  createInitialManager,
  getServedClientOverview,
  listClientUsers,
  resetClientUserAccess,
  updateClientUserStatus,
} from '../../../../lib/served-clients';

export default function ClienteUsuariosPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  const [overview, setOverview] = useState<ServedClientOverview | null>(null);
  const [users, setUsers] = useState<ClientUserMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Exclude<ClientUserRole, 'WORKER'>>(
    'CLIENT_MANAGER',
  );
  const [oneTimeAccess, setOneTimeAccess] =
    useState<ClientInitialAccess | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const [ov, userList] = await Promise.all([
        getServedClientOverview(clientId),
        listClientUsers(clientId),
      ]);
      setOverview(ov);
      setUsers(userList);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar usuarios.',
      );
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!clientId) return;
    const pending = consumeClientAccessOnce(clientId);
    if (pending) setOneTimeAccess(pending);
  }, [clientId]);

  const managersActive = overview?.counts.users.managers.active ?? 0;
  const stockActive = overview?.counts.users.stockOperators.active ?? 0;
  const canAddManager = managersActive < CLIENT_MANAGER_LIMIT;
  const canAddStock = stockActive < STOCK_OPERATOR_LIMIT;
  const canOperate = overview?.operational === true;

  useEffect(() => {
    if (!canAddManager && canAddStock && role === 'CLIENT_MANAGER') {
      setRole('STOCK_OPERATOR');
    }
  }, [canAddManager, canAddStock, role]);

  const roleBlocked = useMemo(() => {
    if (role === 'CLIENT_MANAGER') return !canAddManager;
    return !canAddStock;
  }, [role, canAddManager, canAddStock]);

  async function onCreateUser(event: FormEvent) {
    event.preventDefault();
    if (!clientId || !canOperate || roleBlocked) return;
    setUserError(null);
    setSaving(true);
    try {
      if (role === 'CLIENT_MANAGER') {
        const access = await createInitialManager(clientId, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
        });
        setOneTimeAccess(access);
      } else {
        await createClientUser(clientId, {
          name: name.trim(),
          email: email.trim(),
          role,
          phone: phone.trim() || undefined,
        });
      }
      setName('');
      setEmail('');
      setPhone('');
      await load();
    } catch (err) {
      setUserError(
        err instanceof Error ? err.message : 'Falha ao cadastrar usuario.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onResetAccess(user: ClientUserMembership) {
    if (!clientId || !canOperate || !user.isActive) return;
    const confirmed = window.confirm(
      'Gerar nova senha temporaria? Ela sera exibida apenas agora. O gestor entra em /portal/login.',
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
        err instanceof Error ? err.message : 'Falha ao redefinir acesso.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onToggleUser(user: ClientUserMembership) {
    if (!clientId) return;
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
    return <p className="page-lead">Carregando usuarios...</p>;
  }

  if (error || !overview) {
    return (
      <p className="error" role="alert">
        {error ?? 'Usuarios indisponiveis.'}
      </p>
    );
  }

  return (
    <div className="workspace-section">
      <section className="surface" aria-labelledby="users-title">
        <div className="form-section-header">
          <div>
            <p className="page-kicker">Acesso</p>
            <h2 id="users-title" className="page-title page-title--sm">
              Usuarios do cliente
            </h2>
            <p className="page-lead">
              Gestores acessam o <strong>portal do cliente</strong> em{' '}
              <span className="mono">/portal/login</span>. Nao usam o login da
              Consultoria. Limites: {CLIENT_MANAGER_LIMIT} gestores e{' '}
              {STOCK_OPERATOR_LIMIT} operadores.
            </p>
          </div>
          <div className="quota-summary" aria-label="Limites">
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
          <div className="form-panel" style={{ marginBottom: '1.25rem' }}>
            <ClientAccessCredentials
              access={oneTimeAccess}
              onDismiss={() => setOneTimeAccess(null)}
            />
          </div>
        ) : null}

        {canOperate ? (
          <form className="form-panel" onSubmit={onCreateUser}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="user-name">Nome</label>
                <input
                  id="user-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              <div className="field">
                <label htmlFor="user-email">E-mail</label>
                <input
                  id="user-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="user-phone">WhatsApp / telefone</label>
                <input
                  id="user-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="user-role">Papel</label>
                <select
                  id="user-role"
                  value={role}
                  onChange={(e) =>
                    setRole(
                      e.target.value as Exclude<ClientUserRole, 'WORKER'>,
                    )
                  }
                >
                  <option value="CLIENT_MANAGER" disabled={!canAddManager}>
                    Gestor do cliente
                  </option>
                  <option value="STOCK_OPERATOR" disabled={!canAddStock}>
                    Operador de estoque
                  </option>
                </select>
              </div>
            </div>
            {role === 'CLIENT_MANAGER' ? (
              <p className="field-hint">
                Gestor recebe senha temporaria exibida uma unica vez. Portal:{' '}
                /portal/login
              </p>
            ) : (
              <p className="field-hint">
                Operador fica preparado; acesso completo ao portal em etapa
                futura.
              </p>
            )}
            {userError ? (
              <p className="error" role="alert">
                {userError}
              </p>
            ) : null}
            <div className="btn-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || roleBlocked}
              >
                {saving
                  ? 'Salvando...'
                  : roleBlocked
                    ? 'Limite atingido'
                    : role === 'CLIENT_MANAGER'
                      ? 'Cadastrar gestor'
                      : 'Cadastrar operador'}
              </button>
            </div>
          </form>
        ) : (
          <p className="table-sub">Reative o cliente para cadastrar usuarios.</p>
        )}

        {users.length === 0 ? (
          <p className="page-lead" style={{ marginTop: '1rem' }}>
            Nenhum usuario cadastrado.
          </p>
        ) : (
          <div className="table-wrap" style={{ marginTop: '1.25rem' }}>
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
                    <td className="mono">
                      {clientUserAccessLabel(user.accessStatus)}
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
