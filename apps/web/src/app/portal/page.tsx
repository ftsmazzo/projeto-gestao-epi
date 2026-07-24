'use client';

import type { ClientPortalUser } from '@gestao-epi/shared';
import Link from 'next/link';
import { PortalDashboardCards } from '../../components/PortalDashboardCards';
import { RequireClientAuth } from '../../components/RequireClientAuth';
import { formatCnpj } from '../../lib/cnpj';
import { clientUserRoleLabel } from '../../lib/served-clients';

function PortalHome({ user }: { user: ClientPortalUser }) {
  const clientName =
    user.servedClient.tradeName || user.servedClient.legalName;

  return (
    <div className="portal-home">
      <header className="portal-home-header">
        <div>
          <p className="page-kicker">Painel do cliente</p>
          <h1 className="page-title">{clientName}</h1>
          <p className="page-lead">
            Bem-vindo, {user.name}. Este e o ambiente da empresa cliente —
            separado da Consultoria.
          </p>
        </div>
        <dl className="portal-identity meta-list">
          <div>
            <dt>CNPJ</dt>
            <dd className="mono">{formatCnpj(user.servedClient.cnpj)}</dd>
          </div>
          <div>
            <dt>Seu papel</dt>
            <dd>{clientUserRoleLabel(user.role)}</dd>
          </div>
          <div>
            <dt>Consultoria gestora</dt>
            <dd>{user.organization.name}</dd>
          </div>
        </dl>
      </header>

      {user.mustChangePassword ? (
        <div className="notice notice--warn" role="status">
          <p>
            Voce ainda usa senha temporaria.{' '}
            <Link href="/portal/conta?obrigatorio=1">Trocar senha agora</Link>
          </p>
        </div>
      ) : null}

      <PortalDashboardCards />
    </div>
  );
}

export default function PortalPage() {
  return (
    <RequireClientAuth>
      {(user) => <PortalHome user={user} />}
    </RequireClientAuth>
  );
}
