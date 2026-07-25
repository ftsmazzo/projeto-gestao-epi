'use client';

import type { ClientPortalUser } from '@gestao-epi/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useId, useState } from 'react';
import { isPortalNavActive, PORTAL_NAV } from '../lib/nav';

type Props = {
  children: ReactNode;
  user?: ClientPortalUser | null;
  onLogout?: () => void;
};

/** Itens fixos na barra inferior (mobile). */
const BOTTOM_PRIMARY = [
  '/portal',
  '/portal/entregas',
  '/portal/estoque',
  '/portal/relatorios',
] as const;

export function PortalShell({ children, user, onLogout }: Props) {
  const pathname = usePathname();
  const drawerId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const clientName =
    user?.servedClient.tradeName || user?.servedClient.legalName || null;

  const primaryItems = PORTAL_NAV.filter((item) =>
    (BOTTOM_PRIMARY as readonly string[]).includes(item.href),
  );
  const moreItems = PORTAL_NAV.filter(
    (item) => !(BOTTOM_PRIMARY as readonly string[]).includes(item.href),
  );
  const moreActive = moreItems.some((item) =>
    isPortalNavActive(pathname, item),
  );

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className={`portal-shell${user ? ' portal-shell--authed' : ''}`}>
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
          <nav className="portal-nav portal-nav--desktop" aria-label="Dia a dia da empresa">
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
          {user ? (
            <button
              type="button"
              className="btn btn-secondary portal-menu-toggle"
              aria-expanded={menuOpen}
              aria-controls={drawerId}
              onClick={() => setMenuOpen((v) => !v)}
            >
              Menu
            </button>
          ) : null}
          {onLogout ? (
            <button
              type="button"
              className="btn btn-secondary portal-logout-desktop"
              onClick={onLogout}
            >
              Sair
            </button>
          ) : null}
        </div>
      </header>

      {user && menuOpen ? (
        <div
          className="portal-drawer-backdrop"
          role="presentation"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      {user ? (
        <aside
          id={drawerId}
          className={`portal-drawer${menuOpen ? ' is-open' : ''}`}
          aria-hidden={!menuOpen}
          aria-label="Menu do portal"
        >
          <p className="portal-drawer__title">Navegacao</p>
          <nav className="portal-drawer__nav">
            {PORTAL_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`portal-drawer__link ${
                  isPortalNavActive(pathname, item) ? 'is-active' : ''
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {onLogout ? (
            <button
              type="button"
              className="btn btn-secondary portal-drawer__logout"
              onClick={onLogout}
            >
              Sair
            </button>
          ) : null}
        </aside>
      ) : null}

      <main id="portal-conteudo" className="portal-main">
        {children}
      </main>

      {user ? (
        <nav className="portal-bottom-nav" aria-label="Atalhos do portal">
          {primaryItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`portal-bottom-nav__item ${
                isPortalNavActive(pathname, item) ? 'is-active' : ''
              }`}
            >
              <span className="portal-bottom-nav__label">{item.label}</span>
            </Link>
          ))}
          <button
            type="button"
            className={`portal-bottom-nav__item ${moreActive || menuOpen ? 'is-active' : ''}`}
            aria-expanded={menuOpen}
            aria-controls={drawerId}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="portal-bottom-nav__label">Mais</span>
          </button>
        </nav>
      ) : null}
    </div>
  );
}
