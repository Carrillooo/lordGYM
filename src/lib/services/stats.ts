import 'server-only';
import { db } from '@/lib/db';
import { addDays, dateRange, startOfWeek, todayKey } from '@/lib/domain/datetime';
import { adherence, round } from '@/lib/domain/metrics';
import { activeAthleteIds } from './roster';

export interface CoachDashboardStats {
  activeAthletes: number;
  pendingRequests: number;
  trainingToday: number;
  weeklyCompleted: number;
  weeklyAssigned: number;
  compliancePercent: number;
  weeklyLoadSeries: { date: string; label: string; value: number }[];
  avgRpe: number | null;
  totalRecordsThisMonth: number;
  skippedThisWeek: number;
  avgLoadPerSession: number | null;
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export async function coachDashboardStats(coachId: string, today = todayKey()): Promise<CoachDashboardStats> {
  const athleteIds = await activeAthleteIds(coachId);
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const monthStart = `${today.slice(0, 7)}-01`;

  const [pending, assignments, sessions, records] = await Promise.all([
    db().select('coach_athletes', { coach_id: coachId, status: 'pending' }),
    athleteIds.length ? db().select('assignments', { athlete_id: { in: athleteIds } }) : Promise.resolve([]),
    athleteIds.length
      ? db().select('workout_sessions', { athlete_id: { in: athleteIds }, status: 'completed' })
      : Promise.resolve([]),
    athleteIds.length ? db().select('personal_records', { athlete_id: { in: athleteIds } }) : Promise.resolve([]),
  ]);

  const weeklyAssignments = assignments.filter(
    (a) => a.scheduled_date >= weekStart && a.scheduled_date <= weekEnd,
  );
  const weeklyCompleted = weeklyAssignments.filter((a) => a.status === 'completed').length;

  const loadByDate = new Map<string, number>();
  const weekRpes: number[] = [];
  const weekLoads: number[] = [];
  for (const session of sessions) {
    const day = (session.completed_at ?? session.started_at).slice(0, 10);
    if (day < weekStart || day > weekEnd) continue;
    loadByDate.set(day, (loadByDate.get(day) ?? 0) + (session.training_load_au ?? 0));
    if (typeof session.session_rpe === 'number') weekRpes.push(session.session_rpe);
    if (typeof session.training_load_au === 'number') weekLoads.push(session.training_load_au);
  }

  return {
    activeAthletes: athleteIds.length,
    pendingRequests: pending.length,
    trainingToday: new Set(
      assignments.filter((a) => a.scheduled_date === today).map((a) => a.athlete_id),
    ).size,
    weeklyCompleted,
    weeklyAssigned: weeklyAssignments.length,
    compliancePercent: adherence(weeklyCompleted, weeklyAssignments.length),
    weeklyLoadSeries: dateRange(weekStart, weekEnd).map((date, index) => ({
      date,
      label: WEEKDAY_LABELS[index],
      value: Math.round(loadByDate.get(date) ?? 0),
    })),
    avgRpe: weekRpes.length > 0 ? round(weekRpes.reduce((a, b) => a + b, 0) / weekRpes.length, 1) : null,
    totalRecordsThisMonth: records.filter(
      (r) => r.record_type !== 'e1rm' && r.achieved_at.slice(0, 10) >= monthStart,
    ).length,
    skippedThisWeek: weeklyAssignments.filter((a) => a.status === 'skipped').length,
    avgLoadPerSession:
      weekLoads.length > 0 ? Math.round(weekLoads.reduce((a, b) => a + b, 0) / weekLoads.length) : null,
  };
}

export interface AthleteComparisonRow {
  athleteId: string;
  name: string;
  sessions: number;
  adherencePercent: number;
  volumeKg: number;
  loadAu: number;
  avgRpe: number | null;
  records: number;
}

/** Comparativa entre jugadores del equipo (§41), visible sólo para el entrenador. */
export async function compareAthletes(
  coachId: string,
  days = 28,
  today = todayKey(),
): Promise<AthleteComparisonRow[]> {
  const athleteIds = await activeAthleteIds(coachId);
  if (athleteIds.length === 0) return [];
  const from = addDays(today, -days);

  const [athletes, sessions, assignments, records] = await Promise.all([
    db().select('athletes', { id: { in: athleteIds } }),
    db().select('workout_sessions', { athlete_id: { in: athleteIds }, status: 'completed' }),
    db().select('assignments', { athlete_id: { in: athleteIds }, scheduled_date: { gte: from, lte: today } }),
    db().select('personal_records', { athlete_id: { in: athleteIds } }),
  ]);
  const profiles = await db().select('profiles', { user_id: { in: athletes.map((a) => a.user_id) } });

  return athletes
    .map((athlete): AthleteComparisonRow => {
      const profile = profiles.find((p) => p.user_id === athlete.user_id);
      const own = sessions.filter((s) => {
        const day = (s.completed_at ?? s.started_at).slice(0, 10);
        return s.athlete_id === athlete.id && day >= from && day <= today;
      });
      const ownAssignments = assignments.filter((a) => a.athlete_id === athlete.id);
      const rpes = own.map((s) => s.session_rpe).filter((v): v is number => typeof v === 'number');

      return {
        athleteId: athlete.id,
        name: profile ? `${profile.first_name} ${profile.last_name}` : 'Jugador',
        sessions: own.length,
        adherencePercent: adherence(
          ownAssignments.filter((a) => a.status === 'completed').length,
          ownAssignments.length,
        ),
        volumeKg: Math.round(own.reduce((acc, s) => acc + s.total_volume_kg, 0)),
        loadAu: own.reduce((acc, s) => acc + (s.training_load_au ?? 0), 0),
        avgRpe: rpes.length > 0 ? round(rpes.reduce((a, b) => a + b, 0) / rpes.length, 1) : null,
        records: records.filter(
          (r) => r.athlete_id === athlete.id && r.record_type !== 'e1rm' && r.achieved_at.slice(0, 10) >= from,
        ).length,
      };
    })
    .sort((a, b) => b.adherencePercent - a.adherencePercent);
}
