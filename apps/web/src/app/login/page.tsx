'use client';

import { APP_NAME } from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '../../components/AuthLayout';
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
    <AuthLayout
      kicker={`${APP_NAME} · Consultoria`}
      footer={
        <>
          Ainda nao tem conta? <Link href="/register">Criar organizacao</Link>
          <br />
          Empresa cliente? <Link href="/portal/login">Entrar no portal</Link>
        </>
      }
    >
      <p className="page-kicker">Acesso da gestao</p>
      <h1 id="login-title" className="page-title">
        Entrar
      </h1>
      <p className="page-lead">
        Painel da consultoria. Gestores da empresa usam o portal do cliente.
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
          <div className="field-label-row">
            <label htmlFor="login-password">Senha</label>
            <Link
              className="field-link"
              href={`/esqueci-senha?email=${encodeURIComponent(email)}`}
            >
              Esqueci a senha
            </Link>
          </div>
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
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </AuthLayout>
  );
}
