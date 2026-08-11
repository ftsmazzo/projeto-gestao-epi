'use client';

import Link from 'next/link';
import { RequireAuth } from '../../components/RequireAuth';

/**
 * Documentos imprimiveis (comprovante / ficha) ficam no Painel do Cliente.
 */
function DocumentosRetiredContent() {
  return (
    <div className="workspace-section">
      <div className="notice notice--warn" role="status">
        <p>
          <strong>Documentos de entrega e ficha ficam no portal.</strong>{' '}
          Comprovante, ficha de EPI e PDF saem do Painel do Cliente apos a
          operacao.
        </p>
      </div>

      <section className="surface" aria-labelledby="docs-retired-title">
        <p className="page-kicker">Consultoria</p>
        <h1 id="docs-retired-title" className="page-title">
          Documentos no portal
        </h1>
        <p className="page-lead">
          Acesse o portal da empresa para imprimir ou baixar comprovantes e
          fichas. PGRO e estrutura continuam na Consultoria.
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

export default function DocumentosPage() {
  return <RequireAuth>{() => <DocumentosRetiredContent />}</RequireAuth>;
}
