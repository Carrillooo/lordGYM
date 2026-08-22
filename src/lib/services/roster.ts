import 'server-only';
import { db } from '@/lib/db';
import { newId, normalizeCoachCode } from '@/lib/domain/ids';
import { addDays, nowIso, todayKey } from '@/lib/domain/datetime';
import { adherence, currentStreak } from '@/lib/domain/metrics';
import { fullName } from '@/lib/domain/labels';
import { ServiceError } from './accounts';
import { notify } from './notifications';
import type {
  AthleteRow,
  AthleteStatus,
  CoachAthleteRow,
  ProfileRow,
  WorkoutSessionRow,
} from '@/types/db';

export interface AthleteSummary {
  athlete: AthleteRow;
  profile: ProfileRow;
  status: AthleteStatus;
  statusReason: string | null;
  lastSessionAt: string | null;
  weeklyAssigned: number;
  weeklyCompleted: number;
  weeklyAdherence: number;
  streak: number;
  avgRpe: number | null;
  teamNames: string[];
}

/** Jugador pide unirse a un entrenador mediante su código. */
export async function requestLink(athleteId: string, rawCode: string): Promise<{ coachName: string }> {
  const code = normalizeCoachCode(rawCode);
  const [coach] = await db().select('coaches', { coach_code: code });
  if (!coach) throw new ServiceError('No existe ningún entrenador con ese código.');

  const [existing] = await db().select('coach_athletes', { coach_id: coach.id, athlete_id: athleteId });
  if (existing && existing.status === 'active') throw new ServiceError('Ya formas parte de ese equipo.');
  if (existing && existing.status === 'pending') throw new ServiceError('Tu solicitud ya está pendiente.');

  if (existing) {
    await db().update('coach_athletes', existing.id, {
      status: 'pending',
      requested_at: nowIso(),
      responded_at: null,
    });
  } else {
    const link: CoachAthleteRow = {
      id: newId(),
      coach_id: coach.id,
      athlete_id: athleteId,
      status: 'pending',
      requested_at: nowIso(),
      responded_at: null,
    };
    await db().insert('coach_athletes', link);
  }

  const [athlete] = await db().select('athletes', { id: athleteId });
  const [profile] = athlete ? await db().select('profiles', { user_id: athlete.user_id }) : [];
  const [coachProfile] = await db().select('profiles', { user_id: coach.user_id });

  if (profile) {
    await notify(coach.user_id, {
      type: 'link_request',
      title: 'Nueva solicitud de jugador',
      body: `${fullName(profile.first_name, profile.last_name)} quiere unirse a tu equipo.`,
      link: '/coach/players',
    });
  }

  return { coachName: coachProfile ? fullName(coachProfile.first_name, coachProfile.last_name) : 'tu entrenador' };
}

export async function respondToLink(
  coachId: string,
  linkId: string,
  decision: 'active' | 'rejected',
): Promise<void> {
  const [link] = await db().select('coach_athletes', { id: linkId, coach_id: coachId });
  if (!link) throw new ServiceError('Solicitud no encontrada.');
  await db().update('coach_athletes', linkId, { status: decision, responded_at: nowIso() });

  const [athlete] = await db().select('athletes', { id: link.athlete_id });
  if (!athlete) return;
  await notify(athlete.user_id, {
    type: 'link_request',
    title: decision === 'active' ? 'Solicitud aceptada' : 'Solicitud rechazada',
    body:
      decision === 'active'
        ? 'Ya formas parte del equipo. Tu entrenador puede asignarte sesiones.'
        : 'Tu entrenador no ha aceptado la solicitud.',
    link: '/player',
  });
}

export async function pendingRequests(coachId: string): Promise<{ link: CoachAthleteRow; profile: ProfileRow }[]> {
  const links = await db().select('coach_athletes', { coach_id: coachId, status: 'pending' });
  if (links.length === 0) return [];
  const athletes = await db().select('athletes', { id: { in: links.map((l) => l.athlete_id) } });
  const profiles = await db().select('profiles', { user_id: { in: athletes.map((a) => a.user_id) } });
  const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));

  return links.flatMap((link) => {
    const athlete = athletes.find((a) => a.id === link.athlete_id);
    const profile = athlete ? profileByUser.get(athlete.user_id) : undefined;
    return profile ? [{ link, profile }] : [];
  });
}

export async function activeAthleteIds(coachId: string): Promise<string[]> {
  const links = await db().select('coach_athletes', { coach_id: coachId, status: 'active' });
  return links.map((link) => link.athlete_id);
}

/** Entrenador vinculado a un jugador (el primero activo). */
export async function coachOfAthlete(athleteId: string) {
  const [link] = await db().select('coach_athletes', { athlete_id: athleteId, status: 'active' });
  if (!link) return null;
  const [coach] = await db().select('coaches', { id: link.coach_id });
  if (!coach) return null;
  const [profile] = await db().select('profiles', { user_id: coach.user_id });
  return profile ? { coach, profile } : null;
}

/**
 * Clasifica el estado del jugador a partir de su actividad reciente.
 * Es la base de la sección «Jugadores que requieren atención» del dashboard.
 */
function classify(input: {
  lastSessionAt: string | null;
  missedRecently: number;
  avgRpe: number | null;
  maxPain: number | null;
  avgFatigue: number | null;
}): { status: AthleteStatus; reason: string | null } {
  const { lastSessionAt, missedRecently, avgRpe, maxPain, avgFatigue } = input;

  if (maxPain !== null && maxPain >= 7) {
    return { status: 'attention', reason: `Dolor reportado ${maxPain}/10.` };
  }
  if (missedRecently >= 3) {
    return { status: 'attention', reason: `${missedRecently} entrenamientos sin completar.` };
  }
  const daysSince = lastSessionAt
    ? Math.floor((Date.now() - Date.parse(lastSessionAt)) / 86_400_000)
    : null;
  if (daysSince !== null && daysSince >= 7) {
    return { status: 'inactive', reason: `Sin entrenar desde hace ${daysSince} días.` };
  }
  if (avgRpe !== null && avgRpe >= 8.5) {
    return { status: 'fatigue', reason: `RPE medio elevado (${avgRpe.toFixed(1)}) en las últimas sesiones.` };
  }
  if (avgFatigue !== null && avgFatigue >= 4.2) {
    return { status: 'fatigue', reason: 'Fatiga alta en los check-ins recientes.' };
  }
  if (lastSessionAt === null) {
    return { status: 'inactive', reason: 'Todavía no ha completado ninguna sesión.' };
  }
  return { status: 'active', reason: null };
}

export async function getRoster(coachId: string, today = todayKey()): Promise<AthleteSummary[]> {
  const athleteIds = await activeAthleteIds(coachId);
  if (athleteIds.length === 0) return [];

  const athletes = await db().select('athletes', { id: { in: athleteIds } });
  const profiles = await db().select('profiles', { user_id: { in: athletes.map((a) => a.user_id) } });
  const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));

  const weekStart = addDays(today, -6);
  const [assignments, sessions, painLogs, wellnessLogs, teams, teamMembers] = await Promise.all([
    db().select('assignments', { athlete_id: { in: athleteIds } }),
    db().select('workout_sessions', { athlete_id: { in: athleteIds }, status: 'completed' }),
    db().select('pain_logs', { athlete_id: { in: athleteIds }, date: { gte: addDays(today, -10) } }),
    db().select('wellness_logs', { athlete_id: { in: athleteIds }, date: { gte: addDays(today, -7) } }),
    db().select('teams', { coach_id: coachId }),
    db().select('team_members', {}),
  ]);

  const teamById = new Map(teams.map((t) => [t.id, t]));

  return athletes
    .map((athlete): AthleteSummary | null => {
      const profile = profileByUser.get(athlete.user_id);
      if (!profile) return null;

      const own = assignments.filter((a) => a.athlete_id === athlete.id);
      const weekly = own.filter((a) => a.scheduled_date >= weekStart && a.scheduled_date <= today);
      const weeklyCompleted = weekly.filter((a) => a.status === 'completed').length;
      const missedRecently = own.filter(
        (a) => a.scheduled_date < today && a.scheduled_date >= addDays(today, -14) && a.status !== 'completed',
      ).length;

      const ownSessions = sessions
        .filter((s) => s.athlete_id === athlete.id)
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
      const recentRpes = ownSessions
        .slice(0, 3)
        .map((s) => s.session_rpe)
        .filter((v): v is number => typeof v === 'number');
      const avgRpe = recentRpes.length > 0 ? recentRpes.reduce((a, b) => a + b, 0) / recentRpes.length : null;

      const pains = painLogs.filter((p) => p.athlete_id === athlete.id).map((p) => p.intensity);
      const fatigues = wellnessLogs.filter((w) => w.athlete_id === athlete.id).map((w) => w.fatigue);

      const { status, reason } = classify({
        lastSessionAt: ownSessions[0]?.completed_at ?? null,
        missedRecently,
        avgRpe,
        maxPain: pains.length > 0 ? Math.max(...pains) : null,
        avgFatigue: fatigues.length > 0 ? fatigues.reduce((a, b) => a + b, 0) / fatigues.length : null,
      });

      const teamNames = teamMembers
        .filter((m) => m.athlete_id === athlete.id)
        .flatMap((m) => {
          const team = teamById.get(m.team_id);
          return team ? [team.name] : [];
        });

      return {
        athlete,
        profile,
        status,
        statusReason: reason,
        lastSessionAt: ownSessions[0]?.completed_at ?? null,
        weeklyAssigned: weekly.length,
        weeklyCompleted,
        weeklyAdherence: adherence(weeklyCompleted, weekly.length),
        streak: currentStreak(
          ownSessions.map((s: WorkoutSessionRow) => (s.completed_at ?? '').slice(0, 10)).filter(Boolean),
          today,
        ),
        avgRpe: avgRpe === null ? null : Math.round(avgRpe * 10) / 10,
        teamNames,
      };
    })
    .filter((row): row is AthleteSummary => row !== null)
    .sort((a, b) => fullName(a.profile.first_name, a.profile.last_name).localeCompare(
      fullName(b.profile.first_name, b.profile.last_name),
    ));
}

export async function getAthleteForCoach(coachId: string, athleteId: string) {
  const [link] = await db().select('coach_athletes', {
    coach_id: coachId,
    athlete_id: athleteId,
    status: 'active',
  });
  if (!link) return null;
  const [athlete] = await db().select('athletes', { id: athleteId });
  if (!athlete) return null;
  const [profile] = await db().select('profiles', { user_id: athlete.user_id });
  return profile ? { athlete, profile, link } : null;
}

// --- Equipos (§54) ---------------------------------------------------------

export async function createTeam(coachId: string, name: string, sport?: string, category?: string) {
  const team = {
    id: newId(),
    coach_id: coachId,
    name,
    sport: sport ?? null,
    category: category ?? null,
    created_at: nowIso(),
  };
  await db().insert('teams', team);
  return team;
}

export async function setTeamMembers(coachId: string, teamId: string, athleteIds: string[]) {
  const [team] = await db().select('teams', { id: teamId, coach_id: coachId });
  if (!team) throw new ServiceError('Equipo no encontrado.');
  const allowed = new Set(await activeAthleteIds(coachId));
  await db().removeWhere('team_members', { team_id: teamId });
  const rows = athleteIds
    .filter((id) => allowed.has(id))
    .map((athleteId) => ({ id: newId(), team_id: teamId, athlete_id: athleteId, created_at: nowIso() }));
  await db().insertMany('team_members', rows);
}

export async function listTeams(coachId: string) {
  const teams = await db().select('teams', { coach_id: coachId }, { orderBy: { column: 'name' } });
  if (teams.length === 0) return [];
  const members = await db().select('team_members', { team_id: { in: teams.map((t) => t.id) } });
  return teams.map((team) => ({
    team,
    athleteIds: members.filter((m) => m.team_id === team.id).map((m) => m.athlete_id),
  }));
}
