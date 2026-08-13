'use client';

import Link from 'next/link';
import { ClientPortalLaunchLink } from '../../components/ClientPortalLaunchLink';
import { RequireAuth } from '../../components/RequireAuth';

/**
 * Trabalhadores da operacao ficam no workspace do CNPJ e no Painel do Cliente.
 */
function TrabalhadoresRetiredContent() {
  return (
    <div className="workspace-section">
      <div className="notice notice--warn" role="status">
        <p>
          <strong>Trabalhadores nao ficam neste menu.</strong> Cadastro e
          biometria de referencia: workspace do cliente. Operacao do dia a dia:
          Painel do Cliente.
        </p>
      </div>

      <section className="surface" aria-labelledby="trab-retired-title">
        <p className="page-kicker">Consultoria</p>
        <h1 id="trab-retired-title" className="page-title">
          Trabalhadores por CNPJ
        </h1>
        <p className="page-lead">
          Abra o cliente atendido para gerir vidas e biometria, ou use o portal
          para a operacao da empresa.
        </p>
        <div className="btn-row">
          <Link className="btn btn-primary" href="/clientes">
            Clientes atendidos
          </Link>
          <ClientPortalLaunchLink className="btn btn-secondary">
            Portal do cliente
          </ClientPortalLaunchLink>
          <Link className="btn btn-ghost" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function TrabalhadoresPage() {
  return <RequireAuth>{() => <TrabalhadoresRetiredContent />}</RequireAuth>;
}
