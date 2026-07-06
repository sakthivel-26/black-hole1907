const CACHE_NAME = 'black-hole-v2';
const URLS_TO_CACHE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
          return Promise.resolve();
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only apply custom caching to same-origin resources
  if (event.request.url.startsWith(self.location.origin)) {
    // Exclude API calls or streaming endpoints from sw caching
    if (event.request.url.includes('/api/') || event.request.url.includes('/yt-search')) {
      return;
    }
    
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // Fallback for document navigation if offline
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
          });
        })
    );
  }
});
