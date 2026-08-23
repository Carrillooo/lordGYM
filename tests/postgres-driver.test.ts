import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Ciclo completo contra un PostgreSQL de verdad. Verifica lo que el driver
 * local no puede: que el SQL generado es correcto, que los `numeric` vuelven
 * como números (y no como cadenas, que es el fallo clásico de node-postgres) y
 * que las fechas conservan su formato.
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
  it('crea el esquema, siembra el contenido inicial y recorre el ciclo completo', async () => {
    const { db, ensureDatabaseReady } = await import('@/lib/db');
    const { seedInitialData, COACH_EMAIL, ATHLETE_EMAIL, FULL_LIBRARY } = await import('@/lib/seed');
    const { TEST_LIBRARY } = await import('@/lib/seed/exercise-library');
    const { todayKey } = await import('@/lib/domain/datetime');

    // 1. El esquema se aplica solo.
    await ensureDatabaseReady();
    expect(db().name).toBe('postgres');

    // 2. Sembrado, y reintentarlo no duplica: el cerrojo de app_state lo impide.
    expect((await seedInitialData()).seeded).toBe(true);
    expect((await seedInitialData()).seeded).toBe(false);

    const exercises = await db().select('exercises', { owner_coach_id: null });
    expect(exercises.length).toBe(FULL_LIBRARY.length);
    // Las columnas de array vuelven como arrays, no como cadenas.
    expect(Array.isArray(exercises[0].muscles)).toBe(true);
    // Todos traen explicación e ilustración.
    // Todos traen descripción e ilustración; la técnica sólo los escritos a mano.
    for (const exercise of exercises) {
      expect(exercise.description).toBeTruthy();
      expect(exercise.figure_key).toBeTruthy();
    }
    expect(exercises.filter((row) => row.technique).length).toBeGreaterThan(100);
    expect((await db().select('tests', {})).length).toBe(TEST_LIBRARY.length);

    // 3. Las dos cuentas reales, vinculadas y sin nada más.
    const [coachUser] = await db().select('users', { email: COACH_EMAIL });
    const [athleteUser] = await db().select('users', { email: ATHLETE_EMAIL });
    expect((await db().select('users', {})).length).toBe(2);
    const [coachProfile] = await db().select('profiles', { user_id: coachUser.id });
    expect(`${coachProfile.first_name} ${coachProfile.last_name}`).toBe('Josep Sobervia');

    const [coach] = await db().select('coaches', { user_id: coachUser.id });
    const [athlete] = await db().select('athletes', { user_id: athleteUser.id });
    const [link] = await db().select('coach_athletes', { coach_id: coach.id });
    expect(link.athlete_id).toBe(athlete.id);
    expect(link.status).toBe('active');

    // 4. Sin rastro de datos de demostración.
    for (const table of ['workouts', 'workout_sessions', 'assignments', 'messages', 'programs', 'wellness_logs'] as const) {
      expect((await db().select(table, {})).length).toBe(0);
    }

    // 5. El entrenador monta su primer entrenamiento y lo asigna.
    const { createWorkout, addExerciseToWorkout, replaceSets } = await import('@/lib/services/workouts');
    const { assignWorkout } = await import('@/lib/services/assignments');
    const bench = exercises.find((row) => row.figure_key === 'press-banca')!;

    const workout = await createWorkout(coach.id, {
      name: 'FUERZA A',
      isTemplate: true,
      description: undefined,
      goal: undefined,
      estimatedMinutes: 60,
      level: 'intermedio',
      category: 'Fuerza',
    });
    const workoutExerciseId = await addExerciseToWorkout(workout.id, bench.id);
    await replaceSets(
      workout.id,
      workoutExerciseId,
      Array.from({ length: 4 }, (_, index) => ({
        set_index: index + 1,
        set_type: 'normal' as const,
        target_reps: 6,
        target_weight_kg: 60,
        target_percent_1rm: null,
        target_rpe: 8,
        target_rir: null,
        target_duration_seconds: null,
        target_distance_m: null,
        target_velocity_ms: null,
        rest_seconds: 150,
        notes: null,
      })),
    );

    const today = todayKey();
    const [assignment] = await assignWorkout(coach.id, {
      workoutId: workout.id,
      athleteIds: [athlete.id],
      scheduledDate: today,
      scheduledTime: '18:00',
      notes: undefined,
    });
    // Las fechas naturales conservan el formato YYYY-MM-DD…
    expect(assignment.scheduled_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // …y los instantes son ISO con Z.
    expect(assignment.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);

    // 6. El jugador lo entrena.
    const { startSession, logSet, finishSession } = await import('@/lib/services/sessions');
    const session = await startSession(athlete.id, assignment.id);
    expect(session.status).toBe('started');

    const [sessionExercise] = await db().select('session_exercises', { session_id: session.id });
    const sets = await db().select('session_sets', { session_exercise_id: sessionExercise.id });
    expect(sets.length).toBe(4);

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

    // 7. Los numeric vuelven como NÚMEROS y suman de verdad en lugar de
    //    concatenarse: 62,5 × 6 × 4 series.
    expect(typeof summary.volumeKg).toBe('number');
    expect(summary.volumeKg).toBe(1500);
    expect(summary.loadAu).toBe(464);

    const [cerrada] = await db().select('workout_sessions', { id: session.id });
    expect(cerrada.status).toBe('completed');
    expect(typeof cerrada.total_volume_kg).toBe('number');
    expect(typeof cerrada.session_rpe).toBe('number');

    // 8. Filtros del DSL: in, in vacío, gte/lte, neq y null mezclado.
    expect((await db().select('workout_sessions', { id: { in: [session.id] } })).length).toBe(1);
    expect((await db().select('workout_sessions', { id: { in: [] } })).length).toBe(0);
    expect(
      (await db().select('assignments', { athlete_id: athlete.id, scheduled_date: { gte: '2000-01-01', lte: today } }))
        .length,
    ).toBe(1);
    expect((await db().select('exercises', { owner_coach_id: { neq: null } })).length).toBe(0);
    // `in` que mezcla null con valores: lo usa la biblioteca de ejercicios.
    expect((await db().select('exercises', { owner_coach_id: { in: [null, coach.id] } })).length).toBe(
      FULL_LIBRARY.length,
    );

    // 9. Orden y límite.
    const ordenadas = await db().select(
      'session_sets',
      { session_exercise_id: sessionExercise.id },
      { orderBy: { column: 'set_index', ascending: false }, limit: 3 },
    );
    expect(ordenadas.length).toBe(3);
    expect(ordenadas[0].set_index).toBe(4);

    // 10. Borrado con filtro. Sin filtros se rechaza, para no vaciar una tabla
    //     por accidente.
    await db().removeWhere('notifications', { user_id: athleteUser.id });
    expect((await db().select('notifications', { user_id: athleteUser.id })).length).toBe(0);
    await expect(db().removeWhere('notifications', {})).rejects.toThrow();
  }, 120_000);
});
