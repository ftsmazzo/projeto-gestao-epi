'use client';

import { ModulePlaceholder } from '../../components/ModulePlaceholder';
import { RequireAuth } from '../../components/RequireAuth';

export default function DocumentosPage() {
  return (
    <RequireAuth>
      {() => (
        <ModulePlaceholder
          kicker="Conformidade"
          title="Documentos"
          description="Termos, evidencias e exportacoes usadas na operacao e auditoria."
          emptyTitle="Sem documentos"
          emptyDescription="Geracao e consulta de documentos entrarao apos a ficha eletronica."
          primaryActionLabel="Gerar documento (em breve)"
          upcoming={['Termos versionados', 'Exportacao PDF', 'Evidencias de entrega']}
        />
      )}
    </RequireAuth>
  );
}
