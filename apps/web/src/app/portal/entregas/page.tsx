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
          emptyTitle="Fluxo de entrega ainda nao liberado"
          emptyDescription="Este modulo pertence ao Painel do Cliente. A Consultoria nao opera entregas daqui — quando o dominio de entrega existir, as fichas e pendencias aparecerao nesta tela."
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
