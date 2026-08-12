'use client';

import type { PlatformAuthUser } from '@gestao-epi/shared';
import { ReactNode } from 'react';
import { Brand } from './Brand';

type Props = {
  children: ReactNode;
  user?: PlatformAuthUser | null;
  onLogout?: () => void;
};

export function PlatformShell({ children, user, onLogout }: Props) {
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
