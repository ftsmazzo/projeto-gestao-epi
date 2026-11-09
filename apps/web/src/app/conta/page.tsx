'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RequireAuth } from '../../components/RequireAuth';
import { MarcaSection } from '../../components/settings/MarcaSection';
import { ResetSection } from '../../components/settings/ResetSection';
import { SenhaSection } from '../../components/settings/SenhaSection';

function ContaForm() {
  const search = useSearchParams();
  const obrigatorio = search.get('obrigatorio') === '1';

  return (
    <RequireAuth>
      {(user) => {
        const isDistributor = user.organization.kind === 'DISTRIBUIDORA';
        return (
          <div className="module-page">
            <header className="module-header">
              <div>
                <p className="page-kicker">
                  {isDistributor ? 'Distribuidora' : 'Consultoria'}
                </p>
                <h1 className="page-title">Minha conta</h1>
                <p className="page-lead">
                  {isDistributor
                    ? 'Marca da distribuidora e senha de acesso.'
                    : 'Troque a senha provisoria ou atualize a senha desta gestao.'}
                </p>
              </div>
            </header>
            {isDistributor ? <MarcaSection user={user} /> : null}
            <SenhaSection user={user} obrigatorio={obrigatorio} />
            {isDistributor ? <ResetSection role={user.membershipRole} /> : null}
          </div>
        );
      }}
    </RequireAuth>
  );
}

export default function ContaPage() {
  return (
    <Suspense
      fallback={
        <p className="page-lead" role="status">
          Carregando conta...
        </p>
      }
    >
      <ContaForm />
    </Suspense>
  );
}
