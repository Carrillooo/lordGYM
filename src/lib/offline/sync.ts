'use client';

import { finishSessionAction, logSetAction, saveExerciseCommentAction } from '@/lib/actions/player';
import { pending, pendingCount, remove, type OutboxEntry } from './outbox';

/**
 * Vaciado de la bandeja de salida.
 *
 * Vive fuera de la pantalla de entrenamiento a propósito: lo normal es que la
 * cobertura vuelva cuando el jugador ya ha salido del gimnasio y está mirando
 * otra cosa en la app. Si el vaciado dependiera de tener abierto el modo
 * entrenamiento, el entreno se quedaría sin enviar.
 *
 * Dos tipos de fallo, dos respuestas distintas:
 * - **Sin red** (la llamada lanza): se conserva y se corta el vaciado. No tiene
 *   sentido seguir intentándolo con las demás.
 * - **El servidor lo rechaza** (responde con error): se descarta. Reintentar no
 *   va a cambiar la respuesta, y una entrada envenenada bloquearía para siempre
 *   el cierre de la sesión, que va detrás.
 */

let running: Promise<number> | null = null;

/** Envía lo pendiente. Devuelve cuántas entradas quedan sin enviar. */
export function flushOutbox(): Promise<number> {
  // Una sola pasada a la vez: al recuperar la red se dispara desde varios
  // sitios (el evento `online`, el montaje del componente) y no queremos que
  // dos pasadas envíen la misma entrada.
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run(): Promise<number> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return pendingCount();

  for (const entry of pending()) {
    let rejected: string | null = null;
    try {
      rejected = await send(entry);
    } catch {
      // Sigue sin haber red.
      return pendingCount();
    }
    if (rejected) console.warn(`[lordgym] descartado del envío pendiente (${entry.kind}): ${rejected}`);
    remove(entry.key);
  }
  return pendingCount();
}

/** Devuelve el motivo del rechazo, o `null` si ha ido bien. */
async function send(entry: OutboxEntry): Promise<string | null> {
  if (entry.kind === 'set') {
    const result = await logSetAction(entry.payload);
    return result.status === 'error' ? (result.message ?? 'serie rechazada') : null;
  }
  if (entry.kind === 'comment') {
    const result = await saveExerciseCommentAction({
      sessionExerciseId: entry.payload.sessionExerciseId,
      comment: entry.payload.comment,
    });
    return result.status === 'error' ? (result.message ?? 'comentario rechazado') : null;
  }
  const result = await finishSessionAction(entry.payload);
  return result.status === 'error' ? (result.message ?? 'cierre rechazado') : null;
}
