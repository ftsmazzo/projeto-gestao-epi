'use client';

import type { ServedClient, ServedClientOverview } from '@gestao-epi/shared';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ClientPortalLaunchLink } from './ClientPortalLaunchLink';
import { formatCnpj } from '../lib/cnpj';
import { getServedClient, getServedClientOverview } from '../lib/served-clients';

type Props = {
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

type JourneyStep = {
  href: string;
  label: string;
  hint: string;
  done: boolean;
};

export function ClientWorkspaceShell({ children }: Props) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const clientId = params.id;
  const [client, setClient] = useState<ServedClient | null>(null);
  const [overview, setOverview] = useState<ServedClientOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return;
    try {
      const [c, ov] = await Promise.all([
        getServedClient(clientId),
        getServedClientOverview(clientId),
      ]);
      setClient(c);
      setOverview(ov);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar o cliente.',
      );
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const journey = useMemo((): JourneyStep[] => {
    if (!client || !overview) return [];
    const base = `/clientes/${client.id}`;
    const hasStructure =
      overview.counts.sectors.active > 0 ||
      overview.counts.jobFunctions.active > 0 ||
      overview.counts.epiNeeds.active > 0;
    const hasWorkers = overview.counts.workers.active > 0;
    const hasUsersAccess = hasStructure && hasWorkers;
    return [
      {
        href: `${base}/estrutura`,
        label: '1. Estrutura',
        hint: hasStructure ? 'PGR / setores ok' : 'Importar PGR ou montar',
        done: hasStructure,
      },
      {
        href: `${base}/trabalhadores`,
        label: '2. Trabalhadores',
        hint: hasWorkers
          ? `${overview.counts.workers.active} ativos`
          : 'Cadastrar vidas',
        done: hasWorkers,
      },
      {
        href: `${base}/usuarios`,
        label: '3. Acesso portal',
        hint: hasUsersAccess
          ? 'Criar ou revisar gestores'
          : 'Depende da estrutura e vidas',
        done: overview.operational,
      },
      {
        href: '/portal/login?sair=1',
        label: '4. Operar',
        hint: overview.operational
          ? 'Abre o portal em janela nova'
          : 'Conclua a implantacao',
        done: overview.operational,
      },
    ];
  }, [client, overview]);

  if (error && !client) {
    return (
      <div className="module-page">
        <p className="error" role="alert">
          {error}
        </p>
        <Link className="btn btn-secondary" href="/clientes">
          Voltar para clientes
        </Link>
      </div>
    );
  }

  if (!client) {
    return <p className="page-lead">Carregando workspace do cliente...</p>;
  }

  const displayName = client.tradeName || client.legalName;
  const base = `/clientes/${client.id}`;
  const nav: NavItem[] = [
    { href: base, label: 'Visao geral', exact: true },
    { href: `${base}/estrutura`, label: 'Estrutura' },
    {
      href: `${base}/atualizar-pgro`,
      label: overview?.counts.sectors.active
        ? 'Atualizar PGR'
        : 'Importar PGR',
    },
    { href: `${base}/usuarios`, label: 'Usuarios' },
    { href: `${base}/unidades`, label: 'Unidades' },
    { href: `${base}/trabalhadores`, label: 'Trabalhadores' },
  ];

  const firstPending = journey.find((s) => !s.done);

  return (
    <div className="client-workspace">
      <header className="client-workspace-header">
        <div>
          <p className="page-kicker">Workspace do cliente</p>
          <h1 className="page-title page-title--sm">{displayName}</h1>
          <p className="page-lead client-workspace-meta">
            <span className="mono">{formatCnpj(client.cnpj)}</span>
            <span
              className={`status-pill status-pill--${client.status.toLowerCase()}`}
            >
              {client.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
            </span>
            {overview ? (
              <span>
                Vidas {overview.lives.used}/{overview.lives.allocated}
              </span>
            ) : null}
          </p>
        </div>
        <Link className="btn btn-secondary" href="/clientes">
          Voltar a lista
        </Link>
      </header>

      {journey.length > 0 ? (
        <section className="journey-rail" aria-label="Roteiro de implantacao">
          <p className="journey-rail__title">Roteiro de implantacao</p>
          <ol className="journey-rail__steps">
            {journey.map((step) => {
              const isCurrent = firstPending?.href === step.href;
              const stateClass = step.done
                ? 'journey-step--done'
                : isCurrent
                  ? 'journey-step--current'
                  : 'journey-step--todo';
              const isPortalLaunch = step.href.startsWith('/portal/login');
              const stepInner = (
                <>
                  <span className="journey-step__label">{step.label}</span>
                  <span className="journey-step__hint">{step.hint}</span>
                </>
              );
              return (
                <li key={step.href}>
                  {isPortalLaunch ? (
                    <ClientPortalLaunchLink
                      className={`journey-step ${stateClass}`}
                    >
                      {stepInner}
                    </ClientPortalLaunchLink>
                  ) : (
                    <Link href={step.href} className={`journey-step ${stateClass}`}>
                      {stepInner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <nav className="client-workspace-nav" aria-label="Secoes do cliente">
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : !item.href.includes('?') && pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`client-workspace-nav-link ${active ? 'is-active' : ''}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="client-workspace-body">{children}</div>
    </div>
  );
}
