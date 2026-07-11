const CACHE_NAME = 'agent-office-shell-v1';
const STATIC_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/agent-office.svg',
  '/icons/agent-office-maskable.svg',
];
const NEVER_CACHE = ['/api/', '/health/', '/auth/', '/artifacts/', '/messages/', '/decisions/', '/alerts/'];
const CACHEABLE_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest', 'worker']);

self.addEventListener('install', (event) => {
  event.waitUntil(cacheInstallableShell());
});

async function cacheInstallableShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(STATIC_SHELL);
  const index = await cache.match('/index.html');
  if (!index) throw new Error('static shell index is unavailable');
  const markup = await index.text();
  const assets = [...markup.matchAll(/(?:src|href)="(\/assets\/[A-Za-z0-9._-]+)"/gu)]
    .map((match) => match[1])
    .filter((value) => typeof value === 'string');
  await cache.addAll([...new Set(assets)]);
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name.startsWith('agent-office-shell-') && name !== CACHE_NAME)
        .map((name) => caches.delete(name)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    NEVER_CACHE.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => response).catch(() => caches.match('/')
        .then((cached) => cached || Response.error())),
    );
    return;
  }
  if (!CACHEABLE_DESTINATIONS.has(request.destination)) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (!response.ok || (response.headers.get('Cache-Control') || '').toLowerCase().includes('no-store')) {
        return response;
      }
      const copy = response.clone();
      void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    })),
  );
});
