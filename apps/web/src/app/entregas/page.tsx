'use client';

import { ModulePlaceholder } from '../../components/ModulePlaceholder';
import { RequireAuth } from '../../components/RequireAuth';

export default function EntregasPage() {
  return (
    <RequireAuth>
      {() => (
        <ModulePlaceholder
          kicker="Operacao"
          title="Entregas"
          description="Fluxo operacional de fornecimento de EPI com evidencia e ficha eletronica."
          emptyTitle="Nenhuma entrega registrada"
          emptyDescription="A entrega digital sera liberada apos cadastros mestres e estoque basico."
          primaryActionLabel="Nova entrega (em breve)"
          upcoming={[
            'Selecao de trabalhador e EPI',
            'Evidencia de recebimento',
            'Atualizacao da ficha',
          ]}
        />
      )}
    </RequireAuth>
  );
}
