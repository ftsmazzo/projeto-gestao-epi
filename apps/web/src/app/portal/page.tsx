'use client';

import type {
  ClientPortalUser,
  PortalDashboardResponse,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { InstallAppBanner } from '../../components/InstallAppBanner';
import { PortalDashboardCards } from '../../components/PortalDashboardCards';
import { StockDashboardKpis } from '../../components/portal/StockDashboardKpis';
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

  const kpiItems = useMemo(() => {
    if (!dash) return [];
    return [
      {
        id: 'lives',
        label: 'Vidas',
        value: `${dash.lives.used}/${dash.lives.allocated}`,
        hint: 'Trabalhadores ativos / franquia',
      },
      {
        id: 'sectors',
        label: 'Setores',
        value: dash.counts.sectorsActive,
      },
      {
        id: 'jobs',
        label: 'Funcoes',
        value: dash.counts.jobsActive,
      },
      {
        id: 'attention',
        label: 'Pontos de atencao',
        value:
          dash.attention?.cards.filter(
            (c) => c.visible && c.id !== 'deliveries',
          ).length ?? 0,
        tone:
          (dash.attention?.cards.filter(
            (c) => c.visible && c.id !== 'deliveries',
          ).length ?? 0) > 0
            ? ('warn' as const)
            : ('ok' as const),
      },
    ];
  }, [dash]);

  return (
    <div className="portal-home">
      <InstallAppBanner />
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Painel do cliente</p>
          <h1 className="page-title">{clientName}</h1>
          <p className="page-lead mono">
            CNPJ {formatCnpj(user.servedClient.cnpj)} · Ola, {user.name}
          </p>
        </div>
        <div className="dash-page-header__actions">
          <Link href="/portal/entregas" className="btn btn-primary">
            Nova entrega
          </Link>
          <Link href="/portal/estoque" className="btn btn-secondary">
            Estoque
          </Link>
        </div>
      </header>

      <section className="action-strip ux-enter" aria-label="Acoes do dia">
        <Link
          href="/portal/entregas"
          className="action-tile action-tile--primary"
        >
          <p className="action-tile__kicker">Principal</p>
          <h2 className="action-tile__title">Nova entrega</h2>
          <p className="action-tile__desc">
            Trabalhador, EPI e biometria facial.
          </p>
        </Link>
        <Link href="/portal/estoque" className="action-tile">
          <p className="action-tile__kicker">Estoque</p>
          <h2 className="action-tile__title">Dashboard e entradas</h2>
          <p className="action-tile__desc">
            Saldos, consumo e compra com CAEPI.
          </p>
        </Link>
        <Link href="/portal/validade" className="action-tile">
          <p className="action-tile__kicker">Alertas</p>
          <h2 className="action-tile__title">Validades</h2>
          <p className="action-tile__desc">
            Trocas proximas e EPIs criticos.
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

      {dash ? <StockDashboardKpis items={kpiItems} /> : null}

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
