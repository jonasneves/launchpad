// Combined Service Worker: Cross-Origin Isolation + Offline Cache
// Injects COOP/COEP headers so SharedArrayBuffer works on any static host.

const CACHE = 'launchpad-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Only inject headers for same-origin navigations and assets
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Clone and add cross-origin isolation headers
          const headers = new Headers(response.headers);
          headers.set('Cross-Origin-Opener-Policy', 'same-origin');
          headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Pass through cross-origin requests unchanged
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  }
});
