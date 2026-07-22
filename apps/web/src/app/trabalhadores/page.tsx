'use client';

import { ModulePlaceholder } from '../../components/ModulePlaceholder';
import { RequireAuth } from '../../components/RequireAuth';

export default function TrabalhadoresPage() {
  return (
    <RequireAuth>
      {() => (
        <ModulePlaceholder
          kicker="Cadastros"
          title="Trabalhadores"
          description="Vidas ativas vinculadas a um cliente atendido. Consomem cota e franquia da organizacao."
          emptyTitle="Nenhum trabalhador cadastrado"
          emptyDescription="O cadastro de trabalhadores depende de clientes atendidos e sera liberado em seguida."
          primaryActionLabel="Novo trabalhador (em breve)"
          upcoming={[
            'Vinculo com cliente atendido',
            'Status ativo/afastado/desligado',
            'Consumo de cota de vidas',
          ]}
        />
      )}
    </RequireAuth>
  );
}
