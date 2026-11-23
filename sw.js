const CACHE_NAME = 'mr-invoice-pro-v20';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json?v=18',
  '/1793842789444.jpg',
  '/1793842789444.jpg?v=18',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        CORE_ASSETS.map((url) => {
          const req = url.startsWith('http')
            ? new Request(url, { mode: 'cors' })
            : new Request(url, { cache: 'reload' });
          return cache.add(req);
        })
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (
    url.pathname === '/widget.js' ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('goatcounter.com') ||
    url.hostname.includes('zgo.at') ||
    url.hostname.includes('stripe.com')
  ) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200 && url.origin === self.location.origin) {
            const copyIndex = networkRes.clone();
            const copyRoot = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', copyIndex);
              cache.put('/', copyRoot);
            });
          }
          return networkRes;
        })
        .catch(() =>
          caches.match('/index.html')
            .then((r) => r || caches.match('/') || caches.match(req))
            .then((r) => r || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedRes) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkRes;
        })
        .catch(() => cachedRes || new Response('', { status: 503 }));

      return cachedRes || fetchPromise;
    })
  );
});
