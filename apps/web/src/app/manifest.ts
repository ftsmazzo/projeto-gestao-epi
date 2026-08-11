import type { MetadataRoute } from 'next';
import { APP_NAME, APP_PITCH, APP_TAGLINE } from '@gestao-epi/shared';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — Painel do Cliente`,
    short_name: APP_NAME,
    description: `${APP_TAGLINE}. ${APP_PITCH}`,
    start_url: '/portal/login',
    scope: '/portal',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#e9eef3',
    theme_color: '#0f766e',
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
}
