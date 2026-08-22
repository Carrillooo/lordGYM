'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker que da soporte offline (§64, §65).
 * Sólo en producción: en desarrollo interfiere con el hot-reload.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Sin service worker la app sigue funcionando online.
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
