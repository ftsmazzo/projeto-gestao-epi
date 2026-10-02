'use client';

import type { AuthUser } from '@gestao-epi/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { PoweredBy } from './PoweredBy';
import { TenantBrand } from './TenantBrand';
import { IconHome, IconMenu, IconPackage } from './ui/NavIcons';

const NAV = [
  { href: '/distribuidora', label: 'Inicio', exact: true },
  { href: '/distribuidora/produtos', label: 'Produtos', exact: false },
  { href: '/distribuidora/saldo', label: 'Saldo', exact: false },
  { href: '/distribuidora/entrada', label: 'Entrada', exact: false },
  { href: '/distribuidora/saida', label: 'Saida', exact: false },
];

type DistributorShellProps = {
  children: ReactNode;
  user?: AuthUser | null;
  onLogout?: () => void;
};

export function DistributorShell({
  children,
  user,
  onLogout,
}: DistributorShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const current =
    NAV.find((item) =>
      item.exact ? pathname === item.href : pathname.startsWith(item.href),
    )?.label ?? (pathname.startsWith('/conta') ? 'Minha conta' : 'Distribuidora');

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="ops-shell">
      <a className="skip-link" href="#conteudo">
        Ir para o conteudo
      </a>
      <aside
        id="ops-nav"
        className={`ops-sidebar ${menuOpen ? 'is-open' : ''}`}
        aria-label="Navegacao da distribuidora"
      >
        <div className="ops-sidebar-brand">
          <TenantBrand
            name={user?.organization.name ?? 'Distribuidora'}
            hasLogo={user?.organization.hasLogo}
          />
        </div>
        <p className="ops-nav-label">Deposito</p>
        <nav className="ops-nav">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`ops-nav-link ${active ? 'is-active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <span className="ops-nav-link__row">
                  <span className="ops-nav-link__icon">
                    {item.href === '/distribuidora' ? <IconHome /> : <IconPackage />}
                  </span>
                  <span>{item.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="ops-sidebar-note">
          <p className="field-hint">
            Estoque da distribuidora. A nota de compra so entra depois da
            confirmacao.
          </p>
          <PoweredBy compact />
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
              aria-controls="ops-nav"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <IconMenu />
            </button>
            <span className="ops-topbar-crumb">{current}</span>
          </div>
          <div className="ops-topbar-right">
            {user ? (
              <div className="ops-user">
                <Link href="/conta" className="ops-user-name">
                  {user.name}
                </Link>
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
        <main id="conteudo" className="ops-main">
          {children}
        </main>
      </div>
    </div>
  );
}
