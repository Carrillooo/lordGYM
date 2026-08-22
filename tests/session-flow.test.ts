import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Prueba de extremo a extremo del flujo del brief §109:
 * el entrenador crea un entrenamiento → lo asigna → el jugador lo recibe →
 * registra kg/reps/RPE → finaliza → el entrenador ve los resultados.
 *
 * Se ejecuta sobre el driver local con un fichero temporal, sin mocks: es la
 * misma lógica de servicios que usa la aplicación.
 */

let dataDir: string;

beforeAll(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lordgym-test-'));
  process.env.LORDGYM_DATA_FILE = path.join(dataDir, 'db.json');
  process.env.LORDGYM_DB_DRIVER = 'local';
});

afterAll(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe('flujo entrenador → jugador → resultados', () => {
  it('recorre el ciclo completo y calcula récords y progresión', async () => {
    const { db } = await import('@/lib/db');
    const { registerUser, authenticate } = await import('@/lib/services/accounts');
    const { requestLink, respondToLink, getRoster, pendingRequests } = await import('@/lib/services/roster');
    const { createExercise } = await import('@/lib/services/exercises');
    const { createWorkout, addExerciseToWorkout, getWorkoutDetail, replaceSets } = await import(
      '@/lib/services/workouts'
    );
    const { assignWorkout, nextAssignment } = await import('@/lib/services/assignments');
    const { startSession, getSessionDetail, logSet, finishSession, lastPerformance } = await import(
      '@/lib/services/sessions'
    );
    const { exerciseHistory, personalRecords, athleteOverview } = await import('@/lib/services/progress');
    const { todayKey } = await import('@/lib/domain/datetime');

    // --- 1. Alta de entrenador y jugador ---------------------------------
    const coachAccount = await registerUser({
      email: 'coach@test.local',
      password: 'contrasena-larga',
      firstName: 'Carlos',
      lastName: 'Martínez',
      role: 'coach',
      birthDate: undefined,
      avatarUrl: undefined,
      coachCode: undefined,
    });
    const athleteAccount = await registerUser({
      email: 'athlete@test.local',
      password: 'contrasena-larga',
      firstName: 'Adrián',
      lastName: 'Carrillo',
      role: 'athlete',
      birthDate: '2005-03-14',
      avatarUrl: undefined,
      coachCode: undefined,
    });

    const [coach] = await db().select('coaches', { user_id: coachAccount.user.id });
    const [athlete] = await db().select('athletes', { user_id: athleteAccount.user.id });
    expect(coach.coach_code).toMatch(/^LORD-[A-Z0-9]{5}$/);

    // La contraseña se guarda con hash y se verifica correctamente.
    expect(coachAccount.user.password_hash).not.toContain('contrasena-larga');
    await expect(authenticate('coach@test.local', 'contrasena-larga')).resolves.toBeTruthy();
    await expect(authenticate('coach@test.local', 'incorrecta')).rejects.toThrow();

    // --- 2. Vínculo entrenador ↔ jugador ---------------------------------
    await requestLink(athlete.id, coach.coach_code.toLowerCase());
    const requests = await pendingRequests(coach.id);
    expect(requests).toHaveLength(1);

    await respondToLink(coach.id, requests[0].link.id, 'active');
    const roster = await getRoster(coach.id);
    expect(roster.map((entry) => entry.athlete.id)).toContain(athlete.id);

    // --- 3. Ejercicio y entrenamiento ------------------------------------
    const bench = await createExercise(coach.id, {
      name: 'Press banca',
      category: 'pecho',
      metricType: 'strength',
      muscles: ['Pectoral'],
      equipment: ['Barra'],
      movementType: undefined,
      description: undefined,
      technique: undefined,
      videoUrl: undefined,
      imageUrl: undefined,
    });

    const workout = await createWorkout(coach.id, {
      name: 'FUERZA + POTENCIA A',
      isTemplate: true,
      description: undefined,
      goal: undefined,
      estimatedMinutes: 60,
      level: 'intermedio',
      category: 'Fuerza',
    });
    const workoutExerciseId = await addExerciseToWorkout(workout.id, bench.id);

    // 4 × 6 a 60 kg, como en el ejemplo del brief.
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

    const detail = await getWorkoutDetail(workout.id);
    expect(detail?.totalSets).toBe(4);

    // --- 4. Asignación ----------------------------------------------------
    const today = todayKey();
    const [assignment] = await assignWorkout(coach.id, {
      workoutId: workout.id,
      athleteIds: [athlete.id],
      scheduledDate: today,
      scheduledTime: '18:00',
      notes: undefined,
    });
    expect(assignment.status).toBe('assigned');

    const pending = await nextAssignment(athlete.id, today);
    expect(pending?.workout.name).toBe('FUERZA + POTENCIA A');

    // El jugador recibe una notificación de la asignación.
    const notifications = await db().select('notifications', { user_id: athleteAccount.user.id });
    expect(notifications.some((row) => row.type === 'assignment')).toBe(true);

    // --- 5. Ejecución ------------------------------------------------------
    const session = await startSession(athlete.id, assignment.id);
    expect(session.status).toBe('started');

    // Arrancar dos veces la misma asignación no duplica la sesión.
    const again = await startSession(athlete.id, assignment.id);
    expect(again.id).toBe(session.id);

    const sessionDetail = await getSessionDetail(session.id);
    expect(sessionDetail?.exercises).toHaveLength(1);
    const sets = sessionDetail!.exercises[0].sets;
    expect(sets).toHaveLength(4);

    // Registra 62,5 kg × 6 en todas las series: por encima del objetivo.
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

    // --- 6. Cierre y récords ----------------------------------------------
    const summary = await finishSession(athlete.id, {
      sessionId: session.id,
      durationSeconds: 58 * 60,
      sessionRpe: 8,
      feeling: 4,
      fatigue: 6,
      soreness: 4,
      comment: 'Última serie exigente.',
    });

    expect(summary.setCount).toBe(4);
    expect(summary.exerciseCount).toBe(1);
    // Volumen: 62,5 kg × 6 reps × 4 series = 1500 kg.
    expect(summary.volumeKg).toBe(1500);
    // Carga: RPE 8 × 58 minutos = 464 AU.
    expect(summary.loadAu).toBe(464);
    expect(summary.newRecords.map((record) => record.exerciseName)).toContain('Press banca');

    // No se puede cerrar dos veces.
    await expect(
      finishSession(athlete.id, {
        sessionId: session.id,
        durationSeconds: 60,
        sessionRpe: 7,
        feeling: 3,
        fatigue: 3,
        soreness: 3,
        comment: undefined,
      }),
    ).rejects.toThrow();

    // --- 7. La plantilla original NO se ha modificado (§105) ---------------
    const templateAfter = await getWorkoutDetail(workout.id);
    expect(templateAfter?.exercises[0].sets.every((set) => set.target_weight_kg === 60)).toBe(true);

    // --- 8. Resultados visibles para el entrenador -------------------------
    const records = await personalRecords(athlete.id);
    const weightRecord = records.find((entry) => entry.record.record_type === 'weight');
    expect(weightRecord?.record.value).toBe(62.5);

    const history = await exerciseHistory(athlete.id, bench.id);
    expect(history).toHaveLength(1);
    expect(history[0].maxWeightKg).toBe(62.5);
    // 1RM estimado de Epley: 62,5 × (1 + 6/30) = 75.
    expect(history[0].e1rm).toBe(75);
    expect(history[0].volumeKg).toBe(1500);

    const overview = await athleteOverview(athlete.id, today);
    expect(overview.completedSessions).toBe(1);
    expect(overview.totalVolumeKg).toBe(1500);
    expect(overview.adherencePercent).toBe(100);

    // La asignación queda marcada como completada.
    const [updatedAssignment] = await db().select('assignments', { id: assignment.id });
    expect(updatedAssignment.status).toBe('completed');

    // El histórico alimenta la sugerencia de la próxima sesión (§68).
    const previous = await lastPerformance(athlete.id, bench.id);
    expect(previous.sets).toHaveLength(4);
    expect(previous.sets[0].weightKg).toBe(62.5);

    // El estado del roster refleja la actividad reciente.
    const rosterAfter = await getRoster(coach.id, today);
    expect(rosterAfter[0].weeklyCompleted).toBe(1);
    expect(rosterAfter[0].weeklyAdherence).toBe(100);
  });
});
