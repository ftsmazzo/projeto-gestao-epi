'use client';

import type {
  ClientPortalUser,
  PortalDashboardResponse,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PortalDashboardCards } from '../../components/PortalDashboardCards';
import { RequireClientAuth } from '../../components/RequireClientAuth';
import { formatCnpj } from '../../lib/cnpj';
import { fetchPortalDashboard, fetchPortalReportsOverview } from '../../lib/client-auth';
import { clientUserRoleLabel } from '../../lib/served-clients';

function PortalHome({ user }: { user: ClientPortalUser }) {
  const clientName =
    user.servedClient.tradeName || user.servedClient.legalName;
  const [dash, setDash] = useState<PortalDashboardResponse | null>(null);
  const [reportCards, setReportCards] = useState<{
    deliveriesInPeriod: number;
    stockLowOrZero: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchPortalDashboard(),
      fetchPortalReportsOverview().catch(() => null),
    ])
      .then(([data, overview]) => {
        if (!cancelled) {
          setDash(data);
          if (overview) {
            setReportCards({
              deliveriesInPeriod: overview.cards.deliveriesInPeriod,
              stockLowOrZero: overview.cards.stockLowOrZero,
            });
          }
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
      <header className="portal-home-header">
        <div>
          <p className="page-kicker">Painel do cliente</p>
          <h1 className="page-title">{clientName}</h1>
          <p className="page-lead">
            Bem-vindo, {user.name}. Ambiente operacional da empresa — separado
            da Consultoria.
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

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !dash ? (
        <p className="page-lead">Carregando indicadores...</p>
      ) : null}

      {dash ? (
        <section className="quota-summary" aria-label="Resumo da empresa">
          <div className="quota-summary-item">
            <span className="quota-summary-label">Vidas</span>
            <strong className="quota-summary-value">
              {dash.lives.used}/{dash.lives.allocated}
            </strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Unidades</span>
            <strong className="quota-summary-value">
              {dash.counts.unitsActive}
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
          <div className="quota-summary-item">
            <span className="quota-summary-label">Necessidades</span>
            <strong className="quota-summary-value">
              {dash.counts.uniqueNeeds}
            </strong>
          </div>
        </section>
      ) : null}

      <PortalDashboardCards
        metrics={
          dash
            ? {
                entregas: dash.metrics.entregas,
                relatorios: reportCards?.deliveriesInPeriod ?? null,
                validade: dash.metrics.validade,
                custos: dash.metrics.custos,
                estoque:
                  reportCards?.stockLowOrZero ?? dash.metrics.estoque,
              }
            : undefined
        }
        ready={
          dash
            ? {
                entregas: dash.modules.entregas.ready,
                relatorios: true,
                validade: dash.modules.validade.ready,
                custos: dash.modules.custos.ready,
                estoque: dash.modules.estoque.ready,
              }
            : undefined
        }
      />
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
