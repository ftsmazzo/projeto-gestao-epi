'use client';

import type { ClientPortalUser } from '@gestao-epi/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { isPortalNavActive, PORTAL_NAV } from '../lib/nav';

type Props = {
  children: ReactNode;
  user?: ClientPortalUser | null;
  onLogout?: () => void;
};

export function PortalShell({ children, user, onLogout }: Props) {
  const pathname = usePathname();
  const clientName =
    user?.servedClient.tradeName || user?.servedClient.legalName || null;

  return (
    <div className="portal-shell">
      <a className="skip-link" href="#portal-conteudo">
        Ir para o conteudo
      </a>
      <header className="portal-topbar">
        <div className="portal-topbar-brand">
          <Link href="/portal" className="portal-brand">
            <span className="portal-brand-kicker">Painel do cliente</span>
            <strong className="portal-brand-name">
              {clientName ?? 'Gestao de EPI'}
            </strong>
          </Link>
        </div>
        {user ? (
          <nav className="portal-nav" aria-label="Dia a dia da empresa">
            {PORTAL_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`portal-nav-link ${
                  isPortalNavActive(pathname, item) ? 'is-active' : ''
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="portal-topbar-right">
          {user ? (
            <div className="portal-user">
              <span className="portal-user-name">{user.name}</span>
              <span className="portal-user-role">
                {user.role === 'CLIENT_MANAGER'
                  ? 'Gestor'
                  : user.role === 'STOCK_OPERATOR'
                    ? 'Estoque'
                    : user.role}
              </span>
            </div>
          ) : null}
          {onLogout ? (
            <button type="button" className="btn btn-secondary" onClick={onLogout}>
              Sair
            </button>
          ) : null}
        </div>
      </header>
      <main id="portal-conteudo" className="portal-main">
        {children}
      </main>
    </div>
  );
}
