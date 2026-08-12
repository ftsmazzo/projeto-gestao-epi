import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Source_Sans_3 } from 'next/font/google';
import { APP_NAME, APP_PITCH, APP_TAGLINE } from '@gestao-epi/shared';
import { ServiceWorkerRegister } from '../components/ServiceWorkerRegister';
import './globals.css';
import './adminlte-skin.css';

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-source',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
});

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
    <html lang="pt-BR" className={`${sourceSans.variable} ${jetbrains.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
