'use client';

import type {
  ClientPortalUser,
  PortalDashboardResponse,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { InstallAppBanner } from '../../components/InstallAppBanner';
import { PortalDashboardCards } from '../../components/PortalDashboardCards';
import { RequireClientAuth } from '../../components/RequireClientAuth';
import { formatCnpj } from '../../lib/cnpj';
import { fetchPortalDashboard } from '../../lib/client-auth';

function PortalHome({ user }: { user: ClientPortalUser }) {
  const clientName =
    user.servedClient.tradeName || user.servedClient.legalName;
  const [dash, setDash] = useState<PortalDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchPortalDashboard()
      .then((data) => {
        if (!cancelled) {
          setDash(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Falha ao carregar o painel.',
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="portal-home">
      <InstallAppBanner />
      <header className="portal-home-header portal-home-header--decision">
        <div className="portal-home-brand">
          <h1 className="portal-home-title">{clientName}</h1>
          <p className="portal-home-cnpj mono">
            CNPJ {formatCnpj(user.servedClient.cnpj)}
          </p>
        </div>
        <p className="portal-home-welcome">Ola, {user.name}.</p>
      </header>

      <section className="action-strip ux-enter" aria-label="Acoes do dia">
        <Link
          href="/portal/entregas"
          className="action-tile action-tile--primary"
        >
          <p className="action-tile__kicker">Principal</p>
          <h2 className="action-tile__title">Nova entrega</h2>
          <p className="action-tile__desc">
            Selecionar trabalhador, EPI e confirmar com biometria facial.
          </p>
        </Link>
        <Link href="/portal/estoque" className="action-tile">
          <p className="action-tile__kicker">Estoque</p>
          <h2 className="action-tile__title">Entrada e saldos</h2>
          <p className="action-tile__desc">
            Registrar compra com CAEPI e acompanhar quantidade.
          </p>
        </Link>
        <Link href="/portal/validade" className="action-tile">
          <p className="action-tile__kicker">Alertas</p>
          <h2 className="action-tile__title">Validades</h2>
          <p className="action-tile__desc">
            Ver trocas proximas e EPIs vencidos ou criticos.
          </p>
        </Link>
      </section>

      {user.mustChangePassword ? (
        <div className="notice notice--warn" role="status">
          <p>
            Voce ainda usa senha temporaria.{' '}
            <Link href="/portal/conta?obrigatorio=1">Trocar senha agora</Link>
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !dash ? (
        <p className="page-lead">Carregando indicadores...</p>
      ) : null}

      {dash ? (
        <section
          className="quota-summary quota-summary--compact ux-enter-delay"
          aria-label="Resumo da empresa"
        >
          <div className="quota-summary-item">
            <span className="quota-summary-label">Vidas</span>
            <strong className="quota-summary-value">
              {dash.lives.used}/{dash.lives.allocated}
            </strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Setores</span>
            <strong className="quota-summary-value">
              {dash.counts.sectorsActive}
            </strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Funcoes</span>
            <strong className="quota-summary-value">
              {dash.counts.jobsActive}
            </strong>
          </div>
        </section>
      ) : null}

      {dash?.attention ? (
        <PortalDashboardCards cards={dash.attention.cards} />
      ) : null}
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
