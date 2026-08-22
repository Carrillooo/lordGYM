import 'server-only';
import { db } from '@/lib/db';
import { newId } from '@/lib/domain/ids';
import { nowIso } from '@/lib/domain/datetime';
import type { ExerciseInput } from '@/lib/validation/schemas';
import { normalizeText } from '@/lib/text';
import type { ExerciseCategory, ExerciseRow } from '@/types/db';

/** Biblioteca visible por un entrenador: los globales + los suyos. */
export async function listExercisesForCoach(coachId: string): Promise<ExerciseRow[]> {
  const rows = await db().select('exercises', { owner_coach_id: { in: [null, coachId] } });
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function listExercisesByIds(ids: string[]): Promise<Map<string, ExerciseRow>> {
  if (ids.length === 0) return new Map();
  const rows = await db().select('exercises', { id: { in: ids } });
  return new Map(rows.map((row) => [row.id, row]));
}

export async function getExercise(id: string): Promise<ExerciseRow | null> {
  const [row] = await db().select('exercises', { id });
  return row ?? null;
}

export async function createExercise(coachId: string, input: ExerciseInput): Promise<ExerciseRow> {
  const row: ExerciseRow = {
    id: newId(),
    owner_coach_id: coachId,
    name: input.name,
    category: input.category as ExerciseCategory,
    metric_type: input.metricType,
    movement_type: input.movementType ?? null,
    muscles: input.muscles,
    equipment: input.equipment,
    description: input.description ?? null,
    technique: input.technique ?? null,
    video_url: input.videoUrl ?? null,
    image_url: input.imageUrl ?? null,
    created_at: nowIso(),
  };
  await db().insert('exercises', row);
  return row;
}

export async function updateExercise(id: string, input: ExerciseInput): Promise<void> {
  await db().update('exercises', id, {
    name: input.name,
    category: input.category as ExerciseCategory,
    metric_type: input.metricType,
    movement_type: input.movementType ?? null,
    muscles: input.muscles,
    equipment: input.equipment,
    description: input.description ?? null,
    technique: input.technique ?? null,
    video_url: input.videoUrl ?? null,
    image_url: input.imageUrl ?? null,
  });
}

export async function deleteExercise(id: string): Promise<void> {
  await db().remove('exercises', id);
}

/** Búsqueda simple sin acentos para el selector del constructor (§53). */
export function searchExercises(exercises: ExerciseRow[], query: string): ExerciseRow[] {
  const needle = normalizeText(query);
  if (!needle) return exercises;
  return exercises.filter(
    (exercise) =>
      normalizeText(exercise.name).includes(needle) ||
      normalizeText(exercise.category).includes(needle) ||
      exercise.muscles.some((muscle) => normalizeText(muscle).includes(needle)),
  );
}

export { normalizeText as normalize } from '@/lib/text';
