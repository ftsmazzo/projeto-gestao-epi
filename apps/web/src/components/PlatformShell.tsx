'use client';

import type { PlatformAuthUser } from '@gestao-epi/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { Brand } from './Brand';

type Props = {
  children: ReactNode;
  user?: PlatformAuthUser | null;
  onLogout?: () => void;
};

export function PlatformShell({ children, user, onLogout }: Props) {
  const pathname = usePathname();
  return (
    <div className="platform-shell">
      <a className="skip-link" href="#conteudo">
        Ir para o conteudo
      </a>
      <header className="platform-topbar">
        <div className="platform-topbar__brand">
          <Brand href="/plataforma" compact />
          <span className="platform-topbar__meta">Plataforma</span>
        </div>
        {user ? (
          <nav className="platform-nav" aria-label="Navegacao da plataforma">
            <Link
              href="/plataforma"
              className={pathname === '/plataforma' ? 'is-active' : ''}
              aria-current={pathname === '/plataforma' ? 'page' : undefined}
            >
              Visao geral
            </Link>
            <Link
              href="/plataforma/suporte"
              className={
                pathname.startsWith('/plataforma/suporte') ? 'is-active' : ''
              }
              aria-current={
                pathname.startsWith('/plataforma/suporte') ? 'page' : undefined
              }
            >
              Central de Suporte
            </Link>
          </nav>
        ) : null}
        <div className="platform-topbar__right">
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
      <main id="conteudo" className="platform-main ux-enter">
        {children}
      </main>
    </div>
  );
}
