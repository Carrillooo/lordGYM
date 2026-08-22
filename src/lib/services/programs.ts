import 'server-only';
import { db } from '@/lib/db';
import { newId } from '@/lib/domain/ids';
import { addDays, nowIso } from '@/lib/domain/datetime';
import { ServiceError } from './accounts';
import { activeAthleteIds } from './roster';
import { notify } from './notifications';
import type { AssignmentRow, ProgramRow, ProgramWeekRow, ProgramWorkoutRow, WorkoutRow } from '@/types/db';

export interface ProgramDetail {
  program: ProgramRow;
  weeks: {
    week: ProgramWeekRow;
    entries: { entry: ProgramWorkoutRow; workout: WorkoutRow }[];
  }[];
}

export async function listPrograms(coachId: string): Promise<(ProgramRow & { workoutCount: number })[]> {
  const programs = await db().select(
    'programs',
    { coach_id: coachId },
    { orderBy: { column: 'created_at', ascending: false } },
  );
  if (programs.length === 0) return [];
  const weeks = await db().select('program_weeks', { program_id: { in: programs.map((p) => p.id) } });
  const entries = weeks.length
    ? await db().select('program_workouts', { program_week_id: { in: weeks.map((w) => w.id) } })
    : [];

  return programs.map((program) => {
    const weekIds = new Set(weeks.filter((w) => w.program_id === program.id).map((w) => w.id));
    return { ...program, workoutCount: entries.filter((e) => weekIds.has(e.program_week_id)).length };
  });
}

export async function createProgram(
  coachId: string,
  input: { name: string; description?: string; weeksCount: number; startDate?: string },
): Promise<ProgramRow> {
  const program: ProgramRow = {
    id: newId(),
    coach_id: coachId,
    name: input.name,
    description: input.description ?? null,
    weeks_count: input.weeksCount,
    start_date: input.startDate ?? null,
    created_at: nowIso(),
  };
  await db().insert('programs', program);
  await db().insertMany(
    'program_weeks',
    Array.from({ length: input.weeksCount }, (_, index) => ({
      id: newId(),
      program_id: program.id,
      week_index: index + 1,
      title: `Semana ${index + 1}`,
      notes: null,
    })),
  );
  return program;
}

export async function getProgramDetail(programId: string): Promise<ProgramDetail | null> {
  const [program] = await db().select('programs', { id: programId });
  if (!program) return null;
  const weeks = await db().select('program_weeks', { program_id: programId }, { orderBy: { column: 'week_index' } });
  const entries = weeks.length
    ? await db().select('program_workouts', { program_week_id: { in: weeks.map((w) => w.id) } })
    : [];
  const workouts = entries.length
    ? await db().select('workouts', { id: { in: entries.map((e) => e.workout_id) } })
    : [];
  const workoutById = new Map(workouts.map((w) => [w.id, w]));

  return {
    program,
    weeks: weeks.map((week) => ({
      week,
      entries: entries
        .filter((entry) => entry.program_week_id === week.id)
        .sort((a, b) => a.day_of_week - b.day_of_week)
        .flatMap((entry) => {
          const workout = workoutById.get(entry.workout_id);
          return workout ? [{ entry, workout }] : [];
        }),
    })),
  };
}

export async function addWorkoutToWeek(
  programWeekId: string,
  workoutId: string,
  dayOfWeek: number,
): Promise<void> {
  await db().insert('program_workouts', {
    id: newId(),
    program_week_id: programWeekId,
    workout_id: workoutId,
    day_of_week: dayOfWeek,
  });
}

export async function removeProgramWorkout(entryId: string): Promise<void> {
  await db().remove('program_workouts', entryId);
}

/** Duplica un programa completo con sus semanas y sesiones (§33). */
export async function duplicateProgram(coachId: string, programId: string): Promise<ProgramRow> {
  const detail = await getProgramDetail(programId);
  if (!detail) throw new ServiceError('Programa no encontrado.');

  const copy: ProgramRow = {
    ...detail.program,
    id: newId(),
    coach_id: coachId,
    name: `${detail.program.name} (copia)`,
    created_at: nowIso(),
  };
  await db().insert('programs', copy);

  for (const { week, entries } of detail.weeks) {
    const weekCopy: ProgramWeekRow = { ...week, id: newId(), program_id: copy.id };
    await db().insert('program_weeks', weekCopy);
    await db().insertMany(
      'program_workouts',
      entries.map(({ entry }) => ({ ...entry, id: newId(), program_week_id: weekCopy.id })),
    );
  }
  return copy;
}

/**
 * Vuelca un programa al calendario de uno o varios jugadores: cada semana se
 * traslada a fechas reales a partir de `startDate` (que debe ser un lunes).
 */
export async function assignProgram(
  coachId: string,
  programId: string,
  athleteIds: string[],
  startDate: string,
): Promise<number> {
  const detail = await getProgramDetail(programId);
  if (!detail || detail.program.coach_id !== coachId) throw new ServiceError('Programa no encontrado.');

  const allowed = new Set(await activeAthleteIds(coachId));
  const targets = athleteIds.filter((id) => allowed.has(id));
  if (targets.length === 0) throw new ServiceError('Selecciona jugadores de tu equipo.');

  const rows: AssignmentRow[] = [];
  for (const { week, entries } of detail.weeks) {
    const weekStart = addDays(startDate, (week.week_index - 1) * 7);
    for (const { entry } of entries) {
      const date = addDays(weekStart, entry.day_of_week - 1);
      for (const athleteId of targets) {
        rows.push({
          id: newId(),
          coach_id: coachId,
          athlete_id: athleteId,
          workout_id: entry.workout_id,
          program_id: programId,
          scheduled_date: date,
          scheduled_time: null,
          status: 'assigned',
          notes: null,
          created_at: nowIso(),
        });
      }
    }
  }
  await db().insertMany('assignments', rows);

  const athletes = await db().select('athletes', { id: { in: targets } });
  await Promise.all(
    athletes.map((athlete) =>
      notify(athlete.user_id, {
        type: 'assignment',
        title: 'Nuevo programa asignado',
        body: `${detail.program.name} · ${detail.program.weeks_count} semanas`,
        link: '/player/calendar',
      }),
    ),
  );
  return rows.length;
}

export async function deleteProgram(programId: string): Promise<void> {
  const weeks = await db().select('program_weeks', { program_id: programId });
  for (const week of weeks) {
    await db().removeWhere('program_workouts', { program_week_id: week.id });
  }
  await db().removeWhere('program_weeks', { program_id: programId });
  await db().remove('programs', programId);
}
