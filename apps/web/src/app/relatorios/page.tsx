'use client';

import Link from 'next/link';
import { ClientPortalLaunchLink } from '../../components/ClientPortalLaunchLink';
import { RequireAuth } from '../../components/RequireAuth';

/**
 * Relatorios operacionais ficam no Painel do Cliente.
 */
function RelatoriosRetiredContent() {
  return (
    <div className="workspace-section">
      <div className="notice notice--warn" role="status">
        <p>
          <strong>Relatorios operacionais sairam da Consultoria.</strong>{' '}
          Entregas, trocas, estoque e cobertura ficam no Painel do Cliente.
        </p>
      </div>

      <section className="surface" aria-labelledby="rel-retired-title">
        <p className="page-kicker">Consultoria</p>
        <h1 id="rel-retired-title" className="page-title">
          Relatorios no portal
        </h1>
        <p className="page-lead">
          A empresa consulta e exporta no portal. A Consultoria acompanha pela
          implantacao e pelos clientes atendidos.
        </p>
        <div className="btn-row">
          <ClientPortalLaunchLink className="btn btn-primary">
            Ir ao portal do cliente
          </ClientPortalLaunchLink>
          <Link className="btn btn-secondary" href="/clientes">
            Clientes atendidos
          </Link>
          <Link className="btn btn-ghost" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function RelatoriosPage() {
  return <RequireAuth>{() => <RelatoriosRetiredContent />}</RequireAuth>;
}
