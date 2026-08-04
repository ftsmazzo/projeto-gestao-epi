'use client';

import { APP_NAME, APP_TAGLINE } from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '../../components/AppShell';
import { BrandLockup } from '../../components/BrandLockup';
import {
  requestPasswordReset,
  type ForgotPasswordResponse,
} from '../../lib/auth';

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const isPortal = searchParams.get('origem') === 'portal';
  const initialEmail = searchParams.get('email') ?? '';

  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ForgotPasswordResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const backHref = isPortal ? '/portal/login' : '/login';
  const backLabel = isPortal ? 'Voltar ao portal' : 'Voltar ao login';
  const audience = isPortal ? ('portal' as const) : ('consultoria' as const);

  const guidance = useMemo(
    () =>
      isPortal
        ? {
            title: 'Recuperar acesso do portal',
            lead: `Informe o e-mail do gestor ou operador. Se a conta existir, geramos uma senha temporaria para o ${APP_NAME}.`,
          }
        : {
            title: 'Recuperar acesso da consultoria',
            lead: `Informe o e-mail cadastrado na organizacao. Se a conta existir, geramos uma senha temporaria para o ${APP_NAME}.`,
          },
    [isPortal],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCopied(false);
    setLoading(true);
    try {
      const response = await requestPasswordReset({
        email: email.trim(),
        audience,
      });
      setResult(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel solicitar o reset.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyTemporaryPassword() {
    if (!result?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(result.temporaryPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="auth-split">
      <aside className="auth-split__brand">
        <BrandLockup subtitle="Recuperacao de acesso" />
        <h2>{APP_TAGLINE}</h2>
        <p>
          Reset seguro com senha temporaria. No piloto, se o envio por
          e-mail/WhatsApp estiver desligado, a senha aparece nesta tela.
        </p>
      </aside>

      <div className="auth-split__panel">
        <section className="auth-panel" aria-labelledby="forgot-title">
          <p className="page-kicker">
            {APP_NAME} · {isPortal ? 'Portal' : 'Consultoria'}
          </p>
          <h1 id="forgot-title" className="page-title">
            {guidance.title}
          </h1>
          <p className="page-lead">{guidance.lead}</p>

          {result ? (
            <div className="notice notice--ok" role="status">
              <p>
                Se o e-mail <strong>{email}</strong> existir, a senha temporaria
                ja foi gerada.
              </p>
              {result.deliveryEnabled ? (
                <p style={{ marginTop: '0.75rem' }}>
                  Verifique o e-mail ou WhatsApp cadastrado. No primeiro acesso,
                  troque a senha.
                </p>
              ) : result.temporaryPassword ? (
                <div style={{ marginTop: '0.85rem' }}>
                  <p className="field-hint" style={{ marginBottom: '0.35rem' }}>
                    Senha temporaria (copie e use no login):
                  </p>
                  <div className="btn-row" style={{ alignItems: 'center' }}>
                    <code className="mono" style={{ fontSize: '1.05rem' }}>
                      {result.temporaryPassword}
                    </code>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void copyTemporaryPassword()}
                    >
                      {copied ? 'Copiada' : 'Copiar'}
                    </button>
                  </div>
                  {result.accessUrl ? (
                    <p className="field-hint" style={{ marginTop: '0.65rem' }}>
                      Acesso: {result.accessUrl}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p style={{ marginTop: '0.75rem' }}>
                  Nenhuma senha foi exibida (conta inexistente ou ja tratada).
                  Confira o e-mail e tente de novo se precisar.
                </p>
              )}
              <p style={{ marginTop: '1rem' }}>
                <Link className="btn btn-primary" href={backHref}>
                  {backLabel}
                </Link>
              </p>
            </div>
          ) : (
            <form className="form" onSubmit={(e) => void onSubmit(e)} noValidate>
              <div className="field">
                <label htmlFor="forgot-email">E-mail da conta</label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {loading ? 'Gerando...' : 'Gerar senha temporaria'}
              </button>
              <p className="form-footer">
                Lembrou a senha? <Link href={backHref}>{backLabel}</Link>
              </p>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AppShell
      headerActions={
        <Link className="btn btn-secondary" href="/login">
          Entrar
        </Link>
      }
    >
      <Suspense
        fallback={
          <div className="auth-split__panel">
            <section className="auth-panel">
              <p className="page-lead">Carregando...</p>
            </section>
          </div>
        }
      >
        <ForgotPasswordForm />
      </Suspense>
    </AppShell>
  );
}
