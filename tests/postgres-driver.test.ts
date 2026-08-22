import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Mismo ciclo completo que `session-flow.test.ts`, pero contra un PostgreSQL de
 * verdad. Verifica lo que el driver local no puede: que el SQL generado es
 * correcto, que los `numeric` vuelven como números (y no como cadenas, que es
 * el fallo clásico de node-postgres) y que las fechas conservan su formato.
 *
 * Se salta solo si no hay una base de pruebas en LORDGYM_TEST_DATABASE_URL.
 */

const TEST_URL = process.env.LORDGYM_TEST_DATABASE_URL;
const describeIfPostgres = TEST_URL ? describe : describe.skip;

beforeAll(async () => {
  if (!TEST_URL) return;
  process.env.LORDGYM_DATABASE_URL = TEST_URL;
  process.env.LORDGYM_DB_DRIVER = 'postgres';
  // Base limpia en cada ejecución. Se hace con el propio cliente y no con psql
  // para poder apuntar a cualquier PostgreSQL, incluido uno gestionado.
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: TEST_URL, connectionTimeoutMillis: 15_000 });
  await client.connect();
  await client.query('drop schema public cascade; create schema public;');
  await client.end();
});

afterAll(async () => {
  if (!TEST_URL) return;
  const { closePostgresPool } = await import('@/lib/db/postgres-driver');
  await closePostgresPool();
});

describeIfPostgres('driver de PostgreSQL', () => {
  it('crea el esquema, siembra y recorre el ciclo completo', async () => {
    const { db, ensureDatabaseReady } = await import('@/lib/db');
    const { seedDemoData, DEMO_COACH_EMAIL, DEMO_ATHLETE_EMAIL } = await import('@/lib/seed');

    // 1. El esquema se aplica solo.
    await ensureDatabaseReady();
    expect(db().name).toBe('postgres');

    // 2. Sembrado.
    expect((await seedDemoData()).seeded).toBe(true);
    // Reintentar no duplica: el cerrojo de app_state lo impide.
    expect((await seedDemoData()).seeded).toBe(false);

    const exercises = await db().select('exercises', { owner_coach_id: null });
    expect(exercises.length).toBe(48);
    // Las columnas de array vuelven como arrays, no como cadenas.
    expect(Array.isArray(exercises[0].muscles)).toBe(true);

    const [coachUser] = await db().select('users', { email: DEMO_COACH_EMAIL });
    const [athleteUser] = await db().select('users', { email: DEMO_ATHLETE_EMAIL });
    expect(coachUser).toBeTruthy();
    const [athlete] = await db().select('athletes', { user_id: athleteUser.id });

    // 3. Los numeric vuelven como NÚMEROS, no como cadenas.
    const sessions = await db().select('workout_sessions', { athlete_id: athlete.id, status: 'completed' });
    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions.slice(0, 5)) {
      expect(typeof session.total_volume_kg).toBe('number');
      if (session.session_rpe !== null) expect(typeof session.session_rpe).toBe('number');
    }
    // Y suman de verdad en lugar de concatenarse.
    const volume = sessions.reduce((acc, s) => acc + s.total_volume_kg, 0);
    expect(Number.isFinite(volume)).toBe(true);
    expect(volume).toBeGreaterThan(0);

    // 4. Las fechas naturales conservan el formato YYYY-MM-DD.
    const [assignment] = await db().select('assignments', { athlete_id: athlete.id });
    expect(assignment.scheduled_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Y los instantes son ISO con Z.
    expect(assignment.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);

    // 5. Filtros del DSL: in, gte/lte, neq y null.
    const ids = sessions.slice(0, 3).map((s) => s.id);
    expect((await db().select('workout_sessions', { id: { in: ids } })).length).toBe(ids.length);
    expect((await db().select('workout_sessions', { id: { in: [] } })).length).toBe(0);

    const today = assignment.scheduled_date;
    const ranged = await db().select('assignments', {
      athlete_id: athlete.id,
      scheduled_date: { gte: '2000-01-01', lte: today },
    });
    expect(ranged.length).toBeGreaterThan(0);

    const propios = await db().select('exercises', { owner_coach_id: { neq: null } });
    expect(propios.length).toBe(0);

    // `in` que mezcla null con valores (lo usa la biblioteca de ejercicios).
    const [coach] = await db().select('coaches', { user_id: coachUser.id });
    const visibles = await db().select('exercises', { owner_coach_id: { in: [null, coach.id] } });
    expect(visibles.length).toBe(48);

    // 6. Orden y límite.
    const ultimas = await db().select(
      'workout_sessions',
      { athlete_id: athlete.id, status: 'completed' },
      { orderBy: { column: 'completed_at', ascending: false }, limit: 3 },
    );
    expect(ultimas.length).toBe(3);
    expect(ultimas[0].completed_at! >= ultimas[1].completed_at!).toBe(true);

    // 7. Escritura completa: insert, update y borrado.
    const { startSession, logSet, finishSession } = await import('@/lib/services/sessions');
    const pendiente = (await db().select('assignments', { athlete_id: athlete.id, status: 'assigned' }))[0];
    const session = await startSession(athlete.id, pendiente.id);
    expect(session.status).toBe('started');

    const sessionExercises = await db().select('session_exercises', { session_id: session.id });
    expect(sessionExercises.length).toBeGreaterThan(0);
    const sets = await db().select('session_sets', { session_exercise_id: sessionExercises[0].id });

    for (const set of sets) {
      await logSet(athlete.id, {
        sessionId: session.id,
        setId: set.id,
        actualReps: 6,
        actualWeightKg: 62.5,
        rpe: 8,
        status: 'completed',
        actualDurationSeconds: undefined,
        actualDistanceM: undefined,
      });
    }

    const summary = await finishSession(athlete.id, {
      sessionId: session.id,
      durationSeconds: 3480,
      sessionRpe: 8,
      feeling: 4,
      fatigue: 6,
      soreness: 4,
      comment: 'Prueba contra PostgreSQL.',
    });

    // 62,5 × 6 × nº de series del primer ejercicio, más el resto que quedó pendiente.
    expect(summary.volumeKg).toBeGreaterThan(0);
    expect(typeof summary.volumeKg).toBe('number');
    expect(summary.loadAu).toBe(464);

    const [cerrada] = await db().select('workout_sessions', { id: session.id });
    expect(cerrada.status).toBe('completed');
    expect(typeof cerrada.total_volume_kg).toBe('number');

    // 8. Borrado con filtro.
    await db().removeWhere('notifications', { user_id: athleteUser.id });
    expect((await db().select('notifications', { user_id: athleteUser.id })).length).toBe(0);
    // Sin filtros se rechaza, para no vaciar una tabla por accidente.
    await expect(db().removeWhere('notifications', {})).rejects.toThrow();
  }, 120_000);
});
