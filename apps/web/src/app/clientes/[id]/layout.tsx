'use client';

import { ReactNode } from 'react';
import { RequireAuth } from '../../../components/RequireAuth';
import { ClientWorkspaceShell } from '../../../components/ClientWorkspaceShell';

export default function ClienteWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RequireAuth>
      {() => <ClientWorkspaceShell>{children}</ClientWorkspaceShell>}
    </RequireAuth>
  );
}
