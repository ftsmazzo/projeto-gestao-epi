import type { Metadata } from 'next';
import { APP_NAME } from '@gestao-epi/shared';

export const metadata: Metadata = {
  title: `Branding — ${APP_NAME}`,
  robots: { index: false, follow: false },
};

export default function BrandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
