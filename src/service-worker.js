/* Generated with the complete asset list during the production build. */
const CACHE_PREFIX = 'humangpt-offline-';
const CACHE = CACHE_PREFIX + '__CACHE_VERSION__';
const PRECACHE = __PRECACHE_FILES__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  // Wait for existing tabs to close, or an explicit user-requested update.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Never cache drafts, API responses, or requests to third parties.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) return response;
      } catch { /* A cached app shell can still edit locally. */ }
      const cache = await caches.open(CACHE);
      return await cache.match('/index.html') || Response.error();
    })());
    return;
  }
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async (cache) => await cache.match(url.pathname) || fetch(request)));
  }
});
