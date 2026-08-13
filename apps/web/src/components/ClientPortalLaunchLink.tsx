'use client';

import type { ReactNode } from 'react';
import {
  CLIENT_PORTAL_LOGIN_FRESH,
  openClientPortalFresh,
} from '../lib/open-client-portal';

type Props = {
  className?: string;
  children: ReactNode;
};

/** Abre o Painel do Cliente em janela nova, sem usuario conectado. */
export function ClientPortalLaunchLink({ className, children }: Props) {
  return (
    <a
      href={CLIENT_PORTAL_LOGIN_FRESH}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        event.preventDefault();
        openClientPortalFresh();
      }}
    >
      {children}
    </a>
  );
}
