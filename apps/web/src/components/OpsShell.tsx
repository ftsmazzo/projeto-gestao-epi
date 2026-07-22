'use client';

import type { AuthUser } from '@gestao-epi/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { OPS_NAV } from '../lib/nav';
import { Brand } from './Brand';

type OpsShellProps = {
  children: ReactNode;
  user?: AuthUser | null;
  onLogout?: () => void;
};

export function OpsShell({ children, user, onLogout }: OpsShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

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
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu
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
            <button type="button" className="btn btn-danger" onClick={onLogout}>
              Sair
            </button>
          ) : null}
        </div>
      </header>

      <div className="ops-body">
        <aside
          id="ops-nav"
          className={`ops-sidebar ${menuOpen ? 'is-open' : ''}`}
          aria-label="Navegacao operacional"
        >
          <p className="ops-nav-label">Web Admin</p>
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
                  <span>{item.label}</span>
                  {item.status === 'soon' ? (
                    <span className="ops-nav-badge">Em breve</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ops-sidebar-note">
            <p className="ops-nav-label">Portal do cliente</p>
            <p className="field-hint">
              Area futura para usuarios do cliente atendido acompanharem
              relatorios e operacao, sem acesso admin do tenant.
            </p>
            <Link
              href="/portal-cliente"
              className="ops-nav-link"
              onClick={() => setMenuOpen(false)}
            >
              <span>Visao previa</span>
              <span className="ops-nav-badge">Em breve</span>
            </Link>
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

        <main id="conteudo" className="ops-main">
          {children}
        </main>
      </div>
    </div>
  );
}
