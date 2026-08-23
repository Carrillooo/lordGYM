import 'server-only';
import { db } from '@/lib/db';
import { AuthorizationError, requireAthleteAction, requireCoachAction } from '@/lib/auth/guards';
import { extensionFor, type MediaScope, type MediaScopeKind } from './types';

/**
 * Quién puede subir qué.
 *
 * Se comprueba antes de tocar el almacén, y también antes de emitir el permiso
 * de subida directa a Vercel Blob: si no se validara ahí, cualquiera con sesión
 * podría pedir un token para colgar un fichero del ejercicio de otro.
 *
 * Devuelve además la ruta donde va el fichero. La calcula el servidor a partir
 * del ámbito ya verificado: el navegador nunca elige dónde escribe.
 */

const KINDS: MediaScopeKind[] = ['exercise-video', 'session-video'];

export function parseScope(raw: unknown): MediaScope {
  const value = typeof raw === 'string' ? safeParse(raw) : raw;
  const record = (value ?? {}) as Record<string, unknown>;
  const kind = record.kind;
  const targetId = record.targetId;
  if (typeof kind !== 'string' || !KINDS.includes(kind as MediaScopeKind)) {
    throw new AuthorizationError('Tipo de subida no válido.');
  }
  if (typeof targetId !== 'string' || targetId.length === 0 || targetId.length > 64) {
    throw new AuthorizationError('Destino de subida no válido.');
  }
  return { kind: kind as MediaScopeKind, targetId };
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Comprueba el permiso y devuelve la ruta del fichero, sin extensión. */
export async function authorizeUpload(scope: MediaScope): Promise<string> {
  if (scope.kind === 'exercise-video') {
    const { coach } = await requireCoachAction();
    const [exercise] = await db().select('exercises', { id: scope.targetId });
    if (!exercise) throw new AuthorizationError('Ejercicio no encontrado.');
    // Vale la biblioteca global y los ejercicios propios; los de otro
    // entrenador, no.
    if (exercise.owner_coach_id !== null && exercise.owner_coach_id !== coach.id) {
      throw new AuthorizationError('Ese ejercicio no es tuyo.');
    }
    return `exercises/${coach.id}/${exercise.id}`;
  }

  const { athlete } = await requireAthleteAction();
  const [sessionExercise] = await db().select('session_exercises', { id: scope.targetId });
  if (!sessionExercise) throw new AuthorizationError('Ejercicio de la sesión no encontrado.');
  const [session] = await db().select('workout_sessions', {
    id: sessionExercise.session_id,
    athlete_id: athlete.id,
  });
  if (!session) throw new AuthorizationError('Esa sesión no es tuya.');
  return `sessions/${athlete.id}/${sessionExercise.id}`;
}

/**
 * Ruta que el navegador debe pedir en la subida directa a Blob.
 *
 * No lleva el id del propietario porque el navegador tiene que poder calcularla
 * sin preguntar. No hace falta que lo lleve: el permiso ya se ha comprobado
 * contra el ámbito, y Blob añade un sufijo aleatorio, así que dos subidas nunca
 * se pisan aunque apunten al mismo ejercicio.
 */
export function blobPathnameFor(scope: MediaScope, contentType: string): string {
  return `${scope.kind}/${scope.targetId}.${extensionFor(contentType)}`;
}
