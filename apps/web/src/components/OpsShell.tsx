'use client';

import type { AuthUser } from '@gestao-epi/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { OPS_NAV } from '../lib/nav';
import { PoweredBy } from './PoweredBy';
import { TenantBrand } from './TenantBrand';
import {
  IconBuilding,
  IconHome,
  IconMenu,
  IconPackage,
  IconSettings,
  IconShield,
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
    case '/epi-needs':
      return <IconShield />;
    case '/epis':
      return <IconPackage />;
    default:
      return <IconHome />;
  }
}

function currentNavLabel(pathname: string) {
  const match = OPS_NAV.find(
    (item) =>
      pathname === item.href ||
      (item.href !== '/dashboard' && pathname.startsWith(item.href)),
  );
  if (pathname === '/conta' || pathname.startsWith('/conta')) {
    return 'Minha conta';
  }
  return match?.label ?? 'Consultoria';
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

      <aside
        id="ops-nav"
        className={`ops-sidebar ${menuOpen ? 'is-open' : ''}`}
        aria-label="Navegacao da consultoria"
      >
        <div className="ops-sidebar-brand">
          {user ? (
            <TenantBrand
              name={user.organization.name}
              hasLogo={user.organization.hasLogo}
            />
          ) : (
            <TenantBrand name="Consultoria" />
          )}
        </div>
        <p className="ops-nav-label">Principal</p>
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
            <span className="ops-topbar-crumb">{currentNavLabel(pathname)}</span>
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
            {user ? (
              <Link
                href={user.mustChangePassword ? '/conta?obrigatorio=1' : '/conta'}
                className="btn btn-ghost"
              >
                {user.mustChangePassword ? 'Trocar senha' : 'Minha conta'}
              </Link>
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
