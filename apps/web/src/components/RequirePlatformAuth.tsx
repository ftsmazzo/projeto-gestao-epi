'use client';

import type { PlatformAuthUser } from '@gestao-epi/shared';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import {
  clearPlatformAccessToken,
  fetchPlatformMe,
  getPlatformAccessToken,
} from '../lib/platform-auth';
import { PlatformShell } from './PlatformShell';

type Props = {
  children: (user: PlatformAuthUser) => ReactNode;
};

export function RequirePlatformAuth({ children }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<PlatformAuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getPlatformAccessToken();
    if (!token) {
      router.replace('/plataforma/login');
      return;
    }

    void fetchPlatformMe()
      .then((me) => {
        setUser(me);
        setLoading(false);
      })
      .catch((err: unknown) => {
        clearPlatformAccessToken();
        setError(err instanceof Error ? err.message : 'Sessao invalida');
        setLoading(false);
        router.replace('/plataforma/login');
      });
  }, [router]);

  function logout() {
    clearPlatformAccessToken();
    router.push('/plataforma/login');
  }

  if (loading || !user) {
    return (
      <PlatformShell>
        <section className="surface" aria-live="polite">
          <p className="page-kicker">Sessao</p>
          <h1 className="page-title">Carregando...</h1>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : (
            <p className="page-lead">Validando acesso da plataforma.</p>
          )}
        </section>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell user={user} onLogout={logout}>
      {children(user)}
    </PlatformShell>
  );
}
