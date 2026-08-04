'use client';

import { APP_NAME, APP_TAGLINE } from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandLockup } from '../../../components/BrandLockup';
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
      <div className="auth-split auth-split--portal portal-auth">
        <aside className="auth-split__brand">
          <BrandLockup subtitle="Painel operacional do cliente" />
          <h2>{APP_TAGLINE}</h2>
          <p>
            Estoque, validade e comprovante no celular ou no desktop — o dia a
            dia da empresa sem planilha e sem papel perdido.
          </p>
          <ol className="auth-split__steps">
            <li>
              <span>1</span>
              Conferir estoque e validades
            </li>
            <li>
              <span>2</span>
              Selecionar trabalhador e EPIs
            </li>
            <li>
              <span>3</span>
              Validar face e emitir ficha
            </li>
          </ol>
        </aside>

        <div className="auth-split__panel">
          <section
            className="portal-card portal-card--auth"
            aria-labelledby="portal-login-title"
          >
            <p className="page-kicker">{APP_NAME} · Painel do cliente</p>
            <h1 id="portal-login-title" className="page-title">
              Acesse o painel
            </h1>
            <p className="page-lead">
              Acesso da empresa cliente. A Consultoria usa o{' '}
              <Link href="/login">login da gestao</Link>.
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
            <p className="field-hint" style={{ marginTop: '1rem' }}>
              E da Consultoria? <Link href="/login">Entrar no {APP_NAME}</Link>
            </p>
          </section>
        </div>
      </div>
    </PortalShell>
  );
}
