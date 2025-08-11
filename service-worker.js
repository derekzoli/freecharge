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
  // Only handle requests for our own origin. For external resources (e.g., Leaflet, map tiles, other sites),
  // bypass the cache logic entirely. This prevents the service worker from hijacking
  // navigations to other domains and ensures external resources are fetched normally.
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) {
    // Passthrough: let the browser handle cross-origin fetches and navigations
    return;
  }

  // Bypass caching for dynamic API requests (Overpass/OCM)
  const isDynamicAPI = url.hostname.includes('overpass-api.de') || url.hostname.includes('api.openchargemap.io');
  // Determine OSM tile requests (for our tile caching layer)
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

  // Otherwise (same-origin UI assets), use cache-first strategy
  event.respondWith(
    caches.match(event.request).then(hit => hit || fetch(event.request))
  );
});