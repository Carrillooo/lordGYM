/*
 * Service worker de LORDGYM.
 *
 * Estrategia deliberadamente conservadora: los datos de entrenamiento son
 * sensibles y personales, así que NUNCA se cachean respuestas de navegación ni
 * de API. Sólo se precachea el esqueleto estático (iconos, manifiesto) y los
 * assets inmutables de Next, para que la app abra rápido y muestre una pantalla
 * de "sin conexión" en lugar del error del navegador.
 *
 * El registro de series funciona sin red gracias a la cola en localStorage
 * (`src/lib/offline/queue.ts`), no a este fichero.
 */

const VERSION = 'lordgym-v1';
const SHELL = ['/offline', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Assets inmutables de Next: cache-first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  // Navegación: siempre red; si falla, pantalla de sin conexión.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline')));
  }
});
