import 'server-only';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentUser } from './session';
import type { AthleteRow, CoachRow, ProfileRow, UserRow } from '@/types/db';

/**
 * Autorización del servidor (§63). El frontend nunca decide qué puede verse:
 * cada carga de datos y cada mutación pasa por uno de estos guardas.
 */

export class AuthorizationError extends Error {
  constructor(message = 'No tienes permiso para esta acción.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export interface CoachContext {
  user: UserRow;
  profile: ProfileRow;
  coach: CoachRow;
}

export interface AthleteContext {
  user: UserRow;
  profile: ProfileRow;
  athlete: AthleteRow;
}

/** Redirige a `/login` si no hay sesión. Para uso en Server Components. */
export async function requireUser(): Promise<{ user: UserRow; profile: ProfileRow }> {
  const current = await getCurrentUser();
  if (!current) redirect('/login');
  return current;
}

export async function requireCoach(): Promise<CoachContext> {
  const { user, profile } = await requireUser();
  if (profile.role !== 'coach') redirect('/player');
  const [coach] = await db().select('coaches', { user_id: user.id });
  if (!coach) redirect('/login');
  return { user, profile, coach };
}

export async function requireAthlete(): Promise<AthleteContext> {
  const { user, profile } = await requireUser();
  if (profile.role !== 'athlete') redirect('/coach');
  const [athlete] = await db().select('athletes', { user_id: user.id });
  if (!athlete) redirect('/login');
  return { user, profile, athlete };
}

/** Variante para Server Actions: lanza en lugar de redirigir. */
export async function requireCoachAction(): Promise<CoachContext> {
  const current = await getCurrentUser();
  if (!current) throw new AuthorizationError('Sesión no válida.');
  if (current.profile.role !== 'coach') throw new AuthorizationError('Sólo para entrenadores.');
  const [coach] = await db().select('coaches', { user_id: current.user.id });
  if (!coach) throw new AuthorizationError('Perfil de entrenador no encontrado.');
  return { ...current, coach };
}

export async function requireAthleteAction(): Promise<AthleteContext> {
  const current = await getCurrentUser();
  if (!current) throw new AuthorizationError('Sesión no válida.');
  if (current.profile.role !== 'athlete') throw new AuthorizationError('Sólo para jugadores.');
  const [athlete] = await db().select('athletes', { user_id: current.user.id });
  if (!athlete) throw new AuthorizationError('Perfil de jugador no encontrado.');
  return { ...current, athlete };
}

/** El entrenador sólo accede a jugadores con vínculo aceptado. */
export async function assertCoachLinkedToAthlete(coachId: string, athleteId: string): Promise<void> {
  const [link] = await db().select('coach_athletes', {
    coach_id: coachId,
    athlete_id: athleteId,
    status: 'active',
  });
  if (!link) throw new AuthorizationError('Ese jugador no pertenece a tu equipo.');
}

export async function assertCoachOwnsWorkout(coachId: string, workoutId: string): Promise<void> {
  const [workout] = await db().select('workouts', { id: workoutId, coach_id: coachId });
  if (!workout) throw new AuthorizationError('Ese entrenamiento no es tuyo.');
}

export async function assertCoachOwnsProgram(coachId: string, programId: string): Promise<void> {
  const [program] = await db().select('programs', { id: programId, coach_id: coachId });
  if (!program) throw new AuthorizationError('Ese programa no es tuyo.');
}

/** El entrenador puede editar la biblioteca global y sus propios ejercicios. */
export async function assertCoachCanEditExercise(coachId: string, exerciseId: string): Promise<void> {
  const [exercise] = await db().select('exercises', { id: exerciseId });
  if (!exercise) throw new AuthorizationError('Ejercicio no encontrado.');
  if (exercise.owner_coach_id !== coachId) {
    throw new AuthorizationError('Los ejercicios de la biblioteca LORDGYM no se pueden modificar.');
  }
}

export async function assertAthleteOwnsSession(athleteId: string, sessionId: string): Promise<void> {
  const [session] = await db().select('workout_sessions', { id: sessionId, athlete_id: athleteId });
  if (!session) throw new AuthorizationError('Esa sesión no es tuya.');
}
