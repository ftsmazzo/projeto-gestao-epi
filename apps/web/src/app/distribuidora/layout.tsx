'use client';

import { RequireDistributor } from '../../components/RequireDistributor';

export default function DistribuidoraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireDistributor>{children}</RequireDistributor>;
}
