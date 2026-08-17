'use client';

import type { ClientPortalUser } from '@gestao-epi/shared';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import {
  clearClientAccessToken,
  fetchClientMe,
  getClientAccessToken,
  switchPortalCompany,
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

  async function switchCompany(servedClientId: string) {
    if (servedClientId === user?.servedClient.id) return;
    await switchPortalCompany(servedClientId);
    window.location.reload();
  }

  if (loading || !user) {
    return (
      <PortalShell>
        <section className="portal-card" aria-live="polite">
          <p className="page-kicker">Painel do cliente</p>
          <h1 className="page-title page-title--sm">Carregando...</h1>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : (
            <p className="page-lead">Validando seu acesso ao painel.</p>
          )}
        </section>
      </PortalShell>
    );
  }

  return (
    <PortalShell user={user} onLogout={logout} onSwitchCompany={switchCompany}>
      {children(user)}
    </PortalShell>
  );
}
