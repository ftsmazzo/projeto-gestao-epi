'use client';

import Link from 'next/link';
import { ClientPortalLaunchLink } from '../../components/ClientPortalLaunchLink';
import { RequireAuth } from '../../components/RequireAuth';

/**
 * Estoque operacional na Consultoria foi descontinuado.
 * Saldo e entrada ficam no Painel do Cliente; catalogo/CA na Consultoria.
 */
function EstoqueRetiredContent() {
  return (
    <div className="workspace-section">
      <div className="notice notice--warn" role="status">
        <p>
          <strong>Estoque da Consultoria foi retirado.</strong> No inicio do
          produto o saldo era inserido aqui e gerou resquicios. A regra vigente
          e:
        </p>
        <ul>
          <li>
            <strong>Consultoria:</strong> consulta do catalogo oficial CAEPI.
          </li>
          <li>
            <strong>Painel do Cliente:</strong> estoque operacional (entrada,
            saldo e baixa na entrega).
          </li>
        </ul>
      </div>

      <section className="surface" aria-labelledby="estoque-retired-title">
        <p className="page-kicker">Consultoria</p>
        <h1 id="estoque-retired-title" className="page-title">
          Estoque operacional saiu daqui
        </h1>
        <p className="page-lead">
          Consulte CAs oficiais no catalogo. A empresa opera o saldo no portal.
        </p>
        <div className="btn-row">
          <Link className="btn btn-primary" href="/epis">
            Catalogo de EPIs
          </Link>
          <ClientPortalLaunchLink className="btn btn-ghost">
            Ir ao portal do cliente
          </ClientPortalLaunchLink>
        </div>
      </section>
    </div>
  );
}

export default function EstoquePage() {
  return (
    <RequireAuth>{() => <EstoqueRetiredContent />}</RequireAuth>
  );
}
