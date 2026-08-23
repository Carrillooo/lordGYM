'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Si hay conexión, según el navegador.
 *
 * `navigator.onLine` sólo sabe si hay una interfaz de red levantada, no si el
 * servidor contesta: puede decir que sí con el wifi del gimnasio conectado pero
 * sin salida a internet. Sirve para el aviso de la pantalla; quien manda de
 * verdad sobre si algo se ha guardado es la bandeja de salida.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnline(): boolean {
  const getSnapshot = useCallback(() => navigator.onLine !== false, []);
  // En el servidor se asume que hay conexión: es lo que evita que el aviso de
  // «sin conexión» parpadee en el HTML inicial.
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
