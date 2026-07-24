'use client';

import { PortalSoonModule } from '../../../components/PortalSoonModule';
import { RequireClientAuth } from '../../../components/RequireClientAuth';

export default function PortalValidadePage() {
  return (
    <RequireClientAuth>
      {() => (
        <PortalSoonModule
          title="Validade"
          description="CA, vida util e vencimentos que exigem atencao."
          emptyTitle="Sem alertas de validade"
          emptyDescription="Quando houver EPIs e lotes vinculados a esta empresa, os vencimentos aparecerao neste modulo."
          upcoming={[
            'CA proximos do vencimento',
            'Vida util por necessidade',
            'Prioridade de troca',
          ]}
        />
      )}
    </RequireClientAuth>
  );
}
