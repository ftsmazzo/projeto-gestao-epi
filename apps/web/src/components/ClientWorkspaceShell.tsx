'use client';

import type { ServedClient, ServedClientOverview } from '@gestao-epi/shared';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { formatCnpj } from '../lib/cnpj';
import { getServedClient, getServedClientOverview } from '../lib/served-clients';

type Props = {
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  external?: boolean;
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
    { href: `${base}/atualizar-pgro`, label: 'Atualizar PGRO' },
    { href: `${base}/usuarios`, label: 'Usuarios' },
    { href: `${base}/unidades`, label: 'Unidades' },
    { href: `${base}/trabalhadores`, label: 'Trabalhadores' },
  ];

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
