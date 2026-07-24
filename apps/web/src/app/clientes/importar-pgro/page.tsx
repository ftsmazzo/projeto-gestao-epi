'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { RequireAuth } from '../../../components/RequireAuth';
import { PgroImportWizard } from '../../../components/PgroImportWizard';

function ImportarPgroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  useEffect(() => {
    if (clientId) {
      router.replace(`/clientes/${clientId}/atualizar-pgro`);
    }
  }, [clientId, router]);

  if (clientId) {
    return <p className="page-lead">Abrindo Atualizar PGRO no workspace...</p>;
  }

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">PGRO</p>
          <h1 className="page-title">Importar PGRO</h1>
          <p className="page-lead">
            Para atualizar a estrutura de um cliente existente, abra o workspace
            do CNPJ e use <strong>Atualizar PGRO</strong>. O assistente abaixo
            cria/implanta a partir do PDF quando ainda nao ha cliente
            selecionado.
          </p>
        </div>
        <Link className="btn btn-secondary" href="/clientes">
          Voltar para clientes
        </Link>
      </header>
      <PgroImportWizard />
    </div>
  );
}

export default function PgroImportPage() {
  return (
    <RequireAuth>
      {() => (
        <Suspense fallback={<p className="page-lead">Carregando...</p>}>
          <ImportarPgroContent />
        </Suspense>
      )}
    </RequireAuth>
  );
}
