'use client';

import { useEffect } from 'react';

/**
 * Mantiene la pantalla encendida mientras se entrena.
 *
 * Sin esto el móvil se apaga a los treinta segundos y hay que desbloquearlo
 * con las manos llenas de magnesio cada vez que toca apuntar una serie. Peor
 * aún: con la pantalla apagada el navegador congela los temporizadores, así
 * que el descanso deja de correr.
 *
 * `wakeLock` existe en Safari desde iOS 16.4 y en Chrome desde hace años.
 * Donde no esté, la app funciona igual: sólo se apaga la pantalla.
 *
 * El bloqueo se pierde al minimizar la app; por eso se vuelve a pedir cada vez
 * que la pantalla se hace visible.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function request(): Promise<void> {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        // El navegador puede negarlo (batería baja, permiso denegado). No es
        // un error del que haya que avisar: entrenar sigue funcionando.
      }
    }

    function onVisibilityChange(): void {
      if (document.visibilityState === 'visible' && !sentinel) void request();
    }

    void request();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
