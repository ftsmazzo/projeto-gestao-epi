'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PortalShell } from '../../../components/PortalShell';
import { clientLoginAccount } from '../../../lib/client-auth';

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await clientLoginAccount({ email, password });
      if (data.user.mustChangePassword) {
        router.push('/portal/conta?obrigatorio=1');
      } else {
        router.push('/portal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PortalShell>
      <div className="portal-auth">
        <section className="portal-card portal-card--auth" aria-labelledby="portal-login-title">
          <p className="page-kicker">Portal do cliente</p>
          <h1 id="portal-login-title" className="page-title">
            Entrar
          </h1>
          <p className="page-lead">
            Acesso para gestores e operadores da empresa cliente. A Consultoria
            usa outro login.
          </p>
          <form className="form-panel" onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="portal-email">E-mail</label>
              <input
                id="portal-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="portal-password">Senha</label>
              <input
                id="portal-password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              className="btn btn-primary btn-block"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar no portal'}
            </button>
          </form>
          <p className="field-hint" style={{ marginTop: '1rem' }}>
            E membro da Consultoria?{' '}
            <Link href="/login">Ir para o login da gestao</Link>
          </p>
        </section>
      </div>
    </PortalShell>
  );
}
