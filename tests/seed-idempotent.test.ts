import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Arrancar la app no puede borrar entrenamientos.
 *
 * El sembrado corre en cada arranque —tiene que hacerlo, es lo que repone la
 * cuenta del entrenador si algo la dejó fuera— y por eso todo lo que hace en un
 * arranque normal debe ser puramente aditivo: crear lo que falte y nada más.
 *
 * Este test existe porque la red de seguridad que se puso para no quedarse sin
 * acceso arrastró consigo la limpieza del historial de demostración. El
 * resultado era que cada reinicio del servidor —cada despliegue en Vercel—
 * dejaba al jugador sin sus sesiones, sus récords y sus asignaciones.
 */

let dataDir: string;

beforeAll(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lordgym-seed-'));
  process.env.LORDGYM_DATA_FILE = path.join(dataDir, 'db.json');
  process.env.LORDGYM_DB_DRIVER = 'local';
});

afterAll(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe('arranques sucesivos', () => {
  it('no se llevan por delante el historial del jugador', async () => {
    const { db } = await import('@/lib/db');
    const { newId } = await import('@/lib/domain/ids');
    const { nowIso, todayKey } = await import('@/lib/domain/datetime');
    const { seedInitialData, ATHLETE_EMAIL, COACH_EMAIL } = await import('@/lib/seed');

    expect((await seedInitialData()).seeded).toBe(true);

    const [coachUser] = await db().select('users', { email: COACH_EMAIL });
    const [coach] = await db().select('coaches', { user_id: coachUser.id });
    const [athleteUser] = await db().select('users', { email: ATHLETE_EMAIL });
    const [athlete] = await db().select('athletes', { user_id: athleteUser.id });

    // --- El jugador entrena de verdad ---------------------------------------
    const now = nowIso();
    const workout = {
      id: newId(), coach_id: coach.id, name: 'FUERZA A', description: null, goal: null,
      estimated_minutes: 55, level: null, category: null, is_template: true,
      created_at: now, updated_at: now,
    };
    await db().insert('workouts', workout);

    const assignment = {
      id: newId(), coach_id: coach.id, athlete_id: athlete.id, workout_id: workout.id,
      program_id: null, scheduled_date: todayKey(), scheduled_time: null,
      status: 'assigned' as const, notes: null, created_at: now,
    };
    await db().insert('assignments', assignment);

    const session = {
      id: newId(), assignment_id: assignment.id, athlete_id: athlete.id, workout_id: workout.id,
      status: 'completed' as const, started_at: now, completed_at: now, duration_seconds: 3600,
      total_volume_kg: 4200, session_rpe: 8, feeling: 4, fatigue: 5, soreness: 3,
      comment: null, training_load_au: 480, created_at: now,
    };
    await db().insert('workout_sessions', session);

    await db().insert('wellness_logs', {
      id: newId(), athlete_id: athlete.id, date: todayKey(), sleep: 4, energy: 4,
      stress: 2, fatigue: 2, soreness: 2, motivation: 5, note: null, created_at: now,
    });

    // --- Se reinicia el servidor unas cuantas veces --------------------------
    for (let i = 0; i < 3; i += 1) {
      expect((await seedInitialData()).seeded).toBe(false);
    }

    // --- Y todo sigue donde estaba ------------------------------------------
    expect(await db().select('assignments', { athlete_id: athlete.id })).toHaveLength(1);
    expect(await db().select('workout_sessions', { athlete_id: athlete.id })).toHaveLength(1);
    expect(await db().select('wellness_logs', { athlete_id: athlete.id })).toHaveLength(1);

    // Y no se ha duplicado ninguna cuenta ni el vínculo entre ellas.
    expect(await db().select('users', { email: ATHLETE_EMAIL })).toHaveLength(1);
    expect(await db().select('users', { email: COACH_EMAIL })).toHaveLength(1);
    expect(await db().select('coach_athletes', { coach_id: coach.id })).toHaveLength(1);
  }, 120_000);
});
