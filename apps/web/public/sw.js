/* ProntEPI — service worker minimo (instalabilidade PWA + notificacoes).
 * Nao faz cache de API, auth nem assets dinamicos de biometria.
 */
const CACHE_NAME = 'prontepi-shell-v2';
const PRECACHE = [
  '/portal/login',
  '/login',
  '/brand/prontepi-icon-192.png',
];

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

  // Nao interceptar API / uploads / streams.
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.includes('/vendor/') ||
    url.pathname.includes('/models/')
  ) {
    return;
  }

  // Network-first para navegacao; fallback do shell de login.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const isPortal = url.pathname.startsWith('/portal');
        const cached = await caches.match(
          isPortal ? '/portal/login' : '/login',
        );
        return cached || Response.error();
      }),
    );
  }
});

self.addEventListener('push', (event) => {
  let title = 'ProntEPI';
  let body = 'Ha uma atualizacao no painel.';
  let url = '/dashboard';
  try {
    const data = event.data ? event.data.json() : {};
    if (typeof data.title === 'string') title = data.title;
    if (typeof data.body === 'string') body = data.body;
    if (typeof data.url === 'string') url = data.url;
  } catch {
    const text = event.data ? event.data.text() : '';
    if (text) body = text;
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/brand/prontepi-icon-192.png',
      badge: '/brand/prontepi-icon-192.png',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
        return undefined;
      }),
  );
});
