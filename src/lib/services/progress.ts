import 'server-only';
import { db } from '@/lib/db';
import { addDays, dateRange, startOfWeek, todayKey } from '@/lib/domain/datetime';
import {
  acuteChronicRatio,
  adherence,
  currentStreak,
  epley1RM,
  round,
  setVolume,
  suggestProgression,
} from '@/lib/domain/metrics';
import type { ExerciseMetric } from '@/lib/domain/exercise-metrics';
import type { ExerciseRow, PersonalRecordRow, SessionSetRow, WorkoutSessionRow } from '@/types/db';

export interface ExerciseHistoryPoint {
  date: string;
  sessionId: string;
  maxWeightKg: number | null;
  volumeKg: number;
  e1rm: number | null;
  totalReps: number;
  avgRpe: number | null;
  bestSet: { weightKg: number | null; reps: number | null } | null;
}

/** Serie histórica de un ejercicio para el jugador indicado (§11, §71). */
export async function exerciseHistory(athleteId: string, exerciseId: string): Promise<ExerciseHistoryPoint[]> {
  const sessions = await db().select('workout_sessions', { athlete_id: athleteId, status: 'completed' });
  if (sessions.length === 0) return [];

  const sessionExercises = await db().select('session_exercises', {
    session_id: { in: sessions.map((s) => s.id) },
    exercise_id: exerciseId,
  });
  if (sessionExercises.length === 0) return [];

  const sets = await db().select('session_sets', {
    session_exercise_id: { in: sessionExercises.map((se) => se.id) },
    status: 'completed',
  });

  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  return sessionExercises
    .flatMap((sessionExercise) => {
      const session = sessionById.get(sessionExercise.session_id);
      if (!session) return [];
      const own = sets.filter((s) => s.session_exercise_id === sessionExercise.id);
      if (own.length === 0) return [];
      return [buildPoint(session, own)];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildPoint(session: WorkoutSessionRow, sets: SessionSetRow[]): ExerciseHistoryPoint {
  const weights = sets.map((s) => s.actual_weight_kg ?? 0).filter((w) => w > 0);
  const rpes = sets.map((s) => s.rpe).filter((v): v is number => typeof v === 'number');
  const best = sets.reduce<{ set: SessionSetRow | null; value: number }>(
    (acc, set) => {
      const value = epley1RM(set.actual_weight_kg ?? 0, set.actual_reps ?? 0);
      return value > acc.value ? { set, value } : acc;
    },
    { set: null, value: 0 },
  );

  return {
    date: (session.completed_at ?? session.started_at).slice(0, 10),
    sessionId: session.id,
    maxWeightKg: weights.length > 0 ? Math.max(...weights) : null,
    volumeKg: round(sets.reduce((acc, set) => acc + setVolume(set.actual_weight_kg, set.actual_reps), 0), 1),
    e1rm: best.value > 0 ? best.value : null,
    totalReps: sets.reduce((acc, set) => acc + (set.actual_reps ?? 0), 0),
    avgRpe: rpes.length > 0 ? round(rpes.reduce((a, b) => a + b, 0) / rpes.length, 1) : null,
    bestSet: best.set ? { weightKg: best.set.actual_weight_kg, reps: best.set.actual_reps } : null,
  };
}

export function pickMetric(point: ExerciseHistoryPoint, metric: ExerciseMetric): number | null {
  switch (metric) {
    case 'max_weight':
      return point.maxWeightKg;
    case 'volume':
      return point.volumeKg;
    case 'e1rm':
      return point.e1rm;
    case 'reps':
      return point.totalReps;
    case 'rpe':
      return point.avgRpe;
    default:
      return null;
  }
}

/** Ejercicios que el jugador ha realizado alguna vez (para el selector). */
export async function trainedExercises(athleteId: string): Promise<ExerciseRow[]> {
  const sessions = await db().select('workout_sessions', { athlete_id: athleteId, status: 'completed' });
  if (sessions.length === 0) return [];
  const sessionExercises = await db().select('session_exercises', { session_id: { in: sessions.map((s) => s.id) } });
  const ids = [...new Set(sessionExercises.map((se) => se.exercise_id))];
  if (ids.length === 0) return [];
  const exercises = await db().select('exercises', { id: { in: ids } });
  return exercises.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export interface RecordView {
  record: PersonalRecordRow;
  exerciseName: string;
}

export async function personalRecords(athleteId: string): Promise<RecordView[]> {
  const records = await db().select('personal_records', { athlete_id: athleteId });
  if (records.length === 0) return [];
  const exercises = await db().select('exercises', { id: { in: records.map((r) => r.exercise_id) } });
  const nameById = new Map(exercises.map((e) => [e.id, e.name]));
  return records
    .filter((record) => record.record_type !== 'e1rm')
    .map((record) => ({ record, exerciseName: nameById.get(record.exercise_id) ?? 'Ejercicio' }))
    .sort((a, b) => b.record.achieved_at.localeCompare(a.record.achieved_at));
}

export interface DailyPoint {
  date: string;
  value: number;
}

/** Carga diaria (AU) de los últimos `days` días, incluyendo días sin entrenar. */
export async function loadSeries(athleteId: string, days = 28, today = todayKey()): Promise<DailyPoint[]> {
  const from = addDays(today, -(days - 1));
  const sessions = await db().select('workout_sessions', { athlete_id: athleteId, status: 'completed' });
  const byDate = new Map<string, number>();
  for (const session of sessions) {
    const day = (session.completed_at ?? session.started_at).slice(0, 10);
    if (day < from || day > today) continue;
    byDate.set(day, (byDate.get(day) ?? 0) + (session.training_load_au ?? 0));
  }
  return dateRange(from, today).map((date) => ({ date, value: byDate.get(date) ?? 0 }));
}

export async function weeklyLoadSeries(athleteId: string, weeks = 8, today = todayKey()): Promise<DailyPoint[]> {
  const daily = await loadSeries(athleteId, weeks * 7, today);
  const byWeek = new Map<string, number>();
  for (const point of daily) {
    const week = startOfWeek(point.date);
    byWeek.set(week, (byWeek.get(week) ?? 0) + point.value);
  }
  return [...byWeek.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
}

export async function volumeSeries(athleteId: string, weeks = 8, today = todayKey()): Promise<DailyPoint[]> {
  const from = addDays(startOfWeek(today), -(weeks - 1) * 7);
  const sessions = await db().select('workout_sessions', { athlete_id: athleteId, status: 'completed' });
  const byWeek = new Map<string, number>();
  for (const session of sessions) {
    const day = (session.completed_at ?? session.started_at).slice(0, 10);
    if (day < from || day > today) continue;
    const week = startOfWeek(day);
    byWeek.set(week, (byWeek.get(week) ?? 0) + session.total_volume_kg);
  }
  return dateRange(from, today)
    .filter((date) => date === startOfWeek(date))
    .map((date) => ({ date, value: Math.round(byWeek.get(date) ?? 0) }));
}

export async function bodyweightSeries(athleteId: string): Promise<DailyPoint[]> {
  const rows = await db().select('bodyweight_logs', { athlete_id: athleteId }, { orderBy: { column: 'date' } });
  return rows.map((row) => ({ date: row.date, value: row.weight_kg }));
}

export interface AthleteOverview {
  completedSessions: number;
  pendingSessions: number;
  weeklyAssigned: number;
  weeklyCompleted: number;
  adherencePercent: number;
  weeklyLoadAu: number;
  totalVolumeKg: number;
  avgRpe: number | null;
  recordCount: number;
  streak: number;
  latestWeightKg: number | null;
  acwr: number | null;
  avgFatigue: number | null;
  avgSoreness: number | null;
  avgSleep: number | null;
}

export async function athleteOverview(athleteId: string, today = todayKey()): Promise<AthleteOverview> {
  const weekStart = startOfWeek(today);
  const [sessions, assignments, records, weights, wellness] = await Promise.all([
    db().select('workout_sessions', { athlete_id: athleteId }),
    db().select('assignments', { athlete_id: athleteId }),
    db().select('personal_records', { athlete_id: athleteId }),
    db().select('bodyweight_logs', { athlete_id: athleteId }, { orderBy: { column: 'date', ascending: false }, limit: 1 }),
    db().select('wellness_logs', { athlete_id: athleteId, date: { gte: addDays(today, -7) } }),
  ]);

  const completed = sessions.filter((s) => s.status === 'completed');
  const weeklyAssignments = assignments.filter((a) => a.scheduled_date >= weekStart && a.scheduled_date <= today);
  const weeklySessions = completed.filter((s) => {
    const day = (s.completed_at ?? s.started_at).slice(0, 10);
    return day >= weekStart && day <= today;
  });
  const rpes = completed.map((s) => s.session_rpe).filter((v): v is number => typeof v === 'number');
  const average = (values: number[]) =>
    values.length > 0 ? round(values.reduce((a, b) => a + b, 0) / values.length, 1) : null;

  return {
    completedSessions: completed.length,
    pendingSessions: assignments.filter((a) => a.status === 'assigned' && a.scheduled_date >= today).length,
    weeklyAssigned: weeklyAssignments.length,
    weeklyCompleted: weeklyAssignments.filter((a) => a.status === 'completed').length,
    adherencePercent: adherence(
      assignments.filter((a) => a.status === 'completed').length,
      assignments.filter((a) => a.scheduled_date <= today).length,
    ),
    weeklyLoadAu: weeklySessions.reduce((acc, s) => acc + (s.training_load_au ?? 0), 0),
    totalVolumeKg: Math.round(completed.reduce((acc, s) => acc + s.total_volume_kg, 0)),
    avgRpe: average(rpes.slice(-10)),
    recordCount: records.filter((r) => r.record_type !== 'e1rm').length,
    streak: currentStreak(
      completed.map((s) => (s.completed_at ?? s.started_at).slice(0, 10)),
      today,
    ),
    latestWeightKg: weights[0]?.weight_kg ?? null,
    acwr: acuteChronicRatio(
      completed.map((s) => ({
        date: (s.completed_at ?? s.started_at).slice(0, 10),
        load: s.training_load_au ?? 0,
      })),
      today,
    ),
    avgFatigue: average(wellness.map((w) => w.fatigue)),
    avgSoreness: average(wellness.map((w) => w.soreness)),
    avgSleep: average(wellness.map((w) => w.sleep)),
  };
}

/** Comparación semana anterior vs semana actual de un ejercicio (§72). */
export function compareLastTwo(points: ExerciseHistoryPoint[], metric: ExerciseMetric) {
  if (points.length < 2) return null;
  const current = pickMetric(points[points.length - 1], metric);
  const previous = pickMetric(points[points.length - 2], metric);
  if (current === null || previous === null || previous === 0) return null;
  return {
    previous,
    current,
    changePercent: round(((current - previous) / previous) * 100, 1),
  };
}

export interface ProgressionSuggestion {
  exerciseName: string;
  lastWeightKg: number;
  suggestedWeightKg: number;
  shouldIncrease: boolean;
  reason: string;
}

/**
 * Sugerencia de progresión para un ejercicio (§69, §70).
 *
 * Es explícitamente una *sugerencia*: LORDGYM no cambia nada solo, y la
 * interfaz deja claro que la última decisión es del entrenador. Tampoco
 * constituye una indicación médica.
 */
export async function progressionSuggestion(
  athleteId: string,
  exerciseId: string,
): Promise<ProgressionSuggestion | null> {
  const history = await exerciseHistory(athleteId, exerciseId);
  if (history.length === 0) return null;

  const last = history[history.length - 1];
  if (last.maxWeightKg === null || last.maxWeightKg <= 0) return null;

  const [exercise] = await db().select('exercises', { id: exerciseId });
  if (!exercise || exercise.metric_type !== 'strength') return null;

  const recentRpes = [...history]
    .reverse()
    .map((point) => point.avgRpe)
    .filter((value): value is number => typeof value === 'number');

  const result = suggestProgression({ lastWeightKg: last.maxWeightKg, recentSessionRpes: recentRpes });
  return {
    exerciseName: exercise.name,
    lastWeightKg: last.maxWeightKg,
    suggestedWeightKg: result.suggestedWeightKg,
    shouldIncrease: result.shouldIncrease,
    reason: result.reason,
  };
}
