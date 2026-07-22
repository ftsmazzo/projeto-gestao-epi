'use client';

import Link from 'next/link';
import { RequireAuth } from '../../components/RequireAuth';

export default function PortalClientePage() {
  return (
    <RequireAuth>
      {() => (
        <div className="module-page">
          <header className="module-header">
            <div>
              <p className="page-kicker">Portal do cliente</p>
              <h1 className="page-title">Area do cliente atendido</h1>
              <p className="page-lead">
                Espaco futuro para usuarios do cliente acompanharem relatorios,
                documentos e operacao de entrega/checagem facial, sem acesso as
                camadas administrativas do tenant.
              </p>
            </div>
            <button type="button" className="btn btn-primary" disabled>
              Entrar no portal (em breve)
            </button>
          </header>

          <div className="dashboard-grid">
            <section className="surface" aria-labelledby="portal-scope">
              <p className="page-kicker">Escopo previsto</p>
              <h2 id="portal-scope" className="page-title page-title--sm">
                O que o cliente vera
              </h2>
              <ul className="upcoming-list">
                <li>Relatorios do proprio CNPJ/cliente</li>
                <li>Documentos e evidencias autorizadas</li>
                <li>Operacao de entrega e checagem facial</li>
                <li>Sem acesso a configuracoes do tenant</li>
              </ul>
            </section>

            <section className="surface surface--graphite" aria-labelledby="portal-status">
              <p className="page-kicker page-kicker--on-dark">Status</p>
              <h2
                id="portal-status"
                className="page-title page-title--sm page-title--on-dark"
              >
                Ainda nao implementado
              </h2>
              <p className="page-lead page-lead--on-dark">
                Esta tela e apenas preparacao visual. Auth, permissoes e dados
                do cliente atendido entram em epicos futuros.
              </p>
              <div className="btn-row">
                <Link className="btn btn-secondary" href="/dashboard">
                  Voltar ao dashboard
                </Link>
              </div>
            </section>
          </div>
        </div>
      )}
    </RequireAuth>
  );
}
