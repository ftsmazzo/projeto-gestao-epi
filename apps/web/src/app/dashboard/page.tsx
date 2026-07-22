'use client';

import type { AuthUser } from '@gestao-epi/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
      <main>
        <section className="panel">
          <p className="eyebrow">Dashboard</p>
          <h1>Carregando...</h1>
          {error ? <p className="error">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="panel">
        <p className="eyebrow">Area autenticada</p>
        <h1>Ola, {user.name}</h1>
        <p>
          Voce esta autenticado na organizacao tenant{' '}
          <strong>{user.organization.name}</strong>.
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
          <div>
            <dt>Franquia de vidas contratadas</dt>
            <dd>{user.organization.contractedLifeQuota}</dd>
          </div>
        </dl>

        <div className="actions">
          <button type="button" onClick={logout}>
            Sair
          </button>
          <Link href="/">Voltar ao inicio</Link>
        </div>
      </section>
    </main>
  );
}
