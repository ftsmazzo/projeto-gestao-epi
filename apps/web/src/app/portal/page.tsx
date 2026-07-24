'use client';

import type { ClientPortalUser } from '@gestao-epi/shared';
import Link from 'next/link';
import { RequireClientAuth } from '../../components/RequireClientAuth';
import { formatCnpj } from '../../lib/cnpj';
import { clientUserRoleLabel } from '../../lib/served-clients';

function PortalHome({ user }: { user: ClientPortalUser }) {
  const clientName =
    user.servedClient.tradeName || user.servedClient.legalName;

  return (
    <div className="portal-home">
      <section className="portal-card">
        <p className="page-kicker">Inicio</p>
        <h1 className="page-title">{clientName}</h1>
        <p className="page-lead">
          Bem-vindo, {user.name}. Voce esta no portal da empresa cliente — fora
          da area da Consultoria.
        </p>
        <dl className="meta-list">
          <div>
            <dt>CNPJ</dt>
            <dd className="mono">{formatCnpj(user.servedClient.cnpj)}</dd>
          </div>
          <div>
            <dt>Seu papel</dt>
            <dd>{clientUserRoleLabel(user.role)}</dd>
          </div>
          <div>
            <dt>Organizacao gestora</dt>
            <dd>{user.organization.name}</dd>
          </div>
        </dl>
        {user.mustChangePassword ? (
          <div className="notice notice--warn" role="status">
            <p>
              Voce ainda usa senha temporaria.{' '}
              <Link href="/portal/conta?obrigatorio=1">Trocar senha agora</Link>
            </p>
          </div>
        ) : null}
      </section>

      <section className="portal-card">
        <h2 className="page-title page-title--sm">Proximos modulos</h2>
        <p className="page-lead">
          Entregas, estoque do cliente, documentos e relatorios entrarao aqui
          nas proximas etapas.
        </p>
        <ul className="upcoming-list">
          <li>Acompanhar entregas e fichas</li>
          <li>Consultar estoque da empresa</li>
          <li>Documentos e evidencias</li>
        </ul>
        <div className="btn-row">
          <Link className="btn btn-secondary" href="/portal/conta">
            Minha conta
          </Link>
        </div>
      </section>
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
