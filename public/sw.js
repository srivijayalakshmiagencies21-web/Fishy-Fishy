const CACHE_NAME = 'fishy-fishy-pwa-v5';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
      .then(() => self.registration.navigationPreload?.enable())
      .then(() => self.clients.claim())
  );
});

// Only page navigations get an offline fallback; every other request (RSC, prefetch, assets,
// Supabase) goes straight to the network without a service-worker hop. Navigation preload starts
// the request while the worker boots, so it doesn't add to launch time.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  event.respondWith(
    Promise.resolve(event.preloadResponse)
      .then((preloaded) => preloaded || fetch(request))
      .catch(
        () =>
          new Response('You are offline. Reconnect and try again.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
      )
  );
});
