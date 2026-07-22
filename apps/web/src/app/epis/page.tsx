'use client';

import { ModulePlaceholder } from '../../components/ModulePlaceholder';
import { RequireAuth } from '../../components/RequireAuth';

export default function EpisPage() {
  return (
    <RequireAuth>
      {() => (
        <ModulePlaceholder
          kicker="Catalogo"
          title="EPIs"
          description="Book de equipamentos com CA, validade, vida util e variacoes."
          emptyTitle="Catalogo vazio"
          emptyDescription="O cadastro de EPIs ainda nao esta disponivel nesta etapa."
          primaryActionLabel="Novo EPI (em breve)"
          upcoming={['CA e validade', 'Variacoes de tamanho', 'Status ativo/inativo']}
        />
      )}
    </RequireAuth>
  );
}
