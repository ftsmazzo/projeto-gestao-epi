'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RequireAuth } from '../../components/RequireAuth';
import { SenhaSection } from '../../components/settings/SenhaSection';

function ContaForm() {
  const search = useSearchParams();
  const obrigatorio = search.get('obrigatorio') === '1';

  return (
    <RequireAuth>
      {(user) => (
        <div className="module-page">
          <header className="module-header">
            <div>
              <p className="page-kicker">Consultoria</p>
              <h1 className="page-title">Minha conta</h1>
              <p className="page-lead">
                Troque a senha provisoria ou atualize a senha desta gestao.
              </p>
            </div>
          </header>
          <SenhaSection user={user} obrigatorio={obrigatorio} />
        </div>
      )}
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
