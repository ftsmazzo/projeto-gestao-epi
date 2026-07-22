'use client';

import { ModulePlaceholder } from '../../components/ModulePlaceholder';
import { RequireAuth } from '../../components/RequireAuth';

export default function ClientesPage() {
  return (
    <RequireAuth>
      {() => (
        <ModulePlaceholder
          kicker="Cadastros"
          title="Clientes atendidos"
          description="Clientes da empresa usuaria, normalmente com CNPJ. Distintos do tenant e da unidade operacional."
          emptyTitle="Nenhum cliente cadastrado"
          emptyDescription="O cadastro de clientes e a distribuicao de cotas de vidas serao liberados na proxima etapa."
          primaryActionLabel="Novo cliente (em breve)"
          upcoming={[
            'Cadastro com CNPJ',
            'Cota de vidas alocada',
            'Status ativo/inativo',
          ]}
        />
      )}
    </RequireAuth>
  );
}
