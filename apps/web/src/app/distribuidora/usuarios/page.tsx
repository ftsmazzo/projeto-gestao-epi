'use client';

import { useEffect, useState } from 'react';
import { EquipeSection } from '../../../components/settings/EquipeSection';
import { fetchMe } from '../../../lib/auth';
import type { AuthUser } from '@gestao-epi/shared';

export default function DistribuidoraUsuariosPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchMe()
      .then(setUser)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
  }, []);

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Administração</p>
          <h1 className="page-title">Usuários</h1>
          <p className="page-lead">
            Crie, altere o papel ou remova quem acessa esta distribuidora.
            Administradores gerenciam a operação; membros usam o dia a dia.
          </p>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {!user ? (
        <p className="field-hint" role="status">
          Carregando usuários...
        </p>
      ) : (
        <EquipeSection
          currentUserId={user.id}
          currentRole={user.membershipRole}
          orgLabel="distribuidora"
        />
      )}
    </div>
  );
}
