'use client';

import { APP_NAME } from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '../../../components/AuthLayout';
import { loginPlatform } from '../../../lib/platform-auth';

export default function PlatformLoginPage() {
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
      await loginPlatform({ email, password });
      router.push('/plataforma');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      kicker={`${APP_NAME} · Plataforma`}
      footer={
        <>
          Consultoria? <Link href="/login">Entrar no painel do gestor</Link>
          <br />
          Empresa cliente? <Link href="/portal/login">Entrar no portal</Link>
        </>
      }
    >
      <p className="page-kicker">Painel SaaS</p>
      <h1 id="platform-login-title" className="page-title">
        Entrar
      </h1>
      <p className="page-lead">
        Gestao das consultorias clientes da {APP_NAME}: franquia, preco de
        atacado e status do contrato.
      </p>

      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="platform-email">Email</label>
          <input
            id="platform-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="platform-password">Senha</label>
          <input
            id="platform-password"
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
