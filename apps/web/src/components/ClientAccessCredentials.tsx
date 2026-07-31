'use client';

import type {
  AccessInviteDeliveryStatus,
  ClientInitialAccess,
} from '@gestao-epi/shared';
import { formatAccessCredentialsCopy } from '../lib/served-clients';

type Props = {
  access: ClientInitialAccess;
  title?: string;
  onDismiss?: () => void;
};

function deliveryLabel(status: AccessInviteDeliveryStatus | undefined) {
  switch (status) {
    case 'SENT':
      return 'Enviado';
    case 'FAILED':
      return 'Falhou';
    case 'SKIPPED':
      return 'Ignorado (comunicacoes desligadas)';
    case 'PENDING':
      return 'Na fila';
    case 'NOT_REQUESTED':
      return 'Nao solicitado';
    default:
      return '—';
  }
}

function deliveryTone(status: AccessInviteDeliveryStatus | undefined) {
  if (status === 'SENT') return 'ok';
  if (status === 'FAILED') return 'warn';
  return 'muted';
}

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

  const delivery = access.delivery;
  const emailStatus = delivery?.email;
  const whatsappStatus = delivery?.whatsapp;

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
        {access.managerPhone ? (
          <div>
            <dt>WhatsApp</dt>
            <dd className="mono">{access.managerPhone}</dd>
          </div>
        ) : null}
        <div>
          <dt>Senha temporaria</dt>
          <dd className="mono access-credentials__password">
            {access.temporaryPassword}
          </dd>
        </div>
      </dl>

      {delivery ? (
        <div className="access-credentials__delivery" role="status">
          <p className="page-kicker">Envio automatico</p>
          <ul className="access-credentials__delivery-list">
            <li data-tone={deliveryTone(emailStatus)}>
              E-mail ({access.managerEmail}): {deliveryLabel(emailStatus)}
            </li>
            <li data-tone={deliveryTone(whatsappStatus)}>
              WhatsApp
              {access.managerPhone ? ` (${access.managerPhone})` : ''}:{' '}
              {deliveryLabel(whatsappStatus)}
              {delivery.whatsappError ? (
                <span className="table-sub"> — {delivery.whatsappError}</span>
              ) : null}
            </li>
          </ul>
        </div>
      ) : null}

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
