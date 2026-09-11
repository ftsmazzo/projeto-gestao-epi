'use client';

import type {
  CaCertificateSearchItem,
  ClientPortalUser,
  PortalDashboardResponse,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { InstallAppBanner } from '../../components/InstallAppBanner';
import { PortalDashboardCards } from '../../components/PortalDashboardCards';
import { StockDashboardKpis } from '../../components/portal/StockDashboardKpis';
import { RequireClientAuth } from '../../components/RequireClientAuth';
import { formatCnpj } from '../../lib/cnpj';
import { fetchPortalDashboard, searchPortalCaepi } from '../../lib/client-auth';

type CaValidationResult = {
  typedCa: string;
  found: CaCertificateSearchItem | null;
  isValid: boolean;
};

function normalizeCaInput(raw: string) {
  return raw.replace(/\D/g, '');
}

function PortalHome({ user }: { user: ClientPortalUser }) {
  const clientName =
    user.servedClient.tradeName || user.servedClient.legalName;
  const [dash, setDash] = useState<PortalDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [caQuery, setCaQuery] = useState('');
  const [caChecking, setCaChecking] = useState(false);
  const [caError, setCaError] = useState<string | null>(null);
  const [caValidation, setCaValidation] = useState<CaValidationResult | null>(
    null,
  );

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

  async function submitCaValidation(event: FormEvent) {
    event.preventDefault();
    const typedCa = normalizeCaInput(caQuery);
    if (typedCa.length < 3) {
      setCaValidation(null);
      setCaError('Digite ao menos 3 numeros para validar o CA.');
      return;
    }
    setCaError(null);
    setCaChecking(true);
    try {
      const res = await searchPortalCaepi(typedCa, 8);
      const found =
        res.items.find((item) => normalizeCaInput(item.caNumber) === typedCa) ??
        null;
      setCaValidation({
        typedCa,
        found,
        isValid: Boolean(found && found.status === 'VALIDO'),
      });
    } catch (err) {
      setCaValidation(null);
      setCaError(err instanceof Error ? err.message : 'Falha ao validar CA.');
    } finally {
      setCaChecking(false);
    }
  }

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

      <section className="portal-card" aria-labelledby="ca-validate-title">
        <div className="dash-panel__head">
          <h2 id="ca-validate-title">Validar CA</h2>
          <p>Digite o numero do CA e veja se esta valido.</p>
        </div>
        <form className="form-panel" onSubmit={submitCaValidation}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="portal-ca-validate-input">Numero do CA</label>
              <input
                id="portal-ca-validate-input"
                type="text"
                inputMode="numeric"
                value={caQuery}
                onChange={(e) => setCaQuery(e.target.value)}
                placeholder="Ex.: 11442"
                autoComplete="off"
              />
            </div>
            <div className="field" style={{ alignSelf: 'end' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={caChecking || normalizeCaInput(caQuery).length < 3}
              >
                {caChecking ? 'Validando...' : 'Validar CA'}
              </button>
            </div>
          </div>
        </form>

        {caValidation ? (
          <p
            className={caValidation.isValid ? 'notice notice--ok' : 'notice notice--warn'}
            role="status"
          >
            CA {caValidation.typedCa}:{' '}
            <strong>{caValidation.isValid ? 'VALIDO' : 'NAO VALIDO'}</strong>
          </p>
        ) : null}
        {caError ? (
          <p className="error" role="alert">
            {caError}
          </p>
        ) : null}
      </section>
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
