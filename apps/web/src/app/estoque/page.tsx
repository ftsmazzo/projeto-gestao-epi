'use client';

import { ModulePlaceholder } from '../../components/ModulePlaceholder';
import { RequireAuth } from '../../components/RequireAuth';

export default function EstoquePage() {
  return (
    <RequireAuth>
      {() => (
        <ModulePlaceholder
          kicker="Operacao"
          title="Estoque"
          description="Saldos, lotes, validade e movimentacoes por local de armazenamento."
          emptyTitle="Sem movimentacoes"
          emptyDescription="O modulo de estoque sera conectado as entregas nas etapas seguintes."
          primaryActionLabel="Nova entrada (em breve)"
          upcoming={['Entrada por lote', 'Saldo disponivel', 'Alertas de vencimento']}
        />
      )}
    </RequireAuth>
  );
}
