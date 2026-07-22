'use client';

import { ModulePlaceholder } from '../../components/ModulePlaceholder';
import { RequireAuth } from '../../components/RequireAuth';

export default function ConfiguracoesPage() {
  return (
    <RequireAuth>
      {(user) => (
        <ModulePlaceholder
          kicker="Administracao"
          title="Configuracoes"
          description={`Parametros da organizacao ${user.organization.name}, usuarios e preferencias operacionais.`}
          emptyTitle="Configuracoes avancadas indisponiveis"
          emptyDescription="Nesta etapa voce ja autentica e consulta a franquia. Edicao de usuarios e politicas vem depois."
          primaryActionLabel="Editar organizacao (em breve)"
          upcoming={[
            'Dados da organizacao',
            'Usuarios e papeis',
            'Parametros de entrega',
          ]}
        />
      )}
    </RequireAuth>
  );
}
