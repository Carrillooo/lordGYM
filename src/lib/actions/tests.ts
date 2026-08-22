'use server';

import { revalidatePath } from 'next/cache';
import { requireCoachAction } from '@/lib/auth/guards';
import { createTest, recordTestResult } from '@/lib/services/tests';
import { testResultSchema } from '@/lib/validation/schemas';
import { errorState, fromException, successState, zodFieldErrors, type ActionState } from './state';

export async function createTestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    const name = String(formData.get('name') ?? '').trim();
    const unit = String(formData.get('unit') ?? '').trim();
    if (!name || !unit) return errorState('Nombre y unidad son obligatorios.');
    await createTest(coach.id, {
      name,
      unit,
      category: String(formData.get('category') ?? 'General') || 'General',
      lowerIsBetter: formData.get('lowerIsBetter') === 'on',
    });
    revalidatePath('/coach/tests');
    return successState('Prueba creada.');
  } catch (error) {
    return fromException(error);
  }
}

export async function recordTestResultAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    const parsed = testResultSchema.safeParse({
      testId: formData.get('testId'),
      athleteId: formData.get('athleteId'),
      date: formData.get('date'),
      value: Number(String(formData.get('value') ?? '').replace(',', '.')),
      note: formData.get('note'),
    });
    if (!parsed.success) return errorState('Revisa el resultado.', zodFieldErrors(parsed.error));
    await recordTestResult(coach.id, parsed.data);
    revalidatePath('/coach/tests');
    revalidatePath(`/coach/players/${parsed.data.athleteId}`);
    return successState('Resultado registrado.');
  } catch (error) {
    return fromException(error);
  }
}
