'use client';

import type { AuthUser } from '@gestao-epi/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { OPS_NAV } from '../lib/nav';
import { Brand } from './Brand';
import {
  IconBuilding,
  IconHome,
  IconMenu,
  IconPackage,
  IconSettings,
  IconWallet,
} from './ui/NavIcons';

type OpsShellProps = {
  children: ReactNode;
  user?: AuthUser | null;
  onLogout?: () => void;
};

function navIcon(href: string) {
  switch (href) {
    case '/dashboard':
      return <IconHome />;
    case '/clientes':
      return <IconBuilding />;
    case '/assinaturas':
      return <IconWallet />;
    case '/configuracoes':
      return <IconSettings />;
    case '/epis':
      return <IconPackage />;
    default:
      return <IconHome />;
  }
}

export function OpsShell({ children, user, onLogout }: OpsShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="ops-shell">
      <a className="skip-link" href="#conteudo">
        Ir para o conteudo
      </a>

      <header className="ops-topbar">
        <div className="ops-topbar-left">
          <button
            type="button"
            className="btn btn-secondary ops-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="ops-nav"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <IconMenu />
          </button>
          <Brand href="/dashboard" compact />
        </div>
        <div className="ops-topbar-right">
          {user ? (
            <div className="ops-user">
              <span className="ops-user-name">{user.name}</span>
              <span className="ops-user-org">{user.organization.name}</span>
            </div>
          ) : null}
          {onLogout ? (
            <button type="button" className="btn btn-ghost" onClick={onLogout}>
              Sair
            </button>
          ) : null}
        </div>
      </header>

      <div className="ops-body">
        <aside
          id="ops-nav"
          className={`ops-sidebar ${menuOpen ? 'is-open' : ''}`}
          aria-label="Navegacao da consultoria"
        >
          <p className="ops-nav-label">Consultoria</p>
          <nav className="ops-nav">
            {OPS_NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`ops-nav-link ${active ? 'is-active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="ops-nav-link__row">
                    <span className="ops-nav-link__icon">{navIcon(item.href)}</span>
                    <span>{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="ops-sidebar-note">
            <p className="field-hint">
              Implante o cliente aqui. O dia a dia da empresa acontece no painel
              do cliente.
            </p>
          </div>
        </aside>

        {menuOpen ? (
          <button
            type="button"
            className="ops-backdrop"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          />
        ) : null}

        <main id="conteudo" className="ops-main ux-enter">
          {children}
        </main>
      </div>
    </div>
  );
}
