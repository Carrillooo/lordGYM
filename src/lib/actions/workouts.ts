'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assertCoachOwnsWorkout, requireCoachAction } from '@/lib/auth/guards';
import {
  addExerciseToWorkout,
  createWorkout,
  deleteWorkout,
  duplicateWorkout,
  duplicateWorkoutExercise,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  replaceSets,
  updateWorkoutExercise,
  updateWorkoutMeta,
} from '@/lib/services/workouts';
import { assignWorkout, deleteAssignment, duplicateWeek, moveAssignment } from '@/lib/services/assignments';
import { assignSchema, setConfigSchema, workoutSchema } from '@/lib/validation/schemas';
import { errorState, fromException, successState, zodFieldErrors, type ActionState } from './state';
import { z } from 'zod';
import type { WorkoutSetRow } from '@/types/db';

export async function createWorkoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let workoutId: string;
  try {
    const { coach } = await requireCoachAction();
    const parsed = workoutSchema.safeParse({
      name: formData.get('name'),
      description: formData.get('description'),
      goal: formData.get('goal'),
      estimatedMinutes: formData.get('estimatedMinutes'),
      level: formData.get('level'),
      category: formData.get('category'),
      isTemplate: formData.get('isTemplate') === 'on',
    });
    if (!parsed.success) return errorState('Revisa los datos de la sesión.', zodFieldErrors(parsed.error));
    const workout = await createWorkout(coach.id, parsed.data);
    workoutId = workout.id;
  } catch (error) {
    return fromException(error);
  }
  revalidatePath('/coach/workouts');
  redirect(`/coach/workouts/${workoutId}`);
}

export async function updateWorkoutMetaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    const workoutId = String(formData.get('workoutId') ?? '');
    await assertCoachOwnsWorkout(coach.id, workoutId);
    const parsed = workoutSchema.partial().safeParse({
      name: formData.get('name') ?? undefined,
      description: formData.get('description') ?? undefined,
      goal: formData.get('goal') ?? undefined,
      estimatedMinutes: formData.get('estimatedMinutes') ?? undefined,
      level: formData.get('level') ?? undefined,
      category: formData.get('category') ?? undefined,
      isTemplate: formData.get('isTemplate') === 'on',
    });
    if (!parsed.success) return errorState('Revisa los datos.', zodFieldErrors(parsed.error));
    await updateWorkoutMeta(workoutId, parsed.data);
    revalidatePath(`/coach/workouts/${workoutId}`);
    return successState('Guardado');
  } catch (error) {
    return fromException(error);
  }
}

export async function addExerciseAction(formData: FormData): Promise<void> {
  const { coach } = await requireCoachAction();
  const workoutId = String(formData.get('workoutId') ?? '');
  await assertCoachOwnsWorkout(coach.id, workoutId);
  await addExerciseToWorkout(workoutId, String(formData.get('exerciseId') ?? ''));
  revalidatePath(`/coach/workouts/${workoutId}`);
}

export async function removeExerciseAction(formData: FormData): Promise<void> {
  const { coach } = await requireCoachAction();
  const workoutId = String(formData.get('workoutId') ?? '');
  await assertCoachOwnsWorkout(coach.id, workoutId);
  await removeWorkoutExercise(workoutId, String(formData.get('workoutExerciseId') ?? ''));
  revalidatePath(`/coach/workouts/${workoutId}`);
}

export async function duplicateExerciseAction(formData: FormData): Promise<void> {
  const { coach } = await requireCoachAction();
  const workoutId = String(formData.get('workoutId') ?? '');
  await assertCoachOwnsWorkout(coach.id, workoutId);
  await duplicateWorkoutExercise(workoutId, String(formData.get('workoutExerciseId') ?? ''));
  revalidatePath(`/coach/workouts/${workoutId}`);
}

export async function reorderExercisesAction(workoutId: string, orderedIds: string[]): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    await assertCoachOwnsWorkout(coach.id, workoutId);
    await reorderWorkoutExercises(workoutId, orderedIds);
    revalidatePath(`/coach/workouts/${workoutId}`);
    return successState('Orden guardado');
  } catch (error) {
    return fromException(error);
  }
}

const exerciseConfigSchema = z.object({
  workoutId: z.string().min(1),
  workoutExerciseId: z.string().min(1),
  restSeconds: z.number().int().min(0).max(3600),
  tempo: z.string().max(20).nullable(),
  notes: z.string().max(1000).nullable(),
  supersetGroup: z.string().max(10).nullable(),
  sets: z.array(setConfigSchema).min(1).max(50),
});

/**
 * Guarda la configuración completa de un ejercicio dentro de la sesión.
 * Se llama desde el constructor con autoguardado (§81).
 */
export async function saveExerciseConfigAction(payload: unknown): Promise<ActionState> {
  try {
    const parsed = exerciseConfigSchema.safeParse(payload);
    if (!parsed.success) return errorState('Configuración no válida.', zodFieldErrors(parsed.error));

    const { coach } = await requireCoachAction();
    await assertCoachOwnsWorkout(coach.id, parsed.data.workoutId);

    await updateWorkoutExercise(parsed.data.workoutId, parsed.data.workoutExerciseId, {
      rest_seconds: parsed.data.restSeconds,
      tempo: parsed.data.tempo,
      notes: parsed.data.notes,
      superset_group: parsed.data.supersetGroup,
    });

    const sets: Omit<WorkoutSetRow, 'id' | 'workout_exercise_id'>[] = parsed.data.sets.map((set) => ({
      set_index: set.setIndex,
      set_type: set.setType,
      target_reps: set.targetReps ?? null,
      target_weight_kg: set.targetWeightKg ?? null,
      target_percent_1rm: set.targetPercent1rm ?? null,
      target_rpe: set.targetRpe ?? null,
      target_rir: set.targetRir ?? null,
      target_duration_seconds: set.targetDurationSeconds ?? null,
      target_distance_m: set.targetDistanceM ?? null,
      target_velocity_ms: set.targetVelocityMs ?? null,
      rest_seconds: set.restSeconds ?? null,
      notes: set.notes ?? null,
    }));
    await replaceSets(parsed.data.workoutId, parsed.data.workoutExerciseId, sets);

    revalidatePath(`/coach/workouts/${parsed.data.workoutId}`);
    return successState('Guardado');
  } catch (error) {
    return fromException(error);
  }
}

export async function deleteWorkoutAction(formData: FormData): Promise<void> {
  const { coach } = await requireCoachAction();
  const workoutId = String(formData.get('workoutId') ?? '');
  await assertCoachOwnsWorkout(coach.id, workoutId);
  await deleteWorkout(workoutId);
  revalidatePath('/coach/workouts');
  redirect('/coach/workouts');
}

export async function duplicateWorkoutAction(formData: FormData): Promise<void> {
  const { coach } = await requireCoachAction();
  const workoutId = String(formData.get('workoutId') ?? '');
  await assertCoachOwnsWorkout(coach.id, workoutId);
  const copy = await duplicateWorkout(coach.id, workoutId);
  revalidatePath('/coach/workouts');
  redirect(`/coach/workouts/${copy.id}`);
}

export async function assignWorkoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    const parsed = assignSchema.safeParse({
      workoutId: formData.get('workoutId'),
      athleteIds: formData.getAll('athleteIds').map(String),
      scheduledDate: formData.get('scheduledDate'),
      scheduledTime: formData.get('scheduledTime'),
      notes: formData.get('notes'),
    });
    if (!parsed.success) return errorState('Revisa la asignación.', zodFieldErrors(parsed.error));

    const rows = await assignWorkout(coach.id, parsed.data);
    revalidatePath('/coach/calendar');
    revalidatePath('/coach');
    return successState(
      rows.length === 1 ? 'Entrenamiento asignado.' : `Entrenamiento asignado a ${rows.length} jugadores.`,
    );
  } catch (error) {
    return fromException(error);
  }
}

export async function moveAssignmentAction(assignmentId: string, date: string): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    await moveAssignment(coach.id, assignmentId, date);
    revalidatePath('/coach/calendar');
    return successState('Sesión movida.');
  } catch (error) {
    return fromException(error);
  }
}

export async function deleteAssignmentAction(formData: FormData): Promise<void> {
  const { coach } = await requireCoachAction();
  await deleteAssignment(coach.id, String(formData.get('assignmentId') ?? ''));
  revalidatePath('/coach/calendar');
}

export async function duplicateWeekAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    const count = await duplicateWeek(
      coach.id,
      String(formData.get('weekStart') ?? ''),
      String(formData.get('targetWeekStart') ?? ''),
    );
    revalidatePath('/coach/calendar');
    return successState(count === 0 ? 'No había sesiones que duplicar.' : `${count} sesión(es) duplicadas.`);
  } catch (error) {
    return fromException(error);
  }
}
