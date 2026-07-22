'use client';

import { ModulePlaceholder } from '../../components/ModulePlaceholder';
import { RequireAuth } from '../../components/RequireAuth';

export default function RelatoriosPage() {
  return (
    <RequireAuth>
      {() => (
        <ModulePlaceholder
          kicker="Gestao"
          title="Relatorios"
          description="Visao gerencial de entregas, pendencias, estoque e uso de franquia."
          emptyTitle="Sem dados para relatar"
          emptyDescription="Os relatorios dependem dos eventos operacionais das proximas etapas."
          primaryActionLabel="Gerar relatorio (em breve)"
          upcoming={[
            'Entregas por periodo',
            'Uso de vidas/cotas',
            'Exportacao para auditoria',
          ]}
        />
      )}
    </RequireAuth>
  );
}
