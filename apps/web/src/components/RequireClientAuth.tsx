'use client';

import type { ClientPortalUser } from '@gestao-epi/shared';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import {
  clearClientAccessToken,
  fetchClientMe,
  getClientAccessToken,
} from '../lib/client-auth';
import { PortalShell } from './PortalShell';

type Props = {
  children: (user: ClientPortalUser) => ReactNode;
  requirePasswordOk?: boolean;
};

export function RequireClientAuth({
  children,
  requirePasswordOk = false,
}: Props) {
  const router = useRouter();
  const [user, setUser] = useState<ClientPortalUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getClientAccessToken();
    if (!token) {
      router.replace('/portal/login');
      return;
    }

    void fetchClientMe()
      .then((me) => {
        if (requirePasswordOk && me.mustChangePassword) {
          router.replace('/portal/conta?obrigatorio=1');
          return;
        }
        setUser(me);
        setLoading(false);
      })
      .catch((err: unknown) => {
        clearClientAccessToken();
        setError(err instanceof Error ? err.message : 'Sessao invalida');
        setLoading(false);
        router.replace('/portal/login');
      });
  }, [router, requirePasswordOk]);

  function logout() {
    clearClientAccessToken();
    router.push('/portal/login');
  }

  if (loading || !user) {
    return (
      <PortalShell>
        <section className="portal-card" aria-live="polite">
          <p className="page-kicker">Portal</p>
          <h1 className="page-title page-title--sm">Carregando...</h1>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : (
            <p className="page-lead">Validando seu acesso ao cliente.</p>
          )}
        </section>
      </PortalShell>
    );
  }

  return (
    <PortalShell user={user} onLogout={logout}>
      {children(user)}
    </PortalShell>
  );
}
