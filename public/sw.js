/*
 * Service worker de LORDGYM.
 *
 * Estrategia deliberadamente conservadora: los datos de entrenamiento son
 * sensibles y personales, así que NUNCA se cachean respuestas de API ni
 * pantallas del entrenador. Se precachea el esqueleto estático (iconos,
 * manifiesto) y los assets inmutables de Next, para que la app abra rápido.
 *
 * Con una excepción, y muy a propósito: la pantalla del modo entrenamiento.
 * Muchos gimnasios están en un sótano y no hay cobertura; sin esto, el jugador
 * que llega al gimnasio sin red no puede ni abrir su rutina, por mucho que la
 * bandeja de salida sepa guardar lo que apunte. Guardar esa página es lo que
 * convierte «funciona sin conexión» en verdad.
 *
 * Esa copia va en su propia caché, separada de la estática, y se borra al
 * llegar a la pantalla de acceso: en un móvil compartido, el siguiente en
 * entrar no puede encontrarse el entreno del anterior.
 */

const VERSION = 'lordgym-v2';
const PRIVATE_CACHE = 'lordgym-private-v2';
const SHELL = ['/offline', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png'];

/** Rutas cuya última versión se guarda para poder abrirlas sin red. */
function isTrainingScreen(url) {
  return url.pathname.startsWith('/player/workout/');
}

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
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== VERSION && key !== PRIVATE_CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// La pantalla de acceso pide que se borre lo privado: ver `private-cache-reset`.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'clear-private-cache') {
    event.waitUntil(caches.delete(PRIVATE_CACHE));
  }
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

  if (request.mode !== 'navigate') return;

  // Modo entrenamiento: la red manda, pero se guarda una copia por si mañana
  // no hay. Sólo se guarda una respuesta correcta: una redirección al login o
  // un error servido desde la caché sería peor que no tener nada.
  if (isTrainingScreen(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !response.redirected) {
            const copy = response.clone();
            caches.open(PRIVATE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/offline'))),
    );
    return;
  }

  // Resto de navegación: siempre red; si falla, pantalla de sin conexión.
  event.respondWith(fetch(request).catch(() => caches.match('/offline')));
});
