'use client';

import { APP_NAME, APP_PITCH, APP_TAGLINE } from '@gestao-epi/shared';
import Image from 'next/image';
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
        <Link className="btn btn-primary" href="/register">
          Comecar agora
        </Link>
      }
    >
      <div className="auth-split">
        <aside className="auth-split__brand">
          <Image
            src="/brand/prontepi-mark.png"
            alt={APP_NAME}
            width={88}
            height={88}
            className="auth-split__logo"
            priority
          />
          <p className="auth-split__cta">
            <span aria-hidden="true" />
            Pronto para o primeiro cliente real
          </p>
          <h2>{APP_TAGLINE}</h2>
          <p>{APP_PITCH}</p>
          <ol className="auth-split__steps">
            <li>
              <span>1</span>
              Implante o CNPJ com PGRO ou dados
            </li>
            <li>
              <span>2</span>
              Liberar portal, estoque e vidas
            </li>
            <li>
              <span>3</span>
              Entregar EPI com biometria e comprovante
            </li>
          </ol>
        </aside>

        <div className="auth-split__panel">
          <section className="auth-panel" aria-labelledby="login-title">
            <p className="page-kicker">{APP_NAME} · Consultoria</p>
            <h1 id="login-title" className="page-title">
              Entre e opere com conformidade
            </h1>
            <p className="page-lead">
              Acesso da consultoria. Gestores da empresa usam o{' '}
              <Link href="/portal/login">portal do cliente</Link>.
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
              <button
                className="btn btn-primary btn-block"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Entrando...' : 'Entrar no ProntEPI'}
              </button>
            </form>

            <p className="form-footer">
              Ainda nao tem conta?{' '}
              <Link href="/register">Criar organizacao gratis</Link>
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
