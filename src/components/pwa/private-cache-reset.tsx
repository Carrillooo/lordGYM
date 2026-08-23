'use client';

import { useEffect } from 'react';

/**
 * Borra del móvil la copia de las pantallas privadas.
 *
 * Se monta en la pantalla de acceso, que es por donde se pasa tanto al cerrar
 * sesión como al entrar por primera vez. El service worker guarda la última
 * versión del modo entrenamiento para poder abrirlo sin cobertura; esa copia no
 * puede sobrevivir a un cierre de sesión en un móvil compartido.
 */
export function PrivateCacheReset() {
  useEffect(() => {
    navigator.serviceWorker?.ready
      .then((registration) => registration.active?.postMessage({ type: 'clear-private-cache' }))
      .catch(() => {
        // Sin service worker no hay nada guardado que borrar.
      });
  }, []);

  return null;
}
