import 'server-only';
import { db } from '@/lib/db';
import { newId } from '@/lib/domain/ids';
import { nowIso } from '@/lib/domain/datetime';
import { ServiceError } from './accounts';
import type { WorkoutInput } from '@/lib/validation/schemas';
import type {
  ExerciseRow,
  SetType,
  WorkoutExerciseRow,
  WorkoutRow,
  WorkoutSetRow,
} from '@/types/db';

/** Entrenamiento con sus ejercicios y series ya ordenados. */
export interface WorkoutDetail {
  workout: WorkoutRow;
  exercises: {
    workoutExercise: WorkoutExerciseRow;
    exercise: ExerciseRow;
    sets: WorkoutSetRow[];
  }[];
  totalSets: number;
}

export async function listWorkouts(coachId: string): Promise<(WorkoutRow & { exerciseCount: number; setCount: number })[]> {
  const workouts = await db().select(
    'workouts',
    { coach_id: coachId },
    { orderBy: { column: 'updated_at', ascending: false } },
  );
  if (workouts.length === 0) return [];

  const workoutExercises = await db().select('workout_exercises', {
    workout_id: { in: workouts.map((w) => w.id) },
  });
  const sets = workoutExercises.length
    ? await db().select('workout_sets', { workout_exercise_id: { in: workoutExercises.map((we) => we.id) } })
    : [];

  return workouts.map((workout) => {
    const own = workoutExercises.filter((we) => we.workout_id === workout.id);
    const ownIds = new Set(own.map((we) => we.id));
    return {
      ...workout,
      exerciseCount: own.length,
      setCount: sets.filter((s) => ownIds.has(s.workout_exercise_id)).length,
    };
  });
}

export async function getWorkoutDetail(workoutId: string): Promise<WorkoutDetail | null> {
  const [workout] = await db().select('workouts', { id: workoutId });
  if (!workout) return null;

  const workoutExercises = await db().select(
    'workout_exercises',
    { workout_id: workoutId },
    { orderBy: { column: 'position' } },
  );
  const sets = workoutExercises.length
    ? await db().select('workout_sets', { workout_exercise_id: { in: workoutExercises.map((we) => we.id) } })
    : [];
  const exercises = workoutExercises.length
    ? await db().select('exercises', { id: { in: workoutExercises.map((we) => we.exercise_id) } })
    : [];
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));

  const rows = workoutExercises.flatMap((workoutExercise) => {
    const exercise = exerciseById.get(workoutExercise.exercise_id);
    if (!exercise) return [];
    return [
      {
        workoutExercise,
        exercise,
        sets: sets
          .filter((s) => s.workout_exercise_id === workoutExercise.id)
          .sort((a, b) => a.set_index - b.set_index),
      },
    ];
  });

  return { workout, exercises: rows, totalSets: rows.reduce((acc, row) => acc + row.sets.length, 0) };
}

export async function createWorkout(coachId: string, input: WorkoutInput): Promise<WorkoutRow> {
  const now = nowIso();
  const workout: WorkoutRow = {
    id: newId(),
    coach_id: coachId,
    name: input.name,
    description: input.description ?? null,
    goal: input.goal ?? null,
    estimated_minutes: input.estimatedMinutes ?? null,
    level: input.level ?? null,
    category: input.category ?? null,
    is_template: input.isTemplate,
    created_at: now,
    updated_at: now,
  };
  await db().insert('workouts', workout);
  return workout;
}

export async function updateWorkoutMeta(workoutId: string, input: Partial<WorkoutInput>): Promise<void> {
  const patch: Partial<WorkoutRow> = { updated_at: nowIso() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description ?? null;
  if (input.goal !== undefined) patch.goal = input.goal ?? null;
  if (input.estimatedMinutes !== undefined) patch.estimated_minutes = input.estimatedMinutes ?? null;
  if (input.level !== undefined) patch.level = input.level ?? null;
  if (input.category !== undefined) patch.category = input.category ?? null;
  if (input.isTemplate !== undefined) patch.is_template = input.isTemplate;
  await db().update('workouts', workoutId, patch);
}

async function touch(workoutId: string): Promise<void> {
  await db().update('workouts', workoutId, { updated_at: nowIso() });
}

/** Series por defecto al añadir un ejercicio: 3 × 10, ajustadas por tipo de métrica. */
function defaultSets(exercise: ExerciseRow): Omit<WorkoutSetRow, 'id' | 'workout_exercise_id'>[] {
  const base = {
    set_type: 'normal' as SetType,
    target_reps: null,
    target_weight_kg: null,
    target_percent_1rm: null,
    target_rpe: null,
    target_rir: null,
    target_duration_seconds: null,
    target_distance_m: null,
    target_velocity_ms: null,
    rest_seconds: null,
    notes: null,
  };
  const count = exercise.metric_type === 'cardio' ? 1 : 3;
  return Array.from({ length: count }, (_, index) => {
    const set = { ...base, set_index: index + 1 };
    switch (exercise.metric_type) {
      case 'strength':
        return { ...set, target_reps: 10, target_weight_kg: null };
      case 'bodyweight':
        return { ...set, target_reps: 8 };
      case 'jump':
        return { ...set, target_reps: 5 };
      case 'time':
        return { ...set, target_duration_seconds: 30 };
      case 'distance':
        return { ...set, target_distance_m: 20, target_reps: 1 };
      case 'cardio':
        return { ...set, target_duration_seconds: 600, target_distance_m: null };
      default:
        return set;
    }
  });
}

export async function addExerciseToWorkout(workoutId: string, exerciseId: string): Promise<string> {
  const [exercise] = await db().select('exercises', { id: exerciseId });
  if (!exercise) throw new ServiceError('Ejercicio no encontrado.');

  const existing = await db().select('workout_exercises', { workout_id: workoutId });
  const workoutExercise: WorkoutExerciseRow = {
    id: newId(),
    workout_id: workoutId,
    exercise_id: exerciseId,
    position: existing.length,
    superset_group: null,
    rest_seconds: exercise.metric_type === 'strength' ? 120 : 90,
    tempo: null,
    notes: null,
  };
  await db().insert('workout_exercises', workoutExercise);
  await db().insertMany(
    'workout_sets',
    defaultSets(exercise).map((set) => ({ ...set, id: newId(), workout_exercise_id: workoutExercise.id })),
  );
  await touch(workoutId);
  return workoutExercise.id;
}

export async function removeWorkoutExercise(workoutId: string, workoutExerciseId: string): Promise<void> {
  await db().removeWhere('workout_sets', { workout_exercise_id: workoutExerciseId });
  await db().remove('workout_exercises', workoutExerciseId);
  await reindexPositions(workoutId);
  await touch(workoutId);
}

export async function duplicateWorkoutExercise(workoutId: string, workoutExerciseId: string): Promise<void> {
  const [source] = await db().select('workout_exercises', { id: workoutExerciseId });
  if (!source) throw new ServiceError('Ejercicio no encontrado en la sesión.');
  const sets = await db().select('workout_sets', { workout_exercise_id: workoutExerciseId });

  const copy: WorkoutExerciseRow = { ...source, id: newId(), position: source.position + 1 };
  const siblings = await db().select('workout_exercises', { workout_id: workoutId });
  await Promise.all(
    siblings
      .filter((we) => we.position > source.position)
      .map((we) => db().update('workout_exercises', we.id, { position: we.position + 1 })),
  );
  await db().insert('workout_exercises', copy);
  await db().insertMany(
    'workout_sets',
    sets.map((set) => ({ ...set, id: newId(), workout_exercise_id: copy.id })),
  );
  await touch(workoutId);
}

/** Reordenar por drag & drop: se recibe el orden completo de ids (§80). */
export async function reorderWorkoutExercises(workoutId: string, orderedIds: string[]): Promise<void> {
  const rows = await db().select('workout_exercises', { workout_id: workoutId });
  const known = new Set(rows.map((row) => row.id));
  const clean = orderedIds.filter((id) => known.has(id));
  if (clean.length !== rows.length) throw new ServiceError('Orden no válido.');
  await Promise.all(clean.map((id, index) => db().update('workout_exercises', id, { position: index })));
  await touch(workoutId);
}

async function reindexPositions(workoutId: string): Promise<void> {
  const rows = await db().select('workout_exercises', { workout_id: workoutId }, { orderBy: { column: 'position' } });
  await Promise.all(rows.map((row, index) => db().update('workout_exercises', row.id, { position: index })));
}

export async function updateWorkoutExercise(
  workoutId: string,
  workoutExerciseId: string,
  patch: Partial<Pick<WorkoutExerciseRow, 'rest_seconds' | 'tempo' | 'notes' | 'superset_group'>>,
): Promise<void> {
  await db().update('workout_exercises', workoutExerciseId, patch);
  await touch(workoutId);
}

export async function replaceSets(
  workoutId: string,
  workoutExerciseId: string,
  sets: Omit<WorkoutSetRow, 'id' | 'workout_exercise_id'>[],
): Promise<void> {
  await db().removeWhere('workout_sets', { workout_exercise_id: workoutExerciseId });
  await db().insertMany(
    'workout_sets',
    sets.map((set, index) => ({
      ...set,
      set_index: index + 1,
      id: newId(),
      workout_exercise_id: workoutExerciseId,
    })),
  );
  await touch(workoutId);
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  const workoutExercises = await db().select('workout_exercises', { workout_id: workoutId });
  for (const we of workoutExercises) {
    await db().removeWhere('workout_sets', { workout_exercise_id: we.id });
  }
  await db().removeWhere('workout_exercises', { workout_id: workoutId });
  await db().remove('workouts', workoutId);
}

/** Copia completa de una sesión, incluidas series (§33). */
export async function duplicateWorkout(coachId: string, workoutId: string, nameSuffix = ' (copia)'): Promise<WorkoutRow> {
  const detail = await getWorkoutDetail(workoutId);
  if (!detail) throw new ServiceError('Entrenamiento no encontrado.');

  const now = nowIso();
  const copy: WorkoutRow = {
    ...detail.workout,
    id: newId(),
    coach_id: coachId,
    name: `${detail.workout.name}${nameSuffix}`,
    created_at: now,
    updated_at: now,
  };
  await db().insert('workouts', copy);

  for (const row of detail.exercises) {
    const workoutExercise: WorkoutExerciseRow = {
      ...row.workoutExercise,
      id: newId(),
      workout_id: copy.id,
    };
    await db().insert('workout_exercises', workoutExercise);
    await db().insertMany(
      'workout_sets',
      row.sets.map((set) => ({ ...set, id: newId(), workout_exercise_id: workoutExercise.id })),
    );
  }
  return copy;
}

/** Resumen legible de las series: «4 × 6 · 60 kg». */
export function describeSets(sets: WorkoutSetRow[]): string {
  if (sets.length === 0) return 'Sin series';
  const working = sets.filter((set) => set.set_type !== 'warmup');
  const reference = working.length > 0 ? working : sets;
  const uniform = reference.every(
    (set) =>
      set.target_reps === reference[0].target_reps && set.target_weight_kg === reference[0].target_weight_kg,
  );
  const first = reference[0];

  if (!uniform) return `${sets.length} series variables`;
  if (first.target_reps !== null) {
    const weight = first.target_weight_kg ? ` · ${first.target_weight_kg} kg` : '';
    return `${reference.length} × ${first.target_reps}${weight}`;
  }
  if (first.target_duration_seconds !== null) return `${reference.length} × ${first.target_duration_seconds}s`;
  if (first.target_distance_m !== null) return `${reference.length} × ${first.target_distance_m} m`;
  return `${reference.length} series`;
}
