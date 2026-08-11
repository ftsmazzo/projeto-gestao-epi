'use client';

import Link from 'next/link';
import { RequireAuth } from '../../components/RequireAuth';

/**
 * Entregas operacionais ficam no Painel do Cliente.
 * Esta rota da Consultoria foi descontinuada.
 */
function EntregasRetiredContent() {
  return (
    <div className="workspace-section">
      <div className="notice notice--warn" role="status">
        <p>
          <strong>Entregas sairam da Consultoria.</strong> O fluxo com biometria,
          baixa de estoque e comprovante vive no Painel do Cliente.
        </p>
      </div>

      <section className="surface" aria-labelledby="entregas-retired-title">
        <p className="page-kicker">Consultoria</p>
        <h1 id="entregas-retired-title" className="page-title">
          Entrega operacional no portal
        </h1>
        <p className="page-lead">
          Use o portal da empresa para entregar EPI. Aqui na Consultoria ficam
          implantacao, PGRO e biometria de referencia.
        </p>
        <div className="btn-row">
          <Link className="btn btn-primary" href="/portal/login">
            Ir ao portal do cliente
          </Link>
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

export default function EntregasPage() {
  return <RequireAuth>{() => <EntregasRetiredContent />}</RequireAuth>;
}
