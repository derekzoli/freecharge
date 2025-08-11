/* FreeCharge service worker: cache UI for offline use */
const CACHE_NAME = 'freecharge-ui-v1';
const UI_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(UI_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Bypass caching for dynamic API requests
  const isDynamicAPI = url.hostname.includes('overpass-api.de') || url.hostname.includes('api.openchargemap.io');
  // Determine tile requests
  const isTiles = /tile\.openstreetmap\.org/.test(url.hostname);
  if (isDynamicAPI) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('{"error":"offline"}', {status:503}))
    );
    return;
  }
  if (isTiles) {
    event.respondWith(
      caches.open('freecharge-tiles').then(cache =>
        cache.match(event.request).then(hit => {
          const fetchPromise = fetch(event.request).then(resp => {
            cache.put(event.request, resp.clone());
            return resp;
          }).catch(() => hit || Response.error());
          return hit || fetchPromise;
        })
      )
    );
    return;
  }
  // Otherwise, use cache-first for UI assets
  event.respondWith(
    caches.match(event.request).then(hit => hit || fetch(event.request))
  );
});