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
  const fromNovo = searchParams.get('origem') === 'novo-cliente';

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
          <p className="page-kicker">
            {fromNovo ? 'Novo cliente · via PGRO' : 'PGRO'}
          </p>
          <h1 className="page-title">
            {fromNovo ? 'Importar PGRO e criar cliente' : 'Importar PGRO'}
          </h1>
          <p className="page-lead">
            {fromNovo
              ? 'O assistente cria o cliente a partir do PDF e monta a estrutura. Se preferir so os dados cadastrais, volte e escolha Inserir dados.'
              : 'Para atualizar um cliente ja existente, abra o workspace e use Atualizar PGRO. Abaixo, o assistente cria/implanta quando ainda nao ha cliente selecionado.'}
          </p>
        </div>
        <Link
          className="btn btn-secondary"
          href={fromNovo ? '/clientes?novo=1' : '/clientes'}
        >
          {fromNovo ? 'Voltar as opcoes' : 'Voltar para clientes'}
        </Link>
      </header>

      {fromNovo ? (
        <p className="notice notice--info" role="status">
          Voce esta no fluxo de <strong>Novo cliente</strong>. O PGRO e uma das
          duas formas de comecar — a outra e inserir os dados manualmente.
        </p>
      ) : null}

      <PgroImportWizard
        hideHeader
        backHref={fromNovo ? '/clientes?novo=1' : '/clientes'}
        backLabel={fromNovo ? 'Voltar as opcoes' : 'Voltar para clientes'}
      />
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
