import 'server-only';
import { db } from '@/lib/db';
import { newId } from '@/lib/domain/ids';
import { nowIso } from '@/lib/domain/datetime';
import type { ExerciseRow } from '@/types/db';

/**
 * Vídeos de técnica que el entrenador cuelga de los ejercicios.
 *
 * La biblioteca es compartida (los 932 ejercicios globales no son de nadie), así
 * que el vídeo se guarda aparte, por entrenador. Al mostrarlo manda el suyo; si
 * no ha subido ninguno, se cae al enlace que trajera el propio ejercicio.
 */

/** Vídeo efectivo de un ejercicio para un entrenador concreto. */
export async function videoUrlFor(exercise: ExerciseRow, coachId: string | null): Promise<string | null> {
  if (!coachId) return exercise.video_url;
  const [row] = await db().select('exercise_media', { coach_id: coachId, exercise_id: exercise.id });
  return row?.video_url ?? exercise.video_url;
}

/** Lo mismo para una lista, en una sola consulta. */
export async function videoUrlsFor(
  exerciseIds: string[],
  coachId: string | null,
): Promise<Map<string, string>> {
  if (!coachId || exerciseIds.length === 0) return new Map();
  const rows = await db().select('exercise_media', {
    coach_id: coachId,
    exercise_id: { in: exerciseIds },
  });
  const map = new Map<string, string>();
  for (const row of rows) if (row.video_url) map.set(row.exercise_id, row.video_url);
  return map;
}

/**
 * Guarda (o borra, con `null`) el vídeo del entrenador para un ejercicio.
 * Sin `update` por clave compuesta en el driver: se borra la fila anterior y se
 * escribe la nueva, que además deja `updated_at` correcto sin casos especiales.
 */
export async function setExerciseVideo(
  coachId: string,
  exerciseId: string,
  videoUrl: string | null,
): Promise<void> {
  const now = nowIso();
  await db().removeWhere('exercise_media', { coach_id: coachId, exercise_id: exerciseId });
  if (!videoUrl) return;
  await db().insert('exercise_media', {
    id: newId(),
    coach_id: coachId,
    exercise_id: exerciseId,
    video_url: videoUrl,
    created_at: now,
    updated_at: now,
  });
}
