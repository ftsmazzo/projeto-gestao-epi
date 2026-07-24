'use client';

import { PortalSoonModule } from '../../../components/PortalSoonModule';
import { RequireClientAuth } from '../../../components/RequireClientAuth';

export default function PortalCustosPage() {
  return (
    <RequireClientAuth>
      {() => (
        <PortalSoonModule
          title="Custos"
          description="Consumo e custo de EPI por periodo e unidade."
          emptyTitle="Sem precificacao ainda"
          emptyDescription="Custos exigem movimentacoes valorizadas e preco por item/lote. Quando isso existir no dominio, os indicadores entram neste modulo."
          upcoming={[
            'Consumo por periodo',
            'Custo por unidade',
            'Indicadores de desperdicio',
          ]}
        />
      )}
    </RequireClientAuth>
  );
}
