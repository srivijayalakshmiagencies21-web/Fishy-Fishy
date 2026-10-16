const CACHE_NAME = 'fishy-fishy-pwa-v4';
// The static launch splash; served from cache so it paints without waiting on the network.
const LAUNCH_URL = '/';

const offline = () =>
  new Response('You are offline. Reconnect and try again.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(LAUNCH_URL))
      .catch(() => {})
  );
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

// Only page navigations are handled; every other request (RSC, prefetch, assets, Supabase) goes
// straight to the network without a service-worker hop.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;

  const network = Promise.resolve(event.preloadResponse).then((preloaded) => preloaded || fetch(request));

  if (new URL(request.url).pathname === LAUNCH_URL) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const refresh = network.then((response) => {
          if (response.ok) cache.put(LAUNCH_URL, response.clone());
          return response;
        });
        const cached = await cache.match(LAUNCH_URL, { ignoreSearch: true });
        if (cached) {
          event.waitUntil(refresh.catch(() => {}));
          return cached;
        }
        return refresh.catch(offline);
      })
    );
    return;
  }

  event.respondWith(network.catch(offline));
});
