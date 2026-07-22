'use client';

import type { AuthUser } from '@gestao-epi/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { clearAccessToken, fetchMe, getAccessToken } from '../../lib/auth';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    void fetchMe()
      .then(setUser)
      .catch((err: unknown) => {
        clearAccessToken();
        setError(err instanceof Error ? err.message : 'Sessao invalida');
        router.replace('/login');
      });
  }, [router]);

  function logout() {
    clearAccessToken();
    router.push('/login');
  }

  if (!user) {
    return (
      <AppShell brandHref="/dashboard">
        <section className="surface" aria-live="polite">
          <p className="page-kicker">Dashboard</p>
          <h1 className="page-title">Carregando sessao...</h1>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : (
            <p className="page-lead">Validando autenticacao e organizacao.</p>
          )}
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      brandHref="/dashboard"
      headerActions={
        <button type="button" className="btn btn-danger" onClick={logout}>
          Sair
        </button>
      }
    >
      <div className="dashboard-grid">
        <section className="surface" aria-labelledby="dash-title">
          <p className="page-kicker">Area autenticada</p>
          <h1 id="dash-title" className="page-title">
            Ola, {user.name}
          </h1>
          <p className="page-lead">
            Sessao ativa na organizacao tenant{' '}
            <strong>{user.organization.name}</strong>. Cadastros operacionais
            entram nas proximas etapas.
          </p>

          <dl className="meta-list">
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Papel</dt>
              <dd>{user.membershipRole}</dd>
            </div>
            <div>
              <dt>Slug da organizacao</dt>
              <dd>{user.organization.slug}</dd>
            </div>
          </dl>

          <div className="btn-row">
            <Link className="btn btn-secondary" href="/">
              Ir para a home
            </Link>
          </div>
        </section>

        <aside className="surface" aria-label="Franquia de vidas">
          <p className="page-kicker">Contrato</p>
          <h2 className="page-title" style={{ fontSize: '1.25rem' }}>
            Franquia de vidas
          </h2>
          <p className="page-lead">
            Total contratado para a empresa usuaria. Cotas por cliente
            atendido ainda nao estao ativas.
          </p>
          <p className="quota-value" aria-label="Vidas contratadas">
            {user.organization.contractedLifeQuota}
          </p>
          <p className="field-hint">vidas contratadas</p>
        </aside>
      </div>
    </AppShell>
  );
}
