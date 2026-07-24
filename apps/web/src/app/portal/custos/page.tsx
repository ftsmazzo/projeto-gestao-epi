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
          emptyTitle="Sem dados de custo"
          emptyDescription="Custos e consumo entrarao apos movimentacoes de estoque e entregas nesta empresa."
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
