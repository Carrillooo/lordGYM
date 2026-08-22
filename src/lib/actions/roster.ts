'use server';

import { revalidatePath } from 'next/cache';
import { requireAthleteAction, requireCoachAction, assertCoachLinkedToAthlete } from '@/lib/auth/guards';
import { createTeam, listTeams, requestLink, respondToLink, setTeamMembers } from '@/lib/services/roster';
import { addCoachNote, createGoal, deleteCoachNote, deleteGoal } from '@/lib/services/coach-notes';
import { updateAthleteProfile, updateProfile } from '@/lib/services/accounts';
import { athleteProfileSchema, goalSchema } from '@/lib/validation/schemas';
import { errorState, fromException, successState, zodFieldErrors, type ActionState } from './state';

export async function respondToLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    const linkId = String(formData.get('linkId') ?? '');
    const decision = formData.get('decision') === 'accept' ? 'active' : 'rejected';
    await respondToLink(coach.id, linkId, decision);
    revalidatePath('/coach');
    revalidatePath('/coach/players');
    return successState(decision === 'active' ? 'Jugador añadido al equipo.' : 'Solicitud rechazada.');
  } catch (error) {
    return fromException(error);
  }
}

export async function joinCoachAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { athlete } = await requireAthleteAction();
    const code = String(formData.get('coachCode') ?? '').trim();
    if (!code) return errorState('Introduce el código de tu entrenador.');
    const { coachName } = await requestLink(athlete.id, code);
    revalidatePath('/player');
    return successState(`Solicitud enviada a ${coachName}. Te avisaremos cuando la acepte.`);
  } catch (error) {
    return fromException(error);
  }
}

export async function updateAthleteProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const coachId = formData.get('coachId');
    const athleteId = String(formData.get('athleteId') ?? '');

    // El propio jugador o su entrenador pueden editar la ficha deportiva.
    if (coachId) {
      const { coach } = await requireCoachAction();
      await assertCoachLinkedToAthlete(coach.id, athleteId);
    } else {
      const { athlete } = await requireAthleteAction();
      if (athlete.id !== athleteId) return errorState('No puedes editar esa ficha.');
    }

    const parsed = athleteProfileSchema.safeParse({
      sport: formData.get('sport'),
      position: formData.get('position'),
      teamName: formData.get('teamName'),
      heightCm: formData.get('heightCm'),
      weightKg: formData.get('weightKg'),
      laterality: formData.get('laterality'),
      goals: formData.get('goals'),
      injuries: formData.get('injuries'),
      notes: formData.get('notes'),
    });
    if (!parsed.success) return errorState('Revisa los datos.', zodFieldErrors(parsed.error));

    await updateAthleteProfile(athleteId, {
      sport: parsed.data.sport ?? null,
      position: parsed.data.position ?? null,
      team_name: parsed.data.teamName ?? null,
      height_cm: parsed.data.heightCm ?? null,
      weight_kg: parsed.data.weightKg ?? null,
      laterality: parsed.data.laterality ?? null,
      goals: parsed.data.goals ?? null,
      injuries: parsed.data.injuries ?? null,
      notes: parsed.data.notes ?? null,
    });

    revalidatePath(`/coach/players/${athleteId}`);
    revalidatePath('/player/profile');
    return successState('Ficha actualizada.');
  } catch (error) {
    return fromException(error);
  }
}

export async function updateAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const profileId = String(formData.get('profileId') ?? '');
    const firstName = String(formData.get('firstName') ?? '').trim();
    const lastName = String(formData.get('lastName') ?? '').trim();
    const birthDate = String(formData.get('birthDate') ?? '').trim();
    const avatarUrl = String(formData.get('avatarUrl') ?? '').trim();
    if (!firstName || !lastName) return errorState('Nombre y apellidos son obligatorios.');

    // Sólo se permite editar el propio perfil.
    const { getCurrentUser } = await import('@/lib/auth/session');
    const current = await getCurrentUser();
    if (!current || current.profile.id !== profileId) return errorState('No puedes editar ese perfil.');

    await updateProfile(profileId, {
      first_name: firstName,
      last_name: lastName,
      birth_date: birthDate || null,
      avatar_url: avatarUrl || null,
    });
    revalidatePath('/coach/settings');
    revalidatePath('/player/profile');
    return successState('Perfil actualizado.');
  } catch (error) {
    return fromException(error);
  }
}

export async function addCoachNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    const athleteId = String(formData.get('athleteId') ?? '');
    const body = String(formData.get('body') ?? '').trim();
    if (!body) return errorState('Escribe la nota.');
    await addCoachNote(coach.id, athleteId, body, formData.get('visible') === 'on');
    revalidatePath(`/coach/players/${athleteId}`);
    return successState('Nota guardada.');
  } catch (error) {
    return fromException(error);
  }
}

export async function deleteCoachNoteAction(formData: FormData): Promise<void> {
  const { coach } = await requireCoachAction();
  await deleteCoachNote(coach.id, String(formData.get('noteId') ?? ''));
  revalidatePath(`/coach/players/${String(formData.get('athleteId') ?? '')}`);
}

export async function createGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    const parsed = goalSchema.safeParse({
      athleteId: formData.get('athleteId'),
      title: formData.get('title'),
      metric: formData.get('metric'),
      exerciseId: formData.get('exerciseId'),
      testId: formData.get('testId'),
      startValue: formData.get('startValue') ? Number(formData.get('startValue')) : undefined,
      targetValue: Number(formData.get('targetValue')),
      unit: formData.get('unit') || 'kg',
      lowerIsBetter: formData.get('lowerIsBetter') === 'on',
      dueDate: formData.get('dueDate'),
    });
    if (!parsed.success) return errorState('Revisa el objetivo.', zodFieldErrors(parsed.error));
    await createGoal(coach.id, parsed.data);
    revalidatePath(`/coach/players/${parsed.data.athleteId}`);
    return successState('Objetivo creado.');
  } catch (error) {
    return fromException(error);
  }
}

export async function deleteGoalAction(formData: FormData): Promise<void> {
  const { coach } = await requireCoachAction();
  await deleteGoal(coach.id, String(formData.get('goalId') ?? ''));
  revalidatePath(`/coach/players/${String(formData.get('athleteId') ?? '')}`);
}

export async function createTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return errorState('Ponle nombre al equipo.');
    await createTeam(coach.id, name, String(formData.get('sport') ?? '') || undefined, String(formData.get('category') ?? '') || undefined);
    revalidatePath('/coach/settings');
    return successState('Equipo creado.');
  } catch (error) {
    return fromException(error);
  }
}

export async function setTeamMembersAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { coach } = await requireCoachAction();
    const teamId = String(formData.get('teamId') ?? '');
    const athleteIds = formData.getAll('athleteIds').map(String);
    await setTeamMembers(coach.id, teamId, athleteIds);
    revalidatePath('/coach/settings');
    return successState('Equipo actualizado.');
  } catch (error) {
    return fromException(error);
  }
}

export async function listTeamsForCoach() {
  const { coach } = await requireCoachAction();
  return listTeams(coach.id);
}
