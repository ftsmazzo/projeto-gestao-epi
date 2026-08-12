'use client';

import type { PlatformAuthUser } from '@gestao-epi/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { PLATFORM_NAV } from '../lib/nav';
import { Brand } from './Brand';
import { IconBuilding, IconMenu } from './ui/NavIcons';

type Props = {
  children: ReactNode;
  user?: PlatformAuthUser | null;
  onLogout?: () => void;
};

export function PlatformShell({ children, user, onLogout }: Props) {
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

      <aside
        id="platform-nav"
        className={`ops-sidebar ${menuOpen ? 'is-open' : ''}`}
        aria-label="Navegacao da plataforma"
      >
        <div className="ops-sidebar-brand">
          <Brand href="/plataforma" compact />
          <span className="ops-sidebar-brand__meta">SaaS</span>
        </div>
        <p className="ops-nav-label">Plataforma</p>
        <nav className="ops-nav">
          {PLATFORM_NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`ops-nav-link ${active ? 'is-active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <span className="ops-nav-link__row">
                  <span className="ops-nav-link__icon">
                    <IconBuilding />
                  </span>
                  <span>{item.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="ops-sidebar-note">
          <p className="field-hint">
            Venda de franquia para consultorias. A Inseg e qualquer outra sao
            tenants aqui.
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

      <div className="ops-content">
        <header className="ops-topbar">
          <div className="ops-topbar-left">
            <button
              type="button"
              className="btn btn-secondary ops-menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="platform-nav"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <IconMenu />
            </button>
            <span className="ops-topbar-crumb">Painel SaaS</span>
          </div>
          <div className="ops-topbar-right">
            {user ? (
              <div className="ops-user">
                <span className="ops-user-name">{user.name}</span>
                <span className="ops-user-org">ProntEPI</span>
              </div>
            ) : null}
            {onLogout ? (
              <button type="button" className="btn btn-ghost" onClick={onLogout}>
                Sair
              </button>
            ) : null}
          </div>
        </header>

        <main id="conteudo" className="ops-main ux-enter">
          {children}
        </main>
      </div>
    </div>
  );
}
