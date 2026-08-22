'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assertCoachOwnsProgram, requireCoachAction } from '@/lib/auth/guards';
import {
  addWorkoutToWeek,
  assignProgram,
  createProgram,
  deleteProgram,
  duplicateProgram,
  removeProgramWorkout,
} from '@/lib/services/programs';
import { startOfWeek } from '@/lib/domain/datetime';
import { errorState, fromException, successState, type ActionState } from './state';

export async function createProgramAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let programId: string;
  try {
    const { coach } = await requireCoachAction();
    const name = String(formData.get('name') ?? '').trim();
    const weeks = Number(formData.get('weeksCount') ?? 8);
    if (!name) return errorState('Ponle nombre al programa.');
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) return errorState('Las semanas deben ir de 1 a 52.');
    const program = await createProgram(coach.id, {
      name,
      description: String(formData.get('description') ?? '') || undefined,
      weeksCount: weeks,
      startDate: String(formData.get('startDate') ?? '') || undefined,
    });
    programId = program.id;
  } catch (error) {
    return fromException(error);
  }
  revalidatePath('/coach/programs');
  redirect(`/coach/programs/${programId}`);
}

export async function addProgramWorkoutAction(formData: FormData): Promise<void> {
  const { coach } = await requireCoachAction();
  const programId = String(formData.get('programId') ?? '');
  await assertCoachOwnsProgram(coach.id, programId);
  await addWorkoutToWeek(
    String(formData.get('programWeekId') ?? ''),
    String(formData.get('workoutId') ?? ''),
    Number(formData.get('dayOfWeek') ?? 1),
  );
  revalidatePath(`/coach/programs/${programId}`);
}

export async function removeProgramWorkoutAction(formData: FormData): Promise<void> {
  const { coach } = await requireCoachAction();
  const programId = String(formData.get('programId') ?? '');
  await assertCoachOwnsProgram(coach.id, programId);
  await removeProgramWorkout(String(formData.get('entryId') ?? ''));
  revalidatePath(`/coach/programs/${programId}`);
}

export async function duplicateProgramAction(formData: FormData): Promise<void> {
  const { coach } = await requireCoachAction();
  const programId = String(formData.get('programId') ?? '');
  await assertCoachOwnsProgram(coach.id, programId);
  const copy = await duplicateProgram(coach.id, programId);
  revalidatePath('/coach/programs');
  redirect(`/coach/programs/${copy.id}`);
}

export async function deleteProgramAction(formData: FormData): Promise<void> {
  const { coach } = await requireCoachAction();
  const programId = String(formData.get('programId') ?? '');
  await assertCoachOwnsProgram(coach.id, programId);
  await deleteProgram(programId);
  revalidatePath('/coach/programs');
  redirect('/coach/programs');
}

export async function assignProgramAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    const programId = String(formData.get('programId') ?? '');
    const athleteIds = formData.getAll('athleteIds').map(String);
    const startDate = String(formData.get('startDate') ?? '');
    if (athleteIds.length === 0) return errorState('Selecciona al menos un jugador.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return errorState('Elige la fecha de inicio.');

    // El programa se organiza por semanas ISO: se ancla siempre al lunes.
    const count = await assignProgram(coach.id, programId, athleteIds, startOfWeek(startDate));
    revalidatePath('/coach/calendar');
    return successState(`${count} sesión(es) volcadas al calendario.`);
  } catch (error) {
    return fromException(error);
  }
}
