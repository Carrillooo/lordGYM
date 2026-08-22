import 'server-only';
import { todayKey } from '@/lib/domain/datetime';
import { getRoster, type AthleteSummary } from './roster';

/** Estado calculado de un único jugador, reutilizando la lógica del roster. */
export async function getRosterStatus(
  coachId: string,
  athleteId: string,
  today = todayKey(),
): Promise<AthleteSummary | null> {
  const roster = await getRoster(coachId, today);
  return roster.find((entry) => entry.athlete.id === athleteId) ?? null;
}
