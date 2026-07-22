import type { ReactNode } from 'react';
import { Brand } from './Brand';

type AppShellProps = {
  children: ReactNode;
  headerActions?: ReactNode;
  brandHref?: string;
};

export function AppShell({
  children,
  headerActions,
  brandHref = '/',
}: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#conteudo">
        Ir para o conteudo
      </a>
      <header className="app-header">
        <Brand href={brandHref} />
        {headerActions ? (
          <div className="header-actions">{headerActions}</div>
        ) : null}
      </header>
      <main id="conteudo" className="app-main">
        {children}
      </main>
    </div>
  );
}
