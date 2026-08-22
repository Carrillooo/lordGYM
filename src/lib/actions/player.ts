'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAthleteAction } from '@/lib/auth/guards';
import {
  abandonSession,
  finishSession,
  logSet,
  setExerciseComment,
  startSession,
  type FinishSummary,
} from '@/lib/services/sessions';
import { saveBodyweight, savePain, saveWellness } from '@/lib/services/wellness';
import {
  bodyweightSchema,
  finishSessionSchema,
  logSetSchema,
  painSchema,
  wellnessSchema,
} from '@/lib/validation/schemas';
import { errorState, fromException, successState, zodFieldErrors, type ActionState } from './state';

/** Arranca la sesión de una asignación y lleva al modo entrenamiento. */
export async function startSessionAction(formData: FormData): Promise<void> {
  const { athlete } = await requireAthleteAction();
  const session = await startSession(athlete.id, String(formData.get('assignmentId') ?? ''));
  revalidatePath('/player');
  redirect(`/player/workout/${session.id}`);
}

export interface LogSetResult extends ActionState {
  setId?: string;
}

/**
 * Registra una serie. Se llama desde el modo entrenamiento y también desde la
 * cola offline al recuperar conexión, por eso es idempotente.
 */
export async function logSetAction(input: {
  sessionId: string;
  setId: string;
  actualReps?: number | null;
  actualWeightKg?: number | null;
  actualDurationSeconds?: number | null;
  actualDistanceM?: number | null;
  rpe?: number | null;
  status: 'pending' | 'completed' | 'skipped';
}): Promise<LogSetResult> {
  try {
    const { athlete } = await requireAthleteAction();
    const parsed = logSetSchema.safeParse(input);
    if (!parsed.success) return errorState('Datos de serie no válidos.', zodFieldErrors(parsed.error));
    const row = await logSet(athlete.id, parsed.data);
    return { ...successState(), setId: row.id };
  } catch (error) {
    return fromException(error, 'No se ha podido guardar la serie.');
  }
}

export async function saveExerciseCommentAction(input: {
  sessionExerciseId: string;
  comment: string | null;
  videoUrl?: string | null;
}): Promise<ActionState> {
  try {
    const { athlete } = await requireAthleteAction();
    await setExerciseComment(athlete.id, input.sessionExerciseId, input.comment, input.videoUrl);
    return successState('Comentario guardado.');
  } catch (error) {
    return fromException(error);
  }
}

export interface FinishResult extends ActionState {
  summary?: FinishSummary;
}

export async function finishSessionAction(input: {
  sessionId: string;
  durationSeconds: number;
  sessionRpe: number;
  feeling: number;
  fatigue: number;
  soreness: number;
  comment?: string;
}): Promise<FinishResult> {
  try {
    const { athlete } = await requireAthleteAction();
    const parsed = finishSessionSchema.safeParse(input);
    if (!parsed.success) return errorState('Faltan datos del resumen.', zodFieldErrors(parsed.error));
    const summary = await finishSession(athlete.id, parsed.data);
    revalidatePath('/player');
    revalidatePath('/player/progress');
    revalidatePath('/player/calendar');
    return { ...successState('Entrenamiento completado.'), summary };
  } catch (error) {
    return fromException(error, 'No se ha podido cerrar la sesión.');
  }
}

export async function abandonSessionAction(formData: FormData): Promise<void> {
  const { athlete } = await requireAthleteAction();
  await abandonSession(athlete.id, String(formData.get('sessionId') ?? ''));
  revalidatePath('/player');
  redirect('/player');
}

export async function saveWellnessAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { athlete } = await requireAthleteAction();
    const parsed = wellnessSchema.safeParse({
      date: formData.get('date'),
      sleep: Number(formData.get('sleep')),
      energy: Number(formData.get('energy')),
      stress: Number(formData.get('stress')),
      fatigue: Number(formData.get('fatigue')),
      soreness: Number(formData.get('soreness')),
      motivation: Number(formData.get('motivation')),
      note: formData.get('note'),
    });
    if (!parsed.success) return errorState('Completa el check-in.', zodFieldErrors(parsed.error));
    await saveWellness(athlete.id, parsed.data);
    revalidatePath('/player/wellness');
    revalidatePath('/player');
    return successState('Check-in guardado.');
  } catch (error) {
    return fromException(error);
  }
}

export async function savePainAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { athlete } = await requireAthleteAction();
    const parsed = painSchema.safeParse({
      date: formData.get('date'),
      bodyPart: formData.get('bodyPart'),
      side: formData.get('side'),
      intensity: Number(formData.get('intensity')),
      note: formData.get('note'),
    });
    if (!parsed.success) return errorState('Selecciona la zona y la intensidad.', zodFieldErrors(parsed.error));
    await savePain(athlete.id, parsed.data);
    revalidatePath('/player/wellness');
    return successState('Molestia registrada. Tu entrenador la verá en tu ficha.');
  } catch (error) {
    return fromException(error);
  }
}

export async function saveBodyweightAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { athlete } = await requireAthleteAction();
    const parsed = bodyweightSchema.safeParse({
      date: formData.get('date'),
      weightKg: Number(String(formData.get('weightKg') ?? '').replace(',', '.')),
    });
    if (!parsed.success) return errorState('Introduce un peso válido.', zodFieldErrors(parsed.error));
    await saveBodyweight(athlete.id, parsed.data);
    revalidatePath('/player/progress');
    revalidatePath('/player/profile');
    return successState('Peso registrado.');
  } catch (error) {
    return fromException(error);
  }
}
