import 'server-only';
import { db } from '@/lib/db';
import { newId } from '@/lib/domain/ids';
import { nowIso, todayKey } from '@/lib/domain/datetime';
import { epley1RM, setVolume, trainingLoad } from '@/lib/domain/metrics';
import { fullName } from '@/lib/domain/labels';
import { ServiceError } from './accounts';
import { notify } from './notifications';
import { getWorkoutDetail } from './workouts';
import type { FinishSessionInput, LogSetInput } from '@/lib/validation/schemas';
import type {
  ExerciseRow,
  PersonalRecordRow,
  RecordType,
  SessionExerciseRow,
  SessionSetRow,
  WorkoutSessionRow,
} from '@/types/db';

export interface SessionExerciseView {
  sessionExercise: SessionExerciseRow;
  exercise: ExerciseRow;
  sets: SessionSetRow[];
  /** Series realizadas la última vez que entrenó este ejercicio (§21). */
  lastTime: { weightKg: number | null; reps: number | null; date: string }[];
  /** Mejor marca histórica antes de esta sesión. */
  bestWeightKg: number | null;
  best1RM: number | null;
}

export interface SessionDetail {
  session: WorkoutSessionRow;
  workoutName: string;
  exercises: SessionExerciseView[];
  totalSets: number;
  completedSets: number;
}

/**
 * Arranca (o recupera) la sesión de una asignación.
 *
 * La plantilla se copia a `session_exercises` / `session_sets`: a partir de
 * aquí, editar la plantilla no altera el histórico (§105).
 */
export async function startSession(athleteId: string, assignmentId: string): Promise<WorkoutSessionRow> {
  const [assignment] = await db().select('assignments', { id: assignmentId, athlete_id: athleteId });
  if (!assignment) throw new ServiceError('Esa asignación no es tuya.');

  const [existing] = await db().select('workout_sessions', { assignment_id: assignmentId });
  if (existing) return existing;

  const detail = await getWorkoutDetail(assignment.workout_id);
  if (!detail) throw new ServiceError('El entrenamiento ya no existe.');

  const session: WorkoutSessionRow = {
    id: newId(),
    assignment_id: assignmentId,
    athlete_id: athleteId,
    workout_id: assignment.workout_id,
    status: 'started',
    started_at: nowIso(),
    completed_at: null,
    duration_seconds: null,
    session_rpe: null,
    feeling: null,
    fatigue: null,
    soreness: null,
    comment: null,
    total_volume_kg: 0,
    training_load_au: null,
  };
  await db().insert('workout_sessions', session);

  for (const row of detail.exercises) {
    const sessionExercise: SessionExerciseRow = {
      id: newId(),
      session_id: session.id,
      workout_exercise_id: row.workoutExercise.id,
      exercise_id: row.exercise.id,
      position: row.workoutExercise.position,
      superset_group: row.workoutExercise.superset_group,
      rest_seconds: row.workoutExercise.rest_seconds,
      notes: row.workoutExercise.notes,
      athlete_comment: null,
      video_url: null,
    };
    await db().insert('session_exercises', sessionExercise);

    // Autocompletar (§68): si hay histórico se propone el último peso realizado.
    const suggestion = await lastPerformance(athleteId, row.exercise.id);

    await db().insertMany(
      'session_sets',
      row.sets.map((set, index): SessionSetRow => {
        const suggested = suggestion.sets[index];
        return {
          id: newId(),
          session_exercise_id: sessionExercise.id,
          set_index: set.set_index,
          set_type: set.set_type,
          target_reps: set.target_reps,
          target_weight_kg: set.target_weight_kg,
          actual_reps: set.target_reps ?? suggested?.reps ?? null,
          actual_weight_kg: set.target_weight_kg ?? suggested?.weightKg ?? null,
          actual_duration_seconds: null,
          actual_distance_m: null,
          rpe: null,
          status: 'pending',
          completed_at: null,
        };
      }),
    );
  }

  await db().update('assignments', assignmentId, { status: 'started' });
  return session;
}

/** Últimas series realizadas de un ejercicio, para sugerencias e histórico. */
export async function lastPerformance(
  athleteId: string,
  exerciseId: string,
  beforeSessionId?: string,
): Promise<{ date: string | null; sets: { weightKg: number | null; reps: number | null }[] }> {
  const sessions = await db().select(
    'workout_sessions',
    { athlete_id: athleteId, status: 'completed' },
    { orderBy: { column: 'completed_at', ascending: false } },
  );
  const filtered = beforeSessionId ? sessions.filter((s) => s.id !== beforeSessionId) : sessions;
  if (filtered.length === 0) return { date: null, sets: [] };

  const sessionExercises = await db().select('session_exercises', {
    session_id: { in: filtered.map((s) => s.id) },
    exercise_id: exerciseId,
  });
  if (sessionExercises.length === 0) return { date: null, sets: [] };

  for (const session of filtered) {
    const match = sessionExercises.find((se) => se.session_id === session.id);
    if (!match) continue;
    const sets = await db().select('session_sets', { session_exercise_id: match.id, status: 'completed' });
    if (sets.length === 0) continue;
    return {
      date: (session.completed_at ?? session.started_at).slice(0, 10),
      sets: sets
        .sort((a, b) => a.set_index - b.set_index)
        .map((set) => ({ weightKg: set.actual_weight_kg, reps: set.actual_reps })),
    };
  }
  return { date: null, sets: [] };
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const [session] = await db().select('workout_sessions', { id: sessionId });
  if (!session) return null;

  const [workout] = await db().select('workouts', { id: session.workout_id });
  const sessionExercises = await db().select(
    'session_exercises',
    { session_id: sessionId },
    { orderBy: { column: 'position' } },
  );
  const sets = sessionExercises.length
    ? await db().select('session_sets', { session_exercise_id: { in: sessionExercises.map((se) => se.id) } })
    : [];
  const exercises = sessionExercises.length
    ? await db().select('exercises', { id: { in: sessionExercises.map((se) => se.exercise_id) } })
    : [];
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const records = await db().select('personal_records', { athlete_id: session.athlete_id });

  const views: SessionExerciseView[] = [];
  for (const sessionExercise of sessionExercises) {
    const exercise = exerciseById.get(sessionExercise.exercise_id);
    if (!exercise) continue;
    const previous = await lastPerformance(session.athlete_id, exercise.id, sessionId);
    const own = records.filter((r) => r.exercise_id === exercise.id);
    views.push({
      sessionExercise,
      exercise,
      sets: sets
        .filter((s) => s.session_exercise_id === sessionExercise.id)
        .sort((a, b) => a.set_index - b.set_index),
      lastTime: previous.sets.map((set) => ({ ...set, date: previous.date ?? '' })),
      bestWeightKg: own.find((r) => r.record_type === 'weight')?.value ?? null,
      best1RM: own.find((r) => r.record_type === 'e1rm')?.value ?? null,
    });
  }

  return {
    session,
    workoutName: workout?.name ?? 'Entrenamiento',
    exercises: views,
    totalSets: sets.length,
    completedSets: sets.filter((s) => s.status === 'completed').length,
  };
}

/** Registra (o corrige) una serie. Idempotente: se puede reenviar sin duplicar. */
export async function logSet(athleteId: string, input: LogSetInput): Promise<SessionSetRow> {
  const [session] = await db().select('workout_sessions', { id: input.sessionId, athlete_id: athleteId });
  if (!session) throw new ServiceError('Esa sesión no es tuya.');
  if (session.status === 'completed') throw new ServiceError('La sesión ya está cerrada.');

  const [set] = await db().select('session_sets', { id: input.setId });
  if (!set) throw new ServiceError('Serie no encontrada.');
  const [sessionExercise] = await db().select('session_exercises', { id: set.session_exercise_id });
  if (!sessionExercise || sessionExercise.session_id !== session.id) {
    throw new ServiceError('Esa serie no pertenece a la sesión.');
  }

  const updated = await db().update('session_sets', set.id, {
    actual_reps: input.actualReps ?? null,
    actual_weight_kg: input.actualWeightKg ?? null,
    actual_duration_seconds: input.actualDurationSeconds ?? null,
    actual_distance_m: input.actualDistanceM ?? null,
    rpe: input.rpe ?? null,
    status: input.status,
    completed_at: input.status === 'completed' ? nowIso() : null,
  });
  if (!updated) throw new ServiceError('No se ha podido guardar la serie.');

  await recomputeVolume(session.id);
  return updated;
}

export async function setExerciseComment(
  athleteId: string,
  sessionExerciseId: string,
  comment: string | null,
  videoUrl?: string | null,
): Promise<void> {
  const [sessionExercise] = await db().select('session_exercises', { id: sessionExerciseId });
  if (!sessionExercise) throw new ServiceError('Ejercicio no encontrado.');
  const [session] = await db().select('workout_sessions', { id: sessionExercise.session_id, athlete_id: athleteId });
  if (!session) throw new ServiceError('Esa sesión no es tuya.');
  await db().update('session_exercises', sessionExerciseId, {
    athlete_comment: comment,
    ...(videoUrl !== undefined ? { video_url: videoUrl } : {}),
  });
}

async function recomputeVolume(sessionId: string): Promise<number> {
  const sessionExercises = await db().select('session_exercises', { session_id: sessionId });
  if (sessionExercises.length === 0) return 0;
  const sets = await db().select('session_sets', {
    session_exercise_id: { in: sessionExercises.map((se) => se.id) },
    status: 'completed',
  });
  const volume = sets.reduce((acc, set) => acc + setVolume(set.actual_weight_kg, set.actual_reps), 0);
  await db().update('workout_sessions', sessionId, { total_volume_kg: Math.round(volume) });
  return volume;
}

export interface FinishSummary {
  session: WorkoutSessionRow;
  durationSeconds: number;
  volumeKg: number;
  exerciseCount: number;
  setCount: number;
  loadAu: number | null;
  newRecords: { exerciseName: string; recordType: RecordType; value: number; reps: number | null }[];
}

/**
 * Cierra la sesión: calcula volumen, carga, detecta récords y avisa al
 * entrenador. Nada se marca como completado si la mutación no ocurre.
 */
export async function finishSession(athleteId: string, input: FinishSessionInput): Promise<FinishSummary> {
  const [session] = await db().select('workout_sessions', { id: input.sessionId, athlete_id: athleteId });
  if (!session) throw new ServiceError('Esa sesión no es tuya.');
  if (session.status === 'completed') throw new ServiceError('La sesión ya estaba cerrada.');

  const volume = await recomputeVolume(session.id);
  const load = trainingLoad(input.sessionRpe, input.durationSeconds);
  const completedAt = nowIso();

  const updated = await db().update('workout_sessions', session.id, {
    status: 'completed',
    completed_at: completedAt,
    duration_seconds: input.durationSeconds,
    session_rpe: input.sessionRpe,
    feeling: input.feeling,
    fatigue: input.fatigue,
    soreness: input.soreness,
    comment: input.comment ?? null,
    total_volume_kg: Math.round(volume),
    training_load_au: load,
  });
  if (!updated) throw new ServiceError('No se ha podido cerrar la sesión.');

  if (session.assignment_id) {
    await db().update('assignments', session.assignment_id, { status: 'completed' });
  }

  const newRecords = await detectPersonalRecords(athleteId, session.id, completedAt);
  const sessionExercises = await db().select('session_exercises', { session_id: session.id });
  const sets = sessionExercises.length
    ? await db().select('session_sets', {
        session_exercise_id: { in: sessionExercises.map((se) => se.id) },
        status: 'completed',
      })
    : [];

  await notifyCoach(athleteId, updated, newRecords.length);

  return {
    session: updated,
    durationSeconds: input.durationSeconds,
    volumeKg: Math.round(volume),
    exerciseCount: sessionExercises.length,
    setCount: sets.length,
    loadAu: load,
    newRecords,
  };
}

async function notifyCoach(athleteId: string, session: WorkoutSessionRow, recordCount: number): Promise<void> {
  const [link] = await db().select('coach_athletes', { athlete_id: athleteId, status: 'active' });
  if (!link) return;
  const [coach] = await db().select('coaches', { id: link.coach_id });
  const [athlete] = await db().select('athletes', { id: athleteId });
  if (!coach || !athlete) return;
  const [profile] = await db().select('profiles', { user_id: athlete.user_id });
  const name = profile ? fullName(profile.first_name, profile.last_name) : 'Un jugador';

  await notify(coach.user_id, {
    type: 'comment',
    title: `${name} ha completado su sesión`,
    body: `RPE ${session.session_rpe} · ${session.total_volume_kg} kg de volumen${
      recordCount > 0 ? ` · ${recordCount} récord(s)` : ''
    }`,
    link: `/coach/players/${athleteId}`,
  });
}

/**
 * Detecta récords personales de la sesión y los persiste.
 * Un récord sólo se guarda si supera estrictamente la marca anterior.
 */
async function detectPersonalRecords(
  athleteId: string,
  sessionId: string,
  achievedAt: string,
  notifyAthlete = true,
): Promise<FinishSummary['newRecords']> {
  const sessionExercises = await db().select('session_exercises', { session_id: sessionId });
  if (sessionExercises.length === 0) return [];
  const sets = await db().select('session_sets', {
    session_exercise_id: { in: sessionExercises.map((se) => se.id) },
    status: 'completed',
  });
  const exercises = await db().select('exercises', { id: { in: sessionExercises.map((se) => se.exercise_id) } });
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const existing = await db().select('personal_records', { athlete_id: athleteId });

  const created: FinishSummary['newRecords'] = [];

  for (const sessionExercise of sessionExercises) {
    const exercise = exerciseById.get(sessionExercise.exercise_id);
    if (!exercise) continue;
    const own = sets.filter((s) => s.session_exercise_id === sessionExercise.id);
    if (own.length === 0) continue;

    const candidates: { type: RecordType; value: number; reps: number | null; weight: number | null }[] = [];

    if (exercise.metric_type === 'strength') {
      const weighted = own.filter((s) => (s.actual_weight_kg ?? 0) > 0 && (s.actual_reps ?? 0) > 0);
      if (weighted.length > 0) {
        const bestWeight = weighted.reduce((best, s) =>
          (s.actual_weight_kg ?? 0) > (best.actual_weight_kg ?? 0) ? s : best,
        );
        candidates.push({
          type: 'weight',
          value: bestWeight.actual_weight_kg ?? 0,
          reps: bestWeight.actual_reps,
          weight: bestWeight.actual_weight_kg,
        });
        const best1rm = weighted.reduce(
          (best, s) => {
            const value = epley1RM(s.actual_weight_kg ?? 0, s.actual_reps ?? 0);
            return value > best.value ? { value, set: s } : best;
          },
          { value: 0, set: weighted[0] },
        );
        candidates.push({
          type: 'e1rm',
          value: best1rm.value,
          reps: best1rm.set.actual_reps,
          weight: best1rm.set.actual_weight_kg,
        });
      }
    } else if (exercise.metric_type === 'bodyweight' || exercise.metric_type === 'jump') {
      const best = own.reduce((acc, s) => Math.max(acc, s.actual_reps ?? 0), 0);
      if (best > 0) candidates.push({ type: 'reps', value: best, reps: best, weight: null });
    } else if (exercise.metric_type === 'distance') {
      const best = own.reduce((acc, s) => Math.max(acc, s.actual_distance_m ?? 0), 0);
      if (best > 0) candidates.push({ type: 'distance', value: best, reps: null, weight: null });
    }

    for (const candidate of candidates) {
      if (candidate.value <= 0) continue;
      const previous = existing.find(
        (record) => record.exercise_id === exercise.id && record.record_type === candidate.type,
      );
      if (previous && previous.value >= candidate.value) continue;

      const row: PersonalRecordRow = {
        id: newId(),
        athlete_id: athleteId,
        exercise_id: exercise.id,
        record_type: candidate.type,
        value: candidate.value,
        reps: candidate.reps,
        weight_kg: candidate.weight,
        achieved_at: achievedAt,
        session_id: sessionId,
      };
      if (previous) await db().remove('personal_records', previous.id);
      await db().insert('personal_records', row);

      // Sólo se anuncia el récord de peso/reps: el de 1RM estimado es derivado.
      if (candidate.type !== 'e1rm') {
        created.push({
          exerciseName: exercise.name,
          recordType: candidate.type,
          value: candidate.value,
          reps: candidate.reps,
        });
      }
    }
  }

  if (created.length > 0 && notifyAthlete) {
    const [athlete] = await db().select('athletes', { id: athleteId });
    if (athlete) {
      await notify(athlete.user_id, {
        type: 'record',
        title: created.length === 1 ? 'Nuevo récord personal' : `${created.length} récords personales`,
        body: created.map((r) => r.exerciseName).join(', '),
        link: '/player/progress',
      });
    }
  }
  return created;
}

/**
 * Reconstruye la tabla de récords a partir de todo el histórico completado.
 * Se usa al sembrar la demo y como reparación si los datos se desincronizan.
 */
export async function recomputeRecordsForAthlete(athleteId: string): Promise<void> {
  await db().removeWhere('personal_records', { athlete_id: athleteId });
  const sessions = await db().select(
    'workout_sessions',
    { athlete_id: athleteId, status: 'completed' },
    { orderBy: { column: 'completed_at' } },
  );
  for (const session of sessions) {
    await detectPersonalRecords(athleteId, session.id, session.completed_at ?? session.started_at, false);
  }
}

export async function abandonSession(athleteId: string, sessionId: string): Promise<void> {
  const [session] = await db().select('workout_sessions', { id: sessionId, athlete_id: athleteId });
  if (!session) throw new ServiceError('Esa sesión no es tuya.');
  await db().update('workout_sessions', sessionId, { status: 'skipped', completed_at: nowIso() });
  if (session.assignment_id) await db().update('assignments', session.assignment_id, { status: 'skipped' });
}

export async function recentSessions(athleteId: string, limit = 20): Promise<WorkoutSessionRow[]> {
  return db().select(
    'workout_sessions',
    { athlete_id: athleteId, status: 'completed' },
    { orderBy: { column: 'completed_at', ascending: false }, limit },
  );
}

export async function sessionsInRange(
  athleteIds: string[],
  from: string,
  to = todayKey(),
): Promise<WorkoutSessionRow[]> {
  if (athleteIds.length === 0) return [];
  const rows = await db().select('workout_sessions', { athlete_id: { in: athleteIds }, status: 'completed' });
  return rows.filter((row) => {
    const day = (row.completed_at ?? row.started_at).slice(0, 10);
    return day >= from && day <= to;
  });
}
