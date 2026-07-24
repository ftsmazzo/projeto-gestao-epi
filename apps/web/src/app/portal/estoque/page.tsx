'use client';

import { PortalSoonModule } from '../../../components/PortalSoonModule';
import { RequireClientAuth } from '../../../components/RequireClientAuth';

export default function PortalEstoquePage() {
  return (
    <RequireClientAuth>
      {() => (
        <PortalSoonModule
          title="Estoque"
          description="Saldo, lotes e disponibilidade operacional da empresa."
          emptyTitle="Estoque ainda nao configurado"
          emptyDescription="O estoque operacional desta empresa sera controlado aqui. A Consultoria nao opera este menu."
          upcoming={[
            'Saldo por item e local',
            'Entradas e baixas',
            'Alertas de baixo estoque',
          ]}
        />
      )}
    </RequireClientAuth>
  );
}
