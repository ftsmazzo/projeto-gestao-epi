import type { Metadata, Viewport } from 'next';
import { APP_NAME, APP_PITCH, APP_TAGLINE } from '@gestao-epi/shared';
import { ServiceWorkerRegister } from '../components/ServiceWorkerRegister';
import './globals.css';
import './adminlte-skin.css';

// Fontes self-hosted via npm (sem fetch no Google no `next build` / Docker).
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/500.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-sans-3/700.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_PITCH,
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/brand/prontepi-mark.svg', type: 'image/svg+xml' },
      { url: '/brand/prontepi-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/prontepi-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/brand/prontepi-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#343a40' },
    { media: '(prefers-color-scheme: dark)', color: '#343a40' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
