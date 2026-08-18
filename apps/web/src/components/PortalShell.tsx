'use client';

import type { ClientPortalUser } from '@gestao-epi/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { isPortalNavActive, PORTAL_NAV } from '../lib/nav';
import { formatCnpj } from '../lib/cnpj';
import { PoweredBy } from './PoweredBy';
import {
  IconBuilding,
  IconChart,
  IconHome,
  IconMenu,
  IconMore,
  IconPackage,
  IconSettings,
  IconShield,
  IconTruck,
  IconUsers,
  IconWallet,
} from './ui/NavIcons';

type Props = {
  children: ReactNode;
  user?: ClientPortalUser | null;
  onLogout?: () => void;
  onSwitchCompany?: (servedClientId: string) => void | Promise<void>;
};

const BOTTOM_PRIMARY = [
  '/portal',
  '/portal/entregas',
  '/portal/estoque',
] as const;

function portalIcon(href: string) {
  switch (href) {
    case '/portal':
      return <IconHome />;
    case '/portal/entregas':
      return <IconTruck />;
    case '/portal/estoque':
      return <IconPackage />;
    case '/portal/validade':
      return <IconShield />;
    case '/portal/trabalhadores':
      return <IconUsers />;
    case '/portal/relatorios':
      return <IconChart />;
    case '/portal/estrutura':
      return <IconBuilding />;
    case '/portal/documentos-sst':
      return <IconShield />;
    case '/portal/custos':
      return <IconWallet />;
    case '/portal/conta':
      return <IconSettings />;
    default:
      return <IconMore />;
  }
}

function currentPortalLabel(pathname: string) {
  const match = PORTAL_NAV.find((item) => isPortalNavActive(pathname, item));
  return match?.label ?? 'Painel';
}

export function PortalShell({ children, user, onLogout, onSwitchCompany }: Props) {
  const pathname = usePathname();
  const drawerId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const clientName =
    user?.servedClient.tradeName || user?.servedClient.legalName || null;
  const accessible = user?.accessibleClients ?? [];
  const canSwitch = accessible.length > 1 && Boolean(onSwitchCompany);
  const groupedOptions = useMemo(() => {
    const buckets = new Map<string, typeof accessible>();
    for (const item of accessible) {
      const key = item.group?.name ?? '';
      const list = buckets.get(key) ?? [];
      list.push(item);
      buckets.set(key, list);
    }
    return [...buckets.entries()].sort(([a], [b]) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b, 'pt-BR');
    });
  }, [accessible]);

  const portalNav = useMemo(
    () =>
      PORTAL_NAV.filter(
        (item) =>
          item.href !== '/portal/documentos-sst' ||
          user?.servedClient.sstDocumentsEnabled === true,
      ),
    [user?.servedClient.sstDocumentsEnabled],
  );

  const primaryItems = portalNav.filter((item) =>
    (BOTTOM_PRIMARY as readonly string[]).includes(item.href),
  );
  const moreItems = portalNav.filter(
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

  const navLinks = (
    <>
      {portalNav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`portal-sidebar__link ${
            isPortalNavActive(pathname, item) ? 'is-active' : ''
          }`}
          onClick={() => setMenuOpen(false)}
        >
          <span className="portal-sidebar__icon" aria-hidden="true">
            {portalIcon(item.href)}
          </span>
          <span>{item.label}</span>
        </Link>
      ))}
    </>
  );

  return (
    <div className={`portal-shell${user ? ' portal-shell--authed' : ''}`}>
      <a className="skip-link" href="#portal-conteudo">
        Ir para o conteudo
      </a>

      {user ? (
        <aside className="portal-sidebar" aria-label="Navegacao do portal">
          <div className="portal-sidebar__brand">
            <Link href="/portal" className="portal-brand">
              <span className="portal-brand-kicker">ProntEPI</span>
              <strong className="portal-brand-name">
                {clientName ?? 'Painel do cliente'}
              </strong>
              {user?.accessibleClients?.some((c) => c.id === user.servedClient.id && c.group) ? (
                <span className="portal-brand-group">
                  {user.accessibleClients.find((c) => c.id === user.servedClient.id)?.group?.name}
                </span>
              ) : null}
            </Link>
          </div>
          <p className="ops-nav-label">Operacao</p>
          <nav className="portal-sidebar__nav">{navLinks}</nav>
          <div className="ops-sidebar-note">
            <PoweredBy compact />
          </div>
        </aside>
      ) : null}

      <div className="portal-content">
        <header className="portal-topbar">
          <div className="portal-topbar-brand">
            {user ? (
              <span className="ops-topbar-crumb">{currentPortalLabel(pathname)}</span>
            ) : (
              <Link href="/portal" className="portal-brand">
                <span className="portal-brand-kicker">ProntEPI</span>
                <strong className="portal-brand-name">Painel do cliente</strong>
              </Link>
            )}
          </div>
          <div className="portal-topbar-right">
            {canSwitch ? (
              <label className="portal-company-switch">
                <span className="portal-company-switch__label">Empresa</span>
                <select
                  value={user!.servedClient.id}
                  disabled={switching}
                  aria-label="Trocar CNPJ do grupo"
                  onChange={(e) => {
                    const next = e.target.value;
                    setSwitching(true);
                    void Promise.resolve(onSwitchCompany?.(next)).finally(
                      () => setSwitching(false),
                    );
                  }}
                >
                  {groupedOptions.map(([groupName, items]) =>
                    groupName ? (
                      <optgroup key={groupName} label={groupName}>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.tradeName || item.legalName} ·{' '}
                            {formatCnpj(item.cnpj)}
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.tradeName || item.legalName} ·{' '}
                          {formatCnpj(item.cnpj)}
                        </option>
                      ))
                    ),
                  )}
                </select>
              </label>
            ) : null}
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
                aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <IconMenu />
              </button>
            ) : null}
            {onLogout ? (
              <button
                type="button"
                className="btn btn-ghost portal-logout-desktop"
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
              {portalNav.map((item) => (
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

        <main id="portal-conteudo" className="portal-main ux-enter">
          {children}
        </main>
      </div>

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
              <span className="portal-bottom-nav__icon" aria-hidden="true">
                {portalIcon(item.href)}
              </span>
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
            <span className="portal-bottom-nav__icon" aria-hidden="true">
              <IconMore />
            </span>
            <span className="portal-bottom-nav__label">Mais</span>
          </button>
        </nav>
      ) : null}
    </div>
  );
}
