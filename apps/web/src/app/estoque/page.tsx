'use client';

import Link from 'next/link';
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
            <strong>Consultoria:</strong> catalogo de EPIs e base CAEPI
            (atualizacao da base).
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
          Use o catalogo e a base CA para manter o cadastro. A empresa opera o
          saldo no portal.
        </p>
        <div className="btn-row">
          <Link className="btn btn-primary" href="/epis">
            Catalogo de EPIs
          </Link>
          <Link className="btn btn-secondary" href="/caepi">
            Base CAEPI
          </Link>
          <Link className="btn btn-ghost" href="/portal/login">
            Ir ao portal do cliente
          </Link>
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
