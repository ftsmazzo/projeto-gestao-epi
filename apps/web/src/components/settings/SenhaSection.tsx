'use client';

import type { AuthUser } from '@gestao-epi/shared';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { changeConsultoriaPassword } from '../../lib/auth';

const ROLE_LABEL: Record<AuthUser['membershipRole'], string> = {
  OWNER: 'Administrador geral',
  ADMIN: 'Administrador',
  MEMBER: 'Membro',
};

export function SenhaSection({
  user,
  obrigatorio = false,
}: {
  user: AuthUser;
  obrigatorio?: boolean;
}) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const forceChange = obrigatorio || user.mustChangePassword;

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
      await changeConsultoriaPassword({ currentPassword, newPassword });
      setSuccess('Senha atualizada.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (obrigatorio) {
        router.replace('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao trocar senha.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface" aria-labelledby="password-title">
      <h2 id="password-title" className="page-title page-title--sm">
        Trocar senha
      </h2>
      {forceChange ? (
        <div className="notice notice--warn" role="status">
          <p>Por seguranca, troque a senha temporaria antes de continuar.</p>
        </div>
      ) : (
        <p className="page-lead">
          Use uma senha sua. A provisoria do convite so serve para o primeiro
          acesso.
        </p>
      )}
      <dl className="meta-list" style={{ marginBottom: '1rem' }}>
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
          <dd>{ROLE_LABEL[user.membershipRole]}</dd>
        </div>
      </dl>
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
  );
}
