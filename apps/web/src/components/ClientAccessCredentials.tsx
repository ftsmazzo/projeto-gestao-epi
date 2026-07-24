'use client';

import type { ClientInitialAccess } from '@gestao-epi/shared';
import { formatAccessCredentialsCopy } from '../lib/served-clients';

type Props = {
  access: ClientInitialAccess;
  title?: string;
  onDismiss?: () => void;
};

export function ClientAccessCredentials({
  access,
  title = 'Dados de acesso do gestor',
  onDismiss,
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
      <div className="notice notice--warn" role="status">
        <p>
          Entregue ao gestor o link do <strong>portal do cliente</strong>. Nao
          use o login da Consultoria/Gestao.
        </p>
      </div>
      <dl className="access-credentials__list">
        <div>
          <dt>Link do portal</dt>
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
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void copyAccess()}
        >
          Copiar dados de acesso
        </button>
        {onDismiss ? (
          <button type="button" className="btn btn-secondary" onClick={onDismiss}>
            Ja copiei / ocultar
          </button>
        ) : null}
      </div>
    </div>
  );
}
