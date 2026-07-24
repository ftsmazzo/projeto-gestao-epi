'use client';

import type { ClientPortalUser } from '@gestao-epi/shared';
import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import { changeClientPassword } from '../../../lib/client-auth';
import { clientUserRoleLabel } from '../../../lib/served-clients';

function PortalContaForm({ user }: { user: ClientPortalUser }) {
  const router = useRouter();
  const search = useSearchParams();
  const obrigatorio = search.get('obrigatorio') === '1';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword !== confirmPassword) {
      setError('A confirmacao nao confere com a nova senha.');
      return;
    }
    setSaving(true);
    try {
      await changeClientPassword({ currentPassword, newPassword });
      setSuccess('Senha atualizada.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (obrigatorio) {
        router.replace('/portal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao trocar senha.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="portal-home">
      <section className="portal-card">
        <p className="page-kicker">Conta</p>
        <h1 className="page-title page-title--sm">Minha conta</h1>
        <dl className="meta-list">
          <div>
            <dt>Nome</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd className="mono">{user.email}</dd>
          </div>
          <div>
            <dt>Papel</dt>
            <dd>{clientUserRoleLabel(user.role)}</dd>
          </div>
        </dl>
      </section>

      <section className="portal-card" aria-labelledby="password-title">
        <h2 id="password-title" className="page-title page-title--sm">
          Trocar senha
        </h2>
        {obrigatorio || user.mustChangePassword ? (
          <div className="notice notice--warn" role="status">
            <p>
              Por seguranca, troque a senha temporaria antes de continuar.
            </p>
          </div>
        ) : null}
        <form className="form-panel" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="current-password">Senha atual</label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="new-password">Nova senha</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-password">Confirmar nova senha</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="notice notice--info" role="status">
              {success}
            </p>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Atualizar senha'}
          </button>
        </form>
      </section>
    </div>
  );
}

export default function PortalContaPage() {
  return (
    <RequireClientAuth>
      {(user) => (
        <Suspense
          fallback={<p className="page-lead">Carregando conta...</p>}
        >
          <PortalContaForm user={user} />
        </Suspense>
      )}
    </RequireClientAuth>
  );
}
