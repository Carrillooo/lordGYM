import 'server-only';
import { db } from '@/lib/db';
import { addDays, todayKey } from '@/lib/domain/datetime';
import { acuteChronicRatio, round } from '@/lib/domain/metrics';
import { fullName } from '@/lib/domain/labels';
import { activeAthleteIds } from './roster';

export type AlertSeverity = 'info' | 'warning' | 'danger';

export interface CoachAlert {
  id: string;
  athleteId: string;
  athleteName: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
}

/**
 * Alertas automáticas (§52). Son señales de seguimiento, nunca un diagnóstico
 * ni una indicación médica: el entrenador decide qué hacer con ellas.
 */
export async function coachAlerts(coachId: string, today = todayKey()): Promise<CoachAlert[]> {
  const athleteIds = await activeAthleteIds(coachId);
  if (athleteIds.length === 0) return [];

  const [athletes, sessions, assignments, painLogs, wellnessLogs] = await Promise.all([
    db().select('athletes', { id: { in: athleteIds } }),
    db().select('workout_sessions', { athlete_id: { in: athleteIds }, status: 'completed' }),
    db().select('assignments', { athlete_id: { in: athleteIds } }),
    db().select('pain_logs', { athlete_id: { in: athleteIds }, date: { gte: addDays(today, -10) } }),
    db().select('wellness_logs', { athlete_id: { in: athleteIds }, date: { gte: addDays(today, -7) } }),
  ]);
  const profiles = await db().select('profiles', { user_id: { in: athletes.map((a) => a.user_id) } });
  const nameByAthlete = new Map(
    athletes.map((athlete) => {
      const profile = profiles.find((p) => p.user_id === athlete.user_id);
      return [athlete.id, profile ? fullName(profile.first_name, profile.last_name) : 'Jugador'];
    }),
  );

  const alerts: CoachAlert[] = [];
  const push = (athleteId: string, severity: AlertSeverity, title: string, detail: string) => {
    alerts.push({
      id: `${athleteId}:${title}`,
      athleteId,
      athleteName: nameByAthlete.get(athleteId) ?? 'Jugador',
      severity,
      title,
      detail,
    });
  };

  for (const athleteId of athleteIds) {
    const own = sessions
      .filter((s) => s.athlete_id === athleteId)
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));

    // RPE elevado sostenido.
    const lastThree = own.slice(0, 3).map((s) => s.session_rpe).filter((v): v is number => typeof v === 'number');
    if (lastThree.length === 3 && lastThree.every((rpe) => rpe >= 8.5)) {
      push(
        athleteId,
        'warning',
        'RPE elevado',
        `RPE ≥ 8,5 en las últimas 3 sesiones (${lastThree.map((r) => r.toString().replace('.', ',')).join(' · ')}).`,
      );
    }

    // Sesiones sin completar.
    const missed = assignments.filter(
      (a) =>
        a.athlete_id === athleteId &&
        a.scheduled_date < today &&
        a.scheduled_date >= addDays(today, -14) &&
        a.status !== 'completed',
    );
    if (missed.length >= 3) {
      push(athleteId, 'danger', 'Adherencia baja', `${missed.length} entrenamientos sin completar en 14 días.`);
    }

    // Días sin entrenar.
    const lastDate = own[0]?.completed_at?.slice(0, 10) ?? null;
    const daysSince = lastDate ? Math.abs(Number(new Date(`${today}T12:00:00Z`).getTime() - new Date(`${lastDate}T12:00:00Z`).getTime()) / 86_400_000) : null;
    if (daysSince !== null && daysSince >= 4) {
      push(athleteId, 'warning', 'Sin actividad', `No completa entrenamiento desde hace ${Math.round(daysSince)} días.`);
    }

    // Dolor reportado alto.
    const pains = painLogs.filter((p) => p.athlete_id === athleteId && p.intensity >= 7);
    if (pains.length > 0) {
      const worst = pains.reduce((best, p) => (p.intensity > best.intensity ? p : best));
      push(
        athleteId,
        'danger',
        'Dolor elevado',
        `${worst.body_part} (${worst.side}) · ${worst.intensity}/10 el ${worst.date}.`,
      );
    }

    // Fatiga en los check-ins.
    const fatigue = wellnessLogs.filter((w) => w.athlete_id === athleteId).map((w) => w.fatigue);
    if (fatigue.length >= 3 && fatigue.reduce((a, b) => a + b, 0) / fatigue.length >= 4.2) {
      push(athleteId, 'warning', 'Fatiga acumulada', 'Fatiga ≥ 4/5 de media en los check-ins de la última semana.');
    }

    // Pico de carga (ratio agudo:crónico).
    const acwr = acuteChronicRatio(
      own.map((s) => ({ date: (s.completed_at ?? s.started_at).slice(0, 10), load: s.training_load_au ?? 0 })),
      today,
    );
    if (acwr !== null && acwr >= 1.5) {
      push(
        athleteId,
        'warning',
        'Carga semanal elevada',
        `Ratio agudo:crónico ${acwr.toString().replace('.', ',')} (referencia ≤ 1,3).`,
      );
    }

    // Caída de rendimiento en volumen.
    if (own.length >= 4) {
      const recent = own.slice(0, 2).reduce((acc, s) => acc + s.total_volume_kg, 0) / 2;
      const previous = own.slice(2, 4).reduce((acc, s) => acc + s.total_volume_kg, 0) / 2;
      if (previous > 0 && recent < previous * 0.7) {
        push(
          athleteId,
          'info',
          'Descenso de volumen',
          `Volumen medio ${round(((recent - previous) / previous) * 100, 0)}% respecto a las sesiones anteriores.`,
        );
      }
    }
  }

  const order: Record<AlertSeverity, number> = { danger: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
