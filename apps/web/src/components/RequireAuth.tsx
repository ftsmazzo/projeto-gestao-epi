'use client';

import type { AuthUser } from '@gestao-epi/shared';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { clearAccessToken, fetchMe, getAccessToken } from '../lib/auth';
import { OpsShell } from './OpsShell';

type RequireAuthProps = {
  children: (user: AuthUser) => ReactNode;
};

export function RequireAuth({ children }: RequireAuthProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    void fetchMe()
      .then((me) => {
        setUser(me);
        setLoading(false);
      })
      .catch((err: unknown) => {
        clearAccessToken();
        setError(err instanceof Error ? err.message : 'Sessao invalida');
        setLoading(false);
        router.replace('/login');
      });
  }, [router]);

  function logout() {
    clearAccessToken();
    router.push('/login');
  }

  if (loading || !user) {
    return (
      <OpsShell>
        <section className="surface" aria-live="polite">
          <p className="page-kicker">Sessao</p>
          <h1 className="page-title">Carregando...</h1>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : (
            <p className="page-lead">Validando autenticacao e organizacao.</p>
          )}
        </section>
      </OpsShell>
    );
  }

  return (
    <OpsShell user={user} onLogout={logout}>
      {children(user)}
    </OpsShell>
  );
}
