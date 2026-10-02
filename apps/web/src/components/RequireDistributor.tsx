'use client';

import type { AuthUser } from '@gestao-epi/shared';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { clearAccessToken, fetchMe, getAccessToken } from '../lib/auth';
import { DistributorShell } from './DistributorShell';

type RequireDistributorProps = {
  children: ReactNode;
};

export function RequireDistributor({ children }: RequireDistributorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    void fetchMe()
      .then((me) => {
        if (me.mustChangePassword && pathname !== '/conta') {
          router.replace('/conta?obrigatorio=1');
          return;
        }
        if (me.organization.kind !== 'DISTRIBUIDORA') {
          router.replace('/dashboard');
          return;
        }
        setUser(me);
      })
      .catch((err: unknown) => {
        clearAccessToken();
        setError(err instanceof Error ? err.message : 'Sessao invalida');
        router.replace('/login');
      });
  }, [router, pathname]);

  if (!user) {
    return (
      <DistributorShell>
        <section className="surface" aria-live="polite">
          <p className="page-kicker">Sessao</p>
          <h1 className="page-title">Carregando...</h1>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : (
            <p className="page-lead">Validando a conta da distribuidora.</p>
          )}
        </section>
      </DistributorShell>
    );
  }

  return (
    <DistributorShell user={user} onLogout={() => {
      clearAccessToken();
      router.push('/login');
    }}>
      {children}
    </DistributorShell>
  );
}
