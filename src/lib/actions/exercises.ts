'use server';

import { revalidatePath } from 'next/cache';
import { assertCoachCanEditExercise, requireCoachAction } from '@/lib/auth/guards';
import { createExercise, deleteExercise, getExercise, updateExercise } from '@/lib/services/exercises';
import { setExerciseVideo, videoUrlFor } from '@/lib/services/exercise-media';
import { removeIfOwned } from '@/lib/media';
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

/**
 * Guarda el vídeo de técnica que el entrenador cuelga de un ejercicio.
 *
 * Vale para cualquier ejercicio que vea: también los de la biblioteca global,
 * porque el vídeo no se escribe en el catálogo compartido sino en su propia
 * tabla (`exercise_media`). El entrenador quiere enseñar SU press de banca, no
 * cambiarle el press de banca a nadie.
 */
export async function saveExerciseVideoAction(input: {
  exerciseId: string;
  videoUrl: string | null;
}): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    const exercise = await getExercise(input.exerciseId);
    if (!exercise) return errorState('Ejercicio no encontrado.');
    if (exercise.owner_coach_id !== null && exercise.owner_coach_id !== coach.id) {
      return errorState('Ese ejercicio no es tuyo.');
    }
    if (input.videoUrl && input.videoUrl.length > 1000) return errorState('Enlace demasiado largo.');

    const previous = await videoUrlFor(exercise, coach.id);
    await setExerciseVideo(coach.id, input.exerciseId, input.videoUrl);
    // Sólo después de que la fila esté guardada: si se borrara antes y fallara
    // el guardado, quedaría una URL apuntando a un fichero que ya no existe.
    if (previous && previous !== input.videoUrl) await removeIfOwned(previous);

    revalidatePath('/coach/exercises');
    return successState(input.videoUrl ? 'Vídeo guardado.' : 'Vídeo quitado.');
  } catch (error) {
    return fromException(error);
  }
}
