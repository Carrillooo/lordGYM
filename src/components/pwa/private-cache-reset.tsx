'use client';

import { useEffect } from 'react';
import { clearPrivateCache } from '@/lib/offline/private-cache';

/**
 * Borra del móvil la copia de las pantallas privadas al llegar al acceso.
 *
 * El camino normal es el botón de salir, que ya la borra. Esto cubre el otro:
 * la sesión que caduca sola y deja al jugador en la pantalla de acceso sin
 * haber pulsado nada.
 */
export function PrivateCacheReset() {
  useEffect(() => clearPrivateCache(), []);

  return null;
}
