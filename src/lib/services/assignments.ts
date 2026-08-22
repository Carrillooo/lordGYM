import 'server-only';
import { db } from '@/lib/db';
import { newId } from '@/lib/domain/ids';
import { addDays, nowIso, relativeDayLabel, todayKey } from '@/lib/domain/datetime';
import { ServiceError } from './accounts';
import { activeAthleteIds } from './roster';
import { notify } from './notifications';
import type { AssignInput } from '@/lib/validation/schemas';
import type { AssignmentRow, ProfileRow, WorkoutRow, WorkoutSessionRow } from '@/types/db';

export interface AssignmentView {
  assignment: AssignmentRow;
  workout: WorkoutRow;
  session: WorkoutSessionRow | null;
  athleteProfile?: ProfileRow;
}

/** Asigna un entrenamiento a uno o varios jugadores (§32). */
export async function assignWorkout(coachId: string, input: AssignInput): Promise<AssignmentRow[]> {
  const [workout] = await db().select('workouts', { id: input.workoutId, coach_id: coachId });
  if (!workout) throw new ServiceError('Ese entrenamiento no es tuyo.');

  const allowed = new Set(await activeAthleteIds(coachId));
  const targets = input.athleteIds.filter((id) => allowed.has(id));
  if (targets.length === 0) throw new ServiceError('Ninguno de los jugadores pertenece a tu equipo.');

  const rows: AssignmentRow[] = targets.map((athleteId) => ({
    id: newId(),
    coach_id: coachId,
    athlete_id: athleteId,
    workout_id: input.workoutId,
    program_id: null,
    scheduled_date: input.scheduledDate,
    scheduled_time: input.scheduledTime ?? null,
    status: 'assigned',
    notes: input.notes ?? null,
    created_at: nowIso(),
  }));
  await db().insertMany('assignments', rows);

  const athletes = await db().select('athletes', { id: { in: targets } });
  await Promise.all(
    athletes.map((athlete) =>
      notify(athlete.user_id, {
        type: 'assignment',
        title: 'Nuevo entrenamiento asignado',
        body: `${workout.name} · ${relativeDayLabel(input.scheduledDate)}${
          input.scheduledTime ? ` a las ${input.scheduledTime}` : ''
        }`,
        link: '/player/today',
      }),
    ),
  );

  return rows;
}

export async function moveAssignment(coachId: string, assignmentId: string, date: string): Promise<void> {
  const [assignment] = await db().select('assignments', { id: assignmentId, coach_id: coachId });
  if (!assignment) throw new ServiceError('Asignación no encontrada.');
  if (assignment.status === 'completed') throw new ServiceError('Una sesión completada no se puede mover.');
  await db().update('assignments', assignmentId, { scheduled_date: date });
}

export async function deleteAssignment(coachId: string, assignmentId: string): Promise<void> {
  const [assignment] = await db().select('assignments', { id: assignmentId, coach_id: coachId });
  if (!assignment) throw new ServiceError('Asignación no encontrada.');
  if (assignment.status !== 'assigned') {
    throw new ServiceError('Sólo se pueden eliminar sesiones que aún no ha empezado el jugador.');
  }
  await db().remove('assignments', assignmentId);
}

/** Duplica todas las asignaciones de una semana a otra (§33). */
export async function duplicateWeek(coachId: string, weekStart: string, targetWeekStart: string): Promise<number> {
  const weekEnd = addDays(weekStart, 6);
  const rows = await db().select('assignments', {
    coach_id: coachId,
    scheduled_date: { gte: weekStart, lte: weekEnd },
  });
  const offset = Math.round(
    (Date.parse(`${targetWeekStart}T12:00:00Z`) - Date.parse(`${weekStart}T12:00:00Z`)) / 86_400_000,
  );
  const copies: AssignmentRow[] = rows.map((row) => ({
    ...row,
    id: newId(),
    scheduled_date: addDays(row.scheduled_date, offset),
    status: 'assigned',
    created_at: nowIso(),
  }));
  await db().insertMany('assignments', copies);
  return copies.length;
}

async function decorate(assignments: AssignmentRow[]): Promise<AssignmentView[]> {
  if (assignments.length === 0) return [];
  const workouts = await db().select('workouts', { id: { in: assignments.map((a) => a.workout_id) } });
  const workoutById = new Map(workouts.map((w) => [w.id, w]));
  const sessions = await db().select('workout_sessions', { assignment_id: { in: assignments.map((a) => a.id) } });

  return assignments.flatMap((assignment) => {
    const workout = workoutById.get(assignment.workout_id);
    if (!workout) return [];
    return [
      {
        assignment,
        workout,
        session: sessions.find((s) => s.assignment_id === assignment.id) ?? null,
      },
    ];
  });
}

export async function assignmentsForAthlete(
  athleteId: string,
  from: string,
  to: string,
): Promise<AssignmentView[]> {
  const rows = await db().select(
    'assignments',
    { athlete_id: athleteId, scheduled_date: { gte: from, lte: to } },
    { orderBy: { column: 'scheduled_date' } },
  );
  return decorate(rows);
}

export async function assignmentsForCoach(coachId: string, from: string, to: string): Promise<AssignmentView[]> {
  const rows = await db().select(
    'assignments',
    { coach_id: coachId, scheduled_date: { gte: from, lte: to } },
    { orderBy: { column: 'scheduled_date' } },
  );
  const views = await decorate(rows);
  const athletes = await db().select('athletes', { id: { in: rows.map((r) => r.athlete_id) } });
  const profiles = athletes.length
    ? await db().select('profiles', { user_id: { in: athletes.map((a) => a.user_id) } })
    : [];
  const profileByAthlete = new Map(
    athletes.flatMap((athlete) => {
      const profile = profiles.find((p) => p.user_id === athlete.user_id);
      return profile ? [[athlete.id, profile] as const] : [];
    }),
  );
  return views.map((view) => ({ ...view, athleteProfile: profileByAthlete.get(view.assignment.athlete_id) }));
}

/** Próxima sesión pendiente del jugador (hoy o el día más cercano). */
export async function nextAssignment(athleteId: string, today = todayKey()): Promise<AssignmentView | null> {
  const rows = await db().select(
    'assignments',
    { athlete_id: athleteId, status: { in: ['assigned', 'started'] }, scheduled_date: { gte: today } },
    { orderBy: { column: 'scheduled_date' } },
  );
  const views = await decorate(rows);
  return views[0] ?? null;
}

/** Sesión empezada y no terminada, para el aviso «Continuar entrenamiento» (§90). */
export async function unfinishedSession(athleteId: string): Promise<WorkoutSessionRow | null> {
  const rows = await db().select(
    'workout_sessions',
    { athlete_id: athleteId, status: 'started' },
    { orderBy: { column: 'started_at', ascending: false }, limit: 1 },
  );
  return rows[0] ?? null;
}

/** Marca como omitidas las asignaciones vencidas sin sesión asociada. */
export async function expireOverdueAssignments(athleteId: string, today = todayKey()): Promise<void> {
  const stale = await db().select('assignments', {
    athlete_id: athleteId,
    status: 'assigned',
    scheduled_date: { lt: addDays(today, -2) },
  });
  await Promise.all(stale.map((row) => db().update('assignments', row.id, { status: 'skipped' })));
}
