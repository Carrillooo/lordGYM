import 'server-only';
import { db } from '@/lib/db';
import { newId } from '@/lib/domain/ids';
import { addDays, nowIso, todayKey } from '@/lib/domain/datetime';
import type { BodyweightLogRow, PainLogRow, WellnessLogRow } from '@/types/db';
import type { z } from 'zod';
import type { bodyweightSchema, painSchema, wellnessSchema } from '@/lib/validation/schemas';

type WellnessInput = z.infer<typeof wellnessSchema>;
type PainInput = z.infer<typeof painSchema>;
type BodyweightInput = z.infer<typeof bodyweightSchema>;

/** Check-in diario. Un registro por día: reenviar actualiza en lugar de duplicar. */
export async function saveWellness(athleteId: string, input: WellnessInput): Promise<WellnessLogRow> {
  const [existing] = await db().select('wellness_logs', { athlete_id: athleteId, date: input.date });
  const payload = {
    sleep: input.sleep,
    energy: input.energy,
    stress: input.stress,
    fatigue: input.fatigue,
    soreness: input.soreness,
    motivation: input.motivation,
    note: input.note ?? null,
  };
  if (existing) {
    const updated = await db().update('wellness_logs', existing.id, payload);
    return updated ?? existing;
  }
  const row: WellnessLogRow = {
    id: newId(),
    athlete_id: athleteId,
    date: input.date,
    ...payload,
    created_at: nowIso(),
  };
  await db().insert('wellness_logs', row);
  return row;
}

export async function wellnessHistory(athleteId: string, days = 30, today = todayKey()): Promise<WellnessLogRow[]> {
  return db().select(
    'wellness_logs',
    { athlete_id: athleteId, date: { gte: addDays(today, -days) } },
    { orderBy: { column: 'date' } },
  );
}

export async function wellnessToday(athleteId: string, today = todayKey()): Promise<WellnessLogRow | null> {
  const [row] = await db().select('wellness_logs', { athlete_id: athleteId, date: today });
  return row ?? null;
}

export async function savePain(athleteId: string, input: PainInput): Promise<PainLogRow> {
  const row: PainLogRow = {
    id: newId(),
    athlete_id: athleteId,
    date: input.date,
    body_part: input.bodyPart,
    side: input.side,
    intensity: input.intensity,
    note: input.note ?? null,
    created_at: nowIso(),
  };
  await db().insert('pain_logs', row);
  return row;
}

export async function painHistory(athleteId: string, days = 60, today = todayKey()): Promise<PainLogRow[]> {
  return db().select(
    'pain_logs',
    { athlete_id: athleteId, date: { gte: addDays(today, -days) } },
    { orderBy: { column: 'date', ascending: false } },
  );
}

export async function deletePain(athleteId: string, painId: string): Promise<void> {
  const [row] = await db().select('pain_logs', { id: painId, athlete_id: athleteId });
  if (row) await db().remove('pain_logs', painId);
}

export async function saveBodyweight(athleteId: string, input: BodyweightInput): Promise<BodyweightLogRow> {
  const [existing] = await db().select('bodyweight_logs', { athlete_id: athleteId, date: input.date });
  if (existing) {
    const updated = await db().update('bodyweight_logs', existing.id, { weight_kg: input.weightKg });
    return updated ?? existing;
  }
  const row: BodyweightLogRow = {
    id: newId(),
    athlete_id: athleteId,
    date: input.date,
    weight_kg: input.weightKg,
  };
  await db().insert('bodyweight_logs', row);
  // El peso corporal también se refleja en la ficha deportiva.
  await db().update('athletes', athleteId, { weight_kg: input.weightKg });
  return row;
}
