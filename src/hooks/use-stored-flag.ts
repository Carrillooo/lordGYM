'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Preferencia de sí/no que sobrevive a cerrar la app.
 *
 * Va contra `localStorage` a través de `useSyncExternalStore` y no con un
 * efecto que llame a `setState`: en el servidor no existe `localStorage`, y
 * leerlo durante el render haría que el HTML del servidor y el del navegador no
 * coincidan. Así React sabe que el valor viene de fuera y lo lee cuando toca.
 *
 */

const listeners = new Set<() => void>();

/**
 * Copia en memoria. Cumple dos funciones: `useSyncExternalStore` llama a
 * `getSnapshot` en cada render y no conviene ir al disco cada vez, y la
 * preferencia sigue funcionando durante la sesión aunque el almacenamiento esté
 * bloqueado (navegación privada), en cuyo caso simplemente no se recuerda.
 */
const cache = new Map<string, boolean>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Y también si la preferencia cambia en otra pestaña: el evento `storage`
  // sólo lo reciben las demás, nunca la que ha escrito.
  const onExternalChange = (event: StorageEvent) => {
    if (event.key) cache.delete(event.key);
    else cache.clear();
    onChange();
  };
  window.addEventListener('storage', onExternalChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onExternalChange);
  };
}

function read(key: string, fallback: boolean): boolean {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  let value = fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) value = stored === '1';
  } catch {
    // Almacenamiento bloqueado: vale el valor por defecto.
  }
  cache.set(key, value);
  return value;
}

export function useStoredFlag(key: string, fallback = false): [boolean, (value: boolean) => void] {
  const getSnapshot = useCallback(() => read(key, fallback), [key, fallback]);
  const value = useSyncExternalStore(subscribe, getSnapshot, () => fallback);

  const update = useCallback((next: boolean) => {
    cache.set(key, next);
    try {
      window.localStorage.setItem(key, next ? '1' : '0');
    } catch {
      // Sin almacenamiento la preferencia vale para esta sesión y ya.
    }
    notify();
  }, [key]);

  return [value, update];
}
