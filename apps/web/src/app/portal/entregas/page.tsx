'use client';

import { PortalSoonModule } from '../../../components/PortalSoonModule';
import { RequireClientAuth } from '../../../components/RequireClientAuth';

export default function PortalEntregasPage() {
  return (
    <RequireClientAuth>
      {() => (
        <PortalSoonModule
          title="Entregas"
          description="Controle de entregas, fichas e pendencias da empresa."
          emptyTitle="Nenhuma entrega registrada"
          emptyDescription="O fluxo de entrega digital sera liberado aqui, no Painel do Cliente — fora da Consultoria."
          upcoming={[
            'Selecao de trabalhador e EPI',
            'Evidencia de recebimento',
            'Atualizacao da ficha eletronica',
          ]}
        />
      )}
    </RequireClientAuth>
  );
}
