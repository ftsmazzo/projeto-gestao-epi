'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/AppShell';
import { loginAccount } from '../../lib/auth';

export default function LoginPage() {
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
      await loginAccount({ email, password });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      headerActions={
        <Link className="btn btn-secondary" href="/register">
          Criar organizacao
        </Link>
      }
    >
      <div className="auth-layout">
        <section className="auth-panel" aria-labelledby="login-title">
          <p className="page-kicker">Acesso</p>
          <h1 id="login-title" className="page-title">
            Entrar no Web Admin
          </h1>
          <p className="page-lead">
            Use o email e a senha do usuario dono da organizacao.
          </p>

          <form className="form" onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Senha</label>
              <input
                id="login-password"
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
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="form-footer">
            Ainda nao tem conta?{' '}
            <Link href="/register">Registrar organizacao</Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
