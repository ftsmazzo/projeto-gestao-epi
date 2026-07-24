'use client';

import type { ClientPortalUser } from '@gestao-epi/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

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
            <span className="portal-brand-kicker">Portal do cliente</span>
            <strong className="portal-brand-name">
              {clientName ?? 'Gestao de EPI'}
            </strong>
          </Link>
        </div>
        {user ? (
          <nav className="portal-nav" aria-label="Portal">
            <Link
              href="/portal"
              className={`portal-nav-link ${pathname === '/portal' ? 'is-active' : ''}`}
            >
              Inicio
            </Link>
            <Link
              href="/portal/conta"
              className={`portal-nav-link ${pathname.startsWith('/portal/conta') ? 'is-active' : ''}`}
            >
              Minha conta
            </Link>
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
