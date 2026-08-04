'use client';

import { APP_NAME, APP_TAGLINE } from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '../../components/AppShell';
import { BrandLockup } from '../../components/BrandLockup';

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const isPortal = searchParams.get('origem') === 'portal';
  const initialEmail = searchParams.get('email') ?? '';

  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);

  const backHref = isPortal ? '/portal/login' : '/login';
  const backLabel = isPortal ? 'Voltar ao portal' : 'Voltar ao login';

  const guidance = useMemo(
    () =>
      isPortal
        ? {
            title: 'Recuperar acesso do portal',
            lead: `Usuarios do painel do cliente sao gerenciados pela consultoria. Informe o e-mail da conta — o administrador do ${APP_NAME} redefine a senha e libera o acesso.`,
            nextSteps: [
              'Fale com o responsavel da consultoria na sua empresa',
              'Peca o reset da senha do usuario do portal',
              'Entre de novo com a senha provisoria e altere no primeiro acesso',
            ],
          }
        : {
            title: 'Recuperar acesso da consultoria',
            lead: `No piloto, o reset de senha da consultoria e feito pelo administrador da organizacao no ${APP_NAME}. Informe o e-mail para orientar o atendimento.`,
            nextSteps: [
              'Confirme o e-mail cadastrado na organizacao',
              'Solicite o reset ao administrador (OWNER/ADMIN)',
              'Entre novamente e troque a senha se for exigido',
            ],
          },
    [isPortal],
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSent(true);
  }

  return (
    <div className="auth-split">
      <aside className="auth-split__brand">
        <BrandLockup subtitle="Recuperacao de acesso" />
        <h2>{APP_TAGLINE}</h2>
        <p>
          Acesso seguro em poucos passos. Sem e-mail automatico no piloto — o
          reset passa pelo administrador da organizacao.
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

          {sent ? (
            <div className="notice notice--ok" role="status">
              <p>
                Registramos o pedido para <strong>{email}</strong>. Fale com o
                administrador da organizacao para concluir o reset.
              </p>
              <ol className="notice-steps">
                {guidance.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p style={{ marginTop: '1rem' }}>
                <Link className="btn btn-primary" href={backHref}>
                  {backLabel}
                </Link>
              </p>
            </div>
          ) : (
            <form className="form" onSubmit={onSubmit} noValidate>
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
              <button className="btn btn-primary btn-block" type="submit">
                Continuar recuperacao
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
