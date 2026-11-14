/* Service worker mínimo: network-first para documentos,
   cache-first para el resto de assets estáticos. */
const CACHE = 'consumiciones-v6';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['./', './index.html'])),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isDocument =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  // Nunca interceptamos llamadas a APIs externas (Telegram / Supabase)
  if (url.origin !== self.location.origin) return;

  if (isDocument) {
    // Network-first para HTML/navegación
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() =>
          caches
            .match('./index.html')
            .then((r) => r || caches.match(request)),
        ),
    );
    return;
  }

  // Cache-first para assets (JS, CSS, plantilla, iconos)
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        }),
    ),
  );
});
