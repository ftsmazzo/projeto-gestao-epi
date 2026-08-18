import { APP_NAME, APP_PITCH, APP_TAGLINE } from '@gestao-epi/shared';

export function GET() {
  const body = {
    id: '/consultoria',
    name: `${APP_NAME} — Consultoria`,
    short_name: `${APP_NAME} Gestao`,
    description: `${APP_TAGLINE}. ${APP_PITCH}`,
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#e9eef3',
    theme_color: '#343a40',
    lang: 'pt-BR',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/brand/prontepi-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/prontepi-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/prontepi-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
