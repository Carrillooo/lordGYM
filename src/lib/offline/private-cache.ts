'use client';

/**
 * Borra la copia local de las pantallas privadas.
 *
 * El service worker guarda la última versión del modo entrenamiento para poder
 * abrirlo sin cobertura (ver `public/sw.js`). Esa copia tiene que irse cuando se
 * cierra sesión, y también al llegar a la pantalla de acceso: una sesión que
 * caduca sola no pasa por el botón de salir.
 */
export function clearPrivateCache(): void {
  navigator.serviceWorker?.ready
    .then((registration) => registration.active?.postMessage({ type: 'clear-private-cache' }))
    .catch(() => {
      // Sin service worker no hay nada guardado que borrar.
    });
}
