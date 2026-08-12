'use client';

import { APP_NAME } from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '../../../components/AuthLayout';
import { InstallAppBanner } from '../../../components/InstallAppBanner';
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
    <AuthLayout
      brandHref="/portal/login"
      brandTone="portal"
      kicker={`${APP_NAME} · Painel do cliente`}
      footer={
        <>
          E da Consultoria? <Link href="/login">Entrar na gestao</Link>
        </>
      }
    >
      <InstallAppBanner />
      <p className="page-kicker">Operacao da empresa</p>
      <h1 id="portal-login-title" className="page-title">
        Entrar
      </h1>
      <p className="page-lead">
        Estoque, validade e comprovante. A Consultoria usa o login da gestao.
      </p>
      <form className="form" onSubmit={onSubmit} noValidate>
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
          <div className="field-label-row">
            <label htmlFor="portal-password">Senha</label>
            <Link
              className="field-link"
              href={`/esqueci-senha?origem=portal&email=${encodeURIComponent(email)}`}
            >
              Esqueci a senha
            </Link>
          </div>
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
          {loading ? 'Entrando...' : 'Entrar no painel'}
        </button>
      </form>
    </AuthLayout>
  );
}
