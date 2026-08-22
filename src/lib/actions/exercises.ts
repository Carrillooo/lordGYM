'use server';

import { revalidatePath } from 'next/cache';
import { assertCoachCanEditExercise, requireCoachAction } from '@/lib/auth/guards';
import { createExercise, deleteExercise, updateExercise } from '@/lib/services/exercises';
import { exerciseSchema } from '@/lib/validation/schemas';
import { errorState, fromException, successState, zodFieldErrors, type ActionState } from './state';

function readExerciseForm(formData: FormData) {
  return {
    name: formData.get('name'),
    category: formData.get('category'),
    metricType: formData.get('metricType'),
    movementType: formData.get('movementType'),
    muscles: formData.get('muscles'),
    equipment: formData.get('equipment'),
    description: formData.get('description'),
    technique: formData.get('technique'),
    videoUrl: formData.get('videoUrl'),
    imageUrl: formData.get('imageUrl'),
  };
}

export async function createExerciseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    const parsed = exerciseSchema.safeParse(readExerciseForm(formData));
    if (!parsed.success) return errorState('Revisa los datos del ejercicio.', zodFieldErrors(parsed.error));
    await createExercise(coach.id, parsed.data);
    revalidatePath('/coach/exercises');
    return successState('Ejercicio creado.');
  } catch (error) {
    return fromException(error);
  }
}

export async function updateExerciseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    const exerciseId = String(formData.get('exerciseId') ?? '');
    await assertCoachCanEditExercise(coach.id, exerciseId);
    const parsed = exerciseSchema.safeParse(readExerciseForm(formData));
    if (!parsed.success) return errorState('Revisa los datos del ejercicio.', zodFieldErrors(parsed.error));
    await updateExercise(exerciseId, parsed.data);
    revalidatePath('/coach/exercises');
    return successState('Ejercicio actualizado.');
  } catch (error) {
    return fromException(error);
  }
}

export async function deleteExerciseAction(formData: FormData): Promise<void> {
  const { coach } = await requireCoachAction();
  const exerciseId = String(formData.get('exerciseId') ?? '');
  await assertCoachCanEditExercise(coach.id, exerciseId);
  await deleteExercise(exerciseId);
  revalidatePath('/coach/exercises');
}
