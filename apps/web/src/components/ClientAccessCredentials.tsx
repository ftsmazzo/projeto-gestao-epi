'use client';

import type { ClientInitialAccess } from '@gestao-epi/shared';
import { formatAccessCredentialsCopy } from '../lib/served-clients';

type Props = {
  access: ClientInitialAccess;
  title?: string;
};

export function ClientAccessCredentials({
  access,
  title = 'Dados de acesso do gestor',
}: Props) {
  async function copyAccess() {
    const text = formatAccessCredentialsCopy(access);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copie os dados de acesso:', text);
    }
  }

  return (
    <div className="access-credentials" role="region" aria-label={title}>
      <p className="page-kicker">{title}</p>
      <p className="page-lead access-credentials__warning">
        Copie estes dados agora. A senha temporaria nao sera exibida novamente.
      </p>
      <dl className="access-credentials__list">
        <div>
          <dt>Link de acesso</dt>
          <dd className="mono">{access.accessUrl}</dd>
        </div>
        <div>
          <dt>Usuario / e-mail</dt>
          <dd className="mono">{access.managerEmail}</dd>
        </div>
        <div>
          <dt>Senha temporaria</dt>
          <dd className="mono access-credentials__password">
            {access.temporaryPassword}
          </dd>
        </div>
      </dl>
      <p className="field-hint">{access.warning}</p>
      <p className="field-hint">
        Portal do cliente sera habilitado nas proximas etapas. Envio por
        WhatsApp/e-mail sera implementado depois.
      </p>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={() => void copyAccess()}>
          Copiar dados de acesso
        </button>
      </div>
    </div>
  );
}
