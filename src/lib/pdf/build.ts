import 'server-only';
import type { ExerciseRow, SessionSetRow, WorkoutSetRow } from '@/types/db';
import { getWorkoutDetail } from '@/lib/services/workouts';
import { getSessionDetail } from '@/lib/services/sessions';
import { formatLongDate } from '@/lib/domain/datetime';
import { normalizeText } from '@/lib/text';
import { buildWorkoutPdf, type PdfExercise, type PdfSet } from './workout-pdf';

/**
 * Traduce lo que hay en la base al documento imprimible.
 *
 * Hay dos orígenes y no se mezclan (§105): la **plantilla** que ve el entrenador
 * y la **sesión** del jugador. La plantilla sale siempre con casillas en blanco;
 * la sesión, con los resultados si ya está cerrada.
 */

function formatTarget(set: { target_reps: number | null; target_weight_kg: number | null }, extra?: {
  duration?: number | null;
  distance?: number | null;
}): string {
  const parts: string[] = [];
  if (set.target_reps !== null) parts.push(`${set.target_reps} reps`);
  if (set.target_weight_kg !== null) parts.push(`${set.target_weight_kg} kg`);
  if (extra?.duration) parts.push(`${extra.duration} s`);
  if (extra?.distance) parts.push(`${extra.distance} m`);
  return parts.length > 0 ? parts.join(' x ') : 'Libre';
}

function formatActual(set: SessionSetRow): string {
  if (set.status === 'skipped') return 'Saltada';
  const parts: string[] = [];
  if (set.actual_reps !== null) parts.push(`${set.actual_reps} reps`);
  if (set.actual_weight_kg !== null) parts.push(`${set.actual_weight_kg} kg`);
  if (set.actual_duration_seconds !== null) parts.push(`${set.actual_duration_seconds} s`);
  if (set.actual_distance_m !== null) parts.push(`${set.actual_distance_m} m`);
  return parts.length > 0 ? parts.join(' x ') : '-';
}

function label(set: { set_index: number }): string {
  return String(set.set_index);
}

function exerciseBlock(
  exercise: ExerciseRow,
  notes: string | null,
  sets: PdfSet[],
): PdfExercise {
  return {
    name: exercise.name,
    figureKey: exercise.figure_key,
    category: exercise.category,
    technique: exercise.technique,
    notes,
    sets,
  };
}

/** PDF de la plantilla del entrenador: siempre en blanco para rellenar. */
export async function workoutTemplatePdf(
  workoutId: string,
  context: { coachName: string },
): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const detail = await getWorkoutDetail(workoutId);
  if (!detail) return null;

  const tags = [
    detail.workout.category,
    detail.workout.goal,
    detail.workout.level,
    detail.workout.estimated_minutes ? `${detail.workout.estimated_minutes} min` : null,
    `${detail.totalSets} series`,
  ].filter((value): value is string => Boolean(value));

  const bytes = await buildWorkoutPdf({
    title: detail.workout.name,
    meta: [context.coachName],
    tags,
    notes: detail.workout.description,
    withResults: false,
    exercises: detail.exercises.map((row) =>
      exerciseBlock(
        row.exercise,
        row.workoutExercise.notes,
        row.sets.map(
          (set: WorkoutSetRow): PdfSet => ({
            label: label(set),
            target: formatTarget(set, {
              duration: set.target_duration_seconds,
              distance: set.target_distance_m,
            }),
            restSeconds: set.rest_seconds ?? row.workoutExercise.rest_seconds,
          }),
        ),
      ),
    ),
  });

  return { bytes, filename: filenameFor(detail.workout.name) };
}

/**
 * PDF de una sesión que el jugador todavía no ha empezado: la rutina que le ha
 * puesto el entrenador, en blanco, para llevarla impresa al gimnasio.
 */
export async function assignmentPdf(
  workoutId: string,
  context: { athleteName: string; coachName: string | null; date: string; note: string | null },
): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const detail = await getWorkoutDetail(workoutId);
  if (!detail) return null;

  const meta = [context.athleteName];
  if (context.coachName) meta.push(context.coachName);
  meta.push(formatLongDate(context.date));

  const tags = [
    detail.workout.category,
    detail.workout.goal,
    detail.workout.level,
    detail.workout.estimated_minutes ? `${detail.workout.estimated_minutes} min` : null,
    `${detail.totalSets} series`,
  ].filter((value): value is string => Boolean(value));

  const bytes = await buildWorkoutPdf({
    title: detail.workout.name,
    meta,
    tags,
    // La nota del entrenador para esta asignación manda sobre la descripción.
    notes: context.note ?? detail.workout.description,
    withResults: false,
    exercises: detail.exercises.map((row) =>
      exerciseBlock(
        row.exercise,
        row.workoutExercise.notes,
        row.sets.map(
          (set: WorkoutSetRow): PdfSet => ({
            label: label(set),
            target: formatTarget(set, {
              duration: set.target_duration_seconds,
              distance: set.target_distance_m,
            }),
            restSeconds: set.rest_seconds ?? row.workoutExercise.rest_seconds,
          }),
        ),
      ),
    ),
  });

  return { bytes, filename: filenameFor(`${detail.workout.name} ${context.date}`) };
}

/** PDF de la sesión del jugador: con resultados si ya la ha cerrado. */
export async function sessionPdf(
  sessionId: string,
  context: { athleteName: string; coachName: string | null },
): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const detail = await getSessionDetail(sessionId);
  if (!detail) return null;

  const done = detail.session.status === 'completed';
  const meta = [context.athleteName];
  if (context.coachName) meta.push(context.coachName);
  meta.push(formatLongDate(detail.session.started_at.slice(0, 10)));

  const tags: string[] = [`${detail.totalSets} series`];
  if (done) {
    tags.push(`${detail.completedSets} completadas`);
    if (detail.session.total_volume_kg) tags.push(`${Math.round(detail.session.total_volume_kg)} kg de volumen`);
    if (detail.session.session_rpe !== null) tags.push(`RPE ${detail.session.session_rpe}`);
  }

  const bytes = await buildWorkoutPdf({
    title: detail.workoutName,
    meta,
    tags,
    notes: detail.session.comment,
    withResults: done,
    exercises: detail.exercises.map((row) =>
      exerciseBlock(
        row.exercise,
        row.sessionExercise.notes,
        row.sets.map(
          (set): PdfSet => ({
            label: label(set),
            target: formatTarget(set),
            restSeconds: row.sessionExercise.rest_seconds,
            actual: done ? formatActual(set) : null,
            actualRpe: set.rpe,
          }),
        ),
      ),
    ),
  });

  return { bytes, filename: filenameFor(`${detail.workoutName} ${detail.session.started_at.slice(0, 10)}`) };
}

/** Nombre de fichero seguro: sin acentos ni espacios, que viaja bien por HTTP. */
function filenameFor(name: string): string {
  const slug = normalizeText(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `lordgym-${slug || 'entrenamiento'}.pdf`;
}
