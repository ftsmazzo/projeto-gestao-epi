/* ProntEPI — service worker minimo (instalabilidade PWA).
 * Nao faz cache de API, auth nem assets dinamicos de biometria.
 */
const CACHE_NAME = 'prontepi-shell-v1';
const PRECACHE = ['/portal/login', '/brand/prontepi-icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Nunca interceptar API / uploads / streams.
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.includes('/vendor/') ||
    url.pathname.includes('/models/')
  ) {
    return;
  }

  // Network-first para navegacao; fallback so do shell de login.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match('/portal/login');
        return cached || Response.error();
      }),
    );
  }
});
