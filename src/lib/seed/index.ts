import 'server-only';
import { db, ensureDatabaseReady } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { newId } from '@/lib/domain/ids';
import { addDays, nowIso, todayKey } from '@/lib/domain/datetime';
import { setVolume, trainingLoad } from '@/lib/domain/metrics';
import { recomputeRecordsForAthlete } from '@/lib/services/sessions';
import { EXERCISE_LIBRARY, TEST_LIBRARY } from './exercise-library';
import { WORKOUT_SPECS, type SeedWorkoutSpec } from './workout-specs';
import type {
  AssignmentRow,
  AthleteRow,
  CoachRow,
  ExerciseRow,
  ProfileRow,
  SessionExerciseRow,
  SessionSetRow,
  TestRow,
  UserRow,
  WorkoutExerciseRow,
  WorkoutRow,
  WorkoutSessionRow,
  WorkoutSetRow,
} from '@/types/db';

export const DEMO_PASSWORD = 'lordgym2026';
export const DEMO_COACH_EMAIL = 'carlos@lordgym.app';
export const DEMO_ATHLETE_EMAIL = 'adrian@lordgym.app';
export const DEMO_COACH_CODE = 'LORD-A7K29';

/** Generador determinista: la demo se ve igual en cada instalación. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

interface AthleteSpec {
  email: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  position: string;
  teamName: string;
  heightCm: number;
  weightKg: number;
  laterality: 'diestro' | 'zurdo' | 'ambidiestro';
  goals: string;
  injuries: string | null;
  /** Multiplicador de cargas respecto al plan base. */
  strength: number;
  /** Probabilidad de completar una sesión asignada. */
  adherence: number;
  /** Sesgo aplicado al RPE de sesión. */
  rpeBias: number;
  linkStatus: 'active' | 'pending';
}

const ATHLETES: AthleteSpec[] = [
  {
    email: DEMO_ATHLETE_EMAIL,
    firstName: 'Adrián',
    lastName: 'Carrillo',
    birthDate: '2005-03-14',
    position: 'Jugador',
    teamName: 'Juvenil A',
    heightCm: 178,
    weightKg: 72.4,
    laterality: 'diestro',
    goals: 'Subir el press banca a 80 kg y bajar de 3,20 s en 20 m.',
    injuries: 'Esguince de tobillo derecho (octubre 2025), ya recuperado.',
    strength: 1,
    adherence: 0.95,
    rpeBias: 0,
    linkStatus: 'active',
  },
  {
    email: 'sergio@lordgym.app',
    firstName: 'Sergio',
    lastName: 'García',
    birthDate: '2004-11-02',
    position: 'Portero',
    teamName: 'Juvenil A',
    heightCm: 183,
    weightKg: 79.1,
    laterality: 'diestro',
    goals: 'Mejorar potencia de piernas y estabilidad de cadera.',
    injuries: null,
    strength: 1.1,
    adherence: 0.55,
    rpeBias: 0.3,
    linkStatus: 'active',
  },
  {
    email: 'marta@lordgym.app',
    firstName: 'Marta',
    lastName: 'Ruiz',
    birthDate: '2006-06-21',
    position: 'Jugadora',
    teamName: 'Juvenil A',
    heightCm: 167,
    weightKg: 60.2,
    laterality: 'zurdo',
    goals: 'Ganar fuerza en tren inferior sin perder velocidad.',
    injuries: null,
    strength: 0.7,
    adherence: 0.9,
    rpeBias: 0.9,
    linkStatus: 'active',
  },
  {
    email: 'ivan@lordgym.app',
    firstName: 'Iván',
    lastName: 'Soler',
    birthDate: '2003-01-30',
    position: 'Jugador',
    teamName: 'Sénior',
    heightCm: 175,
    weightKg: 74.8,
    laterality: 'diestro',
    goals: 'Volver al nivel de pretemporada tras la lesión.',
    injuries: 'Sobrecarga en isquiotibiales izquierdo.',
    strength: 0.95,
    adherence: 0.8,
    rpeBias: 0.2,
    linkStatus: 'active',
  },
  {
    email: 'laura@lordgym.app',
    firstName: 'Laura',
    lastName: 'Peña',
    birthDate: '2005-09-08',
    position: 'Jugadora',
    teamName: 'Sénior',
    heightCm: 170,
    weightKg: 63.5,
    laterality: 'diestro',
    goals: 'Aumentar la altura de salto CMJ.',
    injuries: null,
    strength: 0.75,
    adherence: 0.85,
    rpeBias: -0.3,
    linkStatus: 'active',
  },
  {
    email: 'nuria@lordgym.app',
    firstName: 'Nuria',
    lastName: 'Vidal',
    birthDate: '2006-02-17',
    position: 'Jugadora',
    teamName: 'Juvenil B',
    heightCm: 165,
    weightKg: 58.0,
    laterality: 'diestro',
    goals: 'Incorporarse al plan de fuerza del equipo.',
    injuries: null,
    strength: 0.6,
    adherence: 0.9,
    rpeBias: 0,
    linkStatus: 'pending',
  },
];

/** Progresión histórica del press banca de Adrián (§86). */
const BENCH_PROGRESSION = [55, 57.5, 60, 60, 62.5];

/** Plan semanal: día de la microsemana → sesión. */
const WEEK_PLAN: { offset: number; workout: string }[] = [
  { offset: 0, workout: 'fuerza-potencia-a' },
  { offset: 1, workout: 'velocidad-agilidad' },
  { offset: 2, workout: 'movilidad-prevencion' },
  { offset: 3, workout: 'fuerza-inferior-b' },
  { offset: 4, workout: 'core-prevencion' },
];

async function createUser(
  email: string,
  firstName: string,
  lastName: string,
  birthDate: string | null,
  role: 'coach' | 'athlete',
  createdAt: string,
): Promise<{ user: UserRow; profile: ProfileRow }> {
  const user: UserRow = {
    id: newId(),
    email,
    password_hash: await hashPassword(DEMO_PASSWORD),
    created_at: createdAt,
  };
  await db().insert('users', user);
  const profile: ProfileRow = {
    id: newId(),
    user_id: user.id,
    first_name: firstName,
    last_name: lastName,
    birth_date: birthDate,
    avatar_url: null,
    role,
    created_at: createdAt,
  };
  await db().insert('profiles', profile);
  return { user, profile };
}

async function createWorkoutFromSpec(
  coachId: string,
  spec: SeedWorkoutSpec,
  exerciseBySlug: Map<string, ExerciseRow>,
  createdAt: string,
): Promise<WorkoutRow> {
  const workout: WorkoutRow = {
    id: newId(),
    coach_id: coachId,
    name: spec.name,
    description: spec.description,
    goal: spec.goal,
    estimated_minutes: spec.estimatedMinutes,
    level: spec.level,
    category: spec.category,
    is_template: spec.isTemplate,
    created_at: createdAt,
    updated_at: createdAt,
  };
  await db().insert('workouts', workout);

  for (const [position, exerciseSpec] of spec.exercises.entries()) {
    const exercise = exerciseBySlug.get(exerciseSpec.slug);
    if (!exercise) continue;
    const workoutExercise: WorkoutExerciseRow = {
      id: newId(),
      workout_id: workout.id,
      exercise_id: exercise.id,
      position,
      superset_group: exerciseSpec.supersetGroup ?? null,
      rest_seconds: exerciseSpec.restSeconds,
      tempo: exerciseSpec.tempo ?? null,
      notes: exerciseSpec.notes ?? null,
    };
    await db().insert('workout_exercises', workoutExercise);
    await db().insertMany(
      'workout_sets',
      exerciseSpec.sets.map(
        (set, index): WorkoutSetRow => ({
          id: newId(),
          workout_exercise_id: workoutExercise.id,
          set_index: index + 1,
          set_type: set.type ?? 'normal',
          target_reps: set.reps ?? null,
          target_weight_kg: set.weightKg ?? null,
          target_percent_1rm: set.percent1rm ?? null,
          target_rpe: set.rpe ?? null,
          target_rir: set.rir ?? null,
          target_duration_seconds: set.durationSeconds ?? null,
          target_distance_m: set.distanceM ?? null,
          target_velocity_ms: null,
          rest_seconds: set.restSeconds ?? null,
          notes: set.notes ?? null,
        }),
      ),
    );
  }
  return workout;
}

interface PerformanceContext {
  strength: number;
  benchWeight: number | null;
  rpeBias: number;
  random: () => number;
}

function performSet(
  exercise: ExerciseRow,
  templateSet: WorkoutSetRow,
  context: PerformanceContext,
): { weight: number | null; reps: number | null; duration: number | null; distance: number | null; rpe: number } {
  const jitter = (amount: number) => (context.random() - 0.5) * 2 * amount;
  const rpe = Math.min(
    10,
    Math.max(5, Math.round(((templateSet.target_rpe ?? 7.5) + context.rpeBias + jitter(0.5)) * 2) / 2),
  );

  let weight = templateSet.target_weight_kg;
  if (weight !== null) {
    // El press banca sigue la progresión pactada; el resto escala por nivel.
    weight =
      exercise.name === 'Press banca' && context.benchWeight !== null
        ? context.benchWeight
        : Math.round(weight * context.strength * 2) / 2;
  }

  const reps =
    templateSet.target_reps === null
      ? null
      : Math.max(1, templateSet.target_reps + (context.random() > 0.85 ? 1 : 0));

  return {
    weight,
    reps,
    duration: templateSet.target_duration_seconds,
    distance: templateSet.target_distance_m,
    rpe,
  };
}

async function createCompletedSession(options: {
  athleteId: string;
  coachId: string;
  workoutId: string;
  date: string;
  hour: number;
  context: PerformanceContext;
  comment?: string | null;
}): Promise<void> {
  const { athleteId, coachId, workoutId, date, hour, context } = options;

  const workoutExercises = await db().select(
    'workout_exercises',
    { workout_id: workoutId },
    { orderBy: { column: 'position' } },
  );
  if (workoutExercises.length === 0) return;
  const templateSets = await db().select('workout_sets', {
    workout_exercise_id: { in: workoutExercises.map((we) => we.id) },
  });
  const exercises = await db().select('exercises', { id: { in: workoutExercises.map((we) => we.exercise_id) } });
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));

  const startedAt = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`).toISOString();
  const durationSeconds = 45 * 60 + Math.round(context.random() * 25 * 60);
  const completedAt = new Date(Date.parse(startedAt) + durationSeconds * 1000).toISOString();

  const assignment: AssignmentRow = {
    id: newId(),
    coach_id: coachId,
    athlete_id: athleteId,
    workout_id: workoutId,
    program_id: null,
    scheduled_date: date,
    scheduled_time: `${String(hour).padStart(2, '0')}:00`,
    status: 'completed',
    notes: null,
    created_at: startedAt,
  };
  await db().insert('assignments', assignment);

  const session: WorkoutSessionRow = {
    id: newId(),
    assignment_id: assignment.id,
    athlete_id: athleteId,
    workout_id: workoutId,
    status: 'completed',
    started_at: startedAt,
    completed_at: completedAt,
    duration_seconds: durationSeconds,
    session_rpe: 0,
    feeling: 0,
    fatigue: 0,
    soreness: 0,
    comment: options.comment ?? null,
    total_volume_kg: 0,
    training_load_au: null,
  };
  await db().insert('workout_sessions', session);

  let volume = 0;
  const rpes: number[] = [];

  for (const workoutExercise of workoutExercises) {
    const exercise = exerciseById.get(workoutExercise.exercise_id);
    if (!exercise) continue;
    const sessionExercise: SessionExerciseRow = {
      id: newId(),
      session_id: session.id,
      workout_exercise_id: workoutExercise.id,
      exercise_id: exercise.id,
      position: workoutExercise.position,
      superset_group: workoutExercise.superset_group,
      rest_seconds: workoutExercise.rest_seconds,
      notes: workoutExercise.notes,
      athlete_comment: null,
      video_url: null,
    };
    await db().insert('session_exercises', sessionExercise);

    const own = templateSets
      .filter((set) => set.workout_exercise_id === workoutExercise.id)
      .sort((a, b) => a.set_index - b.set_index);

    const rows: SessionSetRow[] = own.map((templateSet) => {
      const result = performSet(exercise, templateSet, context);
      volume += setVolume(result.weight, result.reps);
      rpes.push(result.rpe);
      return {
        id: newId(),
        session_exercise_id: sessionExercise.id,
        set_index: templateSet.set_index,
        set_type: templateSet.set_type,
        target_reps: templateSet.target_reps,
        target_weight_kg: templateSet.target_weight_kg,
        actual_reps: result.reps,
        actual_weight_kg: result.weight,
        actual_duration_seconds: result.duration,
        actual_distance_m: result.distance,
        rpe: result.rpe,
        status: 'completed',
        completed_at: completedAt,
      };
    });
    await db().insertMany('session_sets', rows);
  }

  const sessionRpe =
    rpes.length > 0 ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 2) / 2 : 7;
  const feeling = sessionRpe >= 9 ? 2 : sessionRpe >= 8 ? 3 : 4;

  await db().update('workout_sessions', session.id, {
    session_rpe: sessionRpe,
    feeling,
    fatigue: Math.min(10, Math.round(sessionRpe)),
    soreness: Math.max(1, Math.round(sessionRpe - 2)),
    total_volume_kg: Math.round(volume),
    training_load_au: trainingLoad(sessionRpe, durationSeconds),
  });
}

/** Clave del cerrojo de sembrado en `app_state`. */
const SEED_KEY = 'seed';

/**
 * Reclama el sembrado de forma atómica.
 *
 * En serverless pueden arrancar varias instancias a la vez: sin esto, dos
 * podrían sembrar en paralelo y dejar la base a medias. La clave primaria de
 * `app_state` hace que sólo una inserción tenga éxito.
 */
async function claimSeed(): Promise<boolean> {
  const [existing] = await db().select('app_state', { key: SEED_KEY });
  if (existing) return false;
  try {
    await db().insert('app_state', { key: SEED_KEY, value: nowIso(), created_at: nowIso() });
    return true;
  } catch {
    // Otra instancia ganó la carrera: no se ha escrito nada más.
    return false;
  }
}

/**
 * Siembra la base con la biblioteca de ejercicios, las pruebas físicas y el
 * equipo demo (§84–§86). Es idempotente y sólo se ejecuta una vez.
 *
 * Con `LORDGYM_SEED_DEMO=false` se carga únicamente la biblioteca global
 * (ejercicios y pruebas), sin el equipo de demostración: es lo que quieres en
 * una instalación real de un club.
 */
export async function seedDemoData(): Promise<{ seeded: boolean }> {
  // Con PostgreSQL el esquema se aplica solo si falta, antes de nada.
  await ensureDatabaseReady();
  if (!(await claimSeed())) return { seeded: false };

  const withDemo = (process.env.LORDGYM_SEED_DEMO ?? 'true').toLowerCase() !== 'false';
  const today = todayKey();
  const createdAt = new Date(`${addDays(today, -120)}T08:00:00.000Z`).toISOString();

  // --- Biblioteca global -------------------------------------------------
  const exerciseRows: ExerciseRow[] = EXERCISE_LIBRARY.map((seed) => ({
    id: newId(),
    owner_coach_id: null,
    name: seed.name,
    category: seed.category,
    metric_type: seed.metricType,
    movement_type: seed.movementType,
    muscles: seed.muscles,
    equipment: seed.equipment,
    description: seed.description,
    technique: seed.technique,
    video_url: null,
    image_url: null,
    created_at: createdAt,
  }));
  await db().insertMany('exercises', exerciseRows);
  const exerciseBySlug = new Map(EXERCISE_LIBRARY.map((seed, index) => [seed.slug, exerciseRows[index]]));

  const testRows: TestRow[] = TEST_LIBRARY.map((seed) => ({
    id: newId(),
    coach_id: null,
    name: seed.name,
    unit: seed.unit,
    category: seed.category,
    lower_is_better: seed.lowerIsBetter,
  }));
  await db().insertMany('tests', testRows);
  const testBySlug = new Map(TEST_LIBRARY.map((seed, index) => [seed.slug, testRows[index]]));

  if (!withDemo) return { seeded: true };

  // --- Entrenador demo ---------------------------------------------------
  const coachAccount = await createUser(
    DEMO_COACH_EMAIL,
    'Carlos',
    'Martínez',
    '1988-04-22',
    'coach',
    createdAt,
  );
  const coach: CoachRow = {
    id: newId(),
    user_id: coachAccount.user.id,
    coach_code: DEMO_COACH_CODE,
    org_name: 'CP LORDGYM',
    staff_role: 'head_coach',
    created_at: createdAt,
  };
  await db().insert('coaches', coach);

  // --- Sesiones demo -----------------------------------------------------
  const workoutByKey = new Map<string, WorkoutRow>();
  for (const spec of WORKOUT_SPECS) {
    workoutByKey.set(spec.key, await createWorkoutFromSpec(coach.id, spec, exerciseBySlug, createdAt));
  }

  // --- Jugadores ---------------------------------------------------------
  const athleteBySpec = new Map<string, AthleteRow>();
  const teamRows = [
    { id: newId(), coach_id: coach.id, name: 'Juvenil A', sport: 'Hockey patines', category: 'Juvenil', created_at: createdAt },
    { id: newId(), coach_id: coach.id, name: 'Sénior', sport: 'Hockey patines', category: 'Sénior', created_at: createdAt },
  ];
  await db().insertMany('teams', teamRows);

  for (const [index, spec] of ATHLETES.entries()) {
    const account = await createUser(
      spec.email,
      spec.firstName,
      spec.lastName,
      spec.birthDate,
      'athlete',
      createdAt,
    );
    const athlete: AthleteRow = {
      id: newId(),
      user_id: account.user.id,
      sport: 'Hockey patines',
      position: spec.position,
      team_name: spec.teamName,
      height_cm: spec.heightCm,
      weight_kg: spec.weightKg,
      laterality: spec.laterality,
      goals: spec.goals,
      injuries: spec.injuries,
      notes: null,
      created_at: createdAt,
    };
    await db().insert('athletes', athlete);
    athleteBySpec.set(spec.email, athlete);

    await db().insert('coach_athletes', {
      id: newId(),
      coach_id: coach.id,
      athlete_id: athlete.id,
      status: spec.linkStatus,
      requested_at: createdAt,
      responded_at: spec.linkStatus === 'active' ? createdAt : null,
    });

    if (spec.linkStatus === 'active') {
      const team = teamRows.find((row) => row.name === spec.teamName) ?? teamRows[0];
      await db().insert('team_members', {
        id: newId(),
        team_id: team.id,
        athlete_id: athlete.id,
        created_at: createdAt,
      });
    }

    if (spec.linkStatus !== 'active') continue;

    // Histórico de 5 microsemanas.
    const random = makeRandom(1000 + index * 97);
    for (let week = 5; week >= 1; week -= 1) {
      const weekStart = addDays(today, -week * 7);
      const benchWeight = BENCH_PROGRESSION[5 - week] ?? null;
      for (const planned of WEEK_PLAN) {
        if (random() > spec.adherence) continue;
        const workout = workoutByKey.get(planned.workout);
        if (!workout) continue;
        await createCompletedSession({
          athleteId: athlete.id,
          coachId: coach.id,
          workoutId: workout.id,
          date: addDays(weekStart, planned.offset),
          hour: 18,
          context: {
            strength: spec.strength,
            benchWeight: benchWeight === null ? null : Math.round(benchWeight * spec.strength * 2) / 2,
            rpeBias: spec.rpeBias,
            random,
          },
        });
      }
    }

    // Semana en curso: sesiones pendientes desde hoy.
    const currentWeek = addDays(today, 0);
    const upcoming: AssignmentRow[] = WEEK_PLAN.map((planned, offsetIndex): AssignmentRow => ({
      id: newId(),
      coach_id: coach.id,
      athlete_id: athlete.id,
      workout_id: workoutByKey.get(planned.workout)?.id ?? '',
      program_id: null,
      scheduled_date: addDays(currentWeek, offsetIndex),
      scheduled_time: offsetIndex === 0 ? '18:00' : '18:30',
      status: 'assigned',
      notes: offsetIndex === 0 ? 'Calienta bien el hombro antes del press.' : null,
      created_at: createdAt,
    })).filter((row) => row.workout_id !== '');
    await db().insertMany('assignments', upcoming);

    // Peso corporal, wellness y dolor.
    const bodyweightRows = Array.from({ length: 12 }, (_, i) => ({
      id: newId(),
      athlete_id: athlete.id,
      date: addDays(today, -(11 - i) * 3),
      weight_kg: Math.round((spec.weightKg + (random() - 0.5) * 1.4) * 10) / 10,
    }));
    await db().insertMany('bodyweight_logs', bodyweightRows);

    const wellnessRows = Array.from({ length: 14 }, (_, i) => {
      const tired = spec.rpeBias > 0.5;
      const clamp = (value: number) => Math.min(5, Math.max(1, Math.round(value)));
      return {
        id: newId(),
        athlete_id: athlete.id,
        date: addDays(today, -(13 - i)),
        sleep: clamp(4 - (tired ? 1 : 0) + (random() - 0.5)),
        energy: clamp(4 - (tired ? 1 : 0) + (random() - 0.5)),
        stress: clamp(2 + (tired ? 1 : 0) + (random() - 0.5)),
        fatigue: clamp(2.6 + (tired ? 1.6 : 0) + (random() - 0.5)),
        soreness: clamp(2.4 + (tired ? 1.2 : 0) + (random() - 0.5)),
        motivation: clamp(4 + (random() - 0.5)),
        note: null,
        created_at: createdAt,
      };
    });
    await db().insertMany('wellness_logs', wellnessRows);

    // Resultados de tests: tres tomas a lo largo de la temporada.
    const testPlan: { slug: string; values: [number, number, number] }[] = [
      { slug: 'sprint-20', values: [3.42, 3.31, 3.19] },
      { slug: 'cmj', values: [34.5, 36.2, 38.0] },
      { slug: 'agilidad-5105', values: [5.12, 5.03, 4.94] },
      { slug: 'yoyo', values: [1240, 1360, 1480] },
    ];
    for (const plan of testPlan) {
      const test = testBySlug.get(plan.slug);
      if (!test) continue;
      const factor = test.lower_is_better ? 2 - spec.strength : spec.strength;
      await db().insertMany(
        'test_results',
        plan.values.map((value, i) => ({
          id: newId(),
          test_id: test.id,
          athlete_id: athlete.id,
          date: addDays(today, -150 + i * 60),
          value: Math.round(value * factor * 100) / 100,
          note: null,
          created_at: createdAt,
        })),
      );
    }

    await recomputeRecordsForAthlete(athlete.id);
  }

  // --- Detalles específicos del jugador principal ------------------------
  const adrian = athleteBySpec.get(DEMO_ATHLETE_EMAIL);
  if (adrian) {
    await db().insert('pain_logs', {
      id: newId(),
      athlete_id: adrian.id,
      date: addDays(today, -3),
      body_part: 'Tobillo',
      side: 'derecha',
      intensity: 4,
      note: 'Molestia leve al frenar. No limita el entrenamiento.',
      created_at: createdAt,
    });

    await db().insert('coach_notes', {
      id: newId(),
      coach_id: coach.id,
      athlete_id: adrian.id,
      body: 'Mejorar estabilidad de tobillo derecho. Añadir propiocepción 2 veces por semana.',
      visible_to_athlete: false,
      created_at: createdAt,
    });

    const bench = exerciseBySlug.get('press-banca');
    if (bench) {
      await db().insert('goals', {
        id: newId(),
        athlete_id: adrian.id,
        coach_id: coach.id,
        title: 'Press banca 80 kg',
        metric: 'exercise_weight',
        exercise_id: bench.id,
        test_id: null,
        start_value: 55,
        target_value: 80,
        unit: 'kg',
        lower_is_better: false,
        due_date: addDays(today, 90),
        created_at: createdAt,
      });
    }
    const sprint = testBySlug.get('sprint-20');
    if (sprint) {
      await db().insert('goals', {
        id: newId(),
        athlete_id: adrian.id,
        coach_id: coach.id,
        title: 'Sprint 20 m por debajo de 3,20 s',
        metric: 'test',
        exercise_id: null,
        test_id: sprint.id,
        start_value: 3.42,
        target_value: 3.2,
        unit: 's',
        lower_is_better: true,
        due_date: addDays(today, 60),
        created_at: createdAt,
      });
    }

    const conversation = [
      { from: coach.user_id, to: adrian.user_id, body: 'Mañana baja 5 kg en el press y céntrate en la velocidad de la barra.', minutesAgo: 240 },
      { from: adrian.user_id, to: coach.user_id, body: 'Perfecto. El tobillo va mucho mejor.', minutesAgo: 210 },
      { from: coach.user_id, to: adrian.user_id, body: 'Genial. Añade la propiocepción al final de cada sesión.', minutesAgo: 180 },
    ];
    await db().insertMany(
      'messages',
      conversation.map((message) => ({
        id: newId(),
        thread_key: `${coach.id}:${adrian.id}`,
        sender_id: message.from,
        recipient_id: message.to,
        body: message.body,
        attachment_url: null,
        attachment_type: null,
        created_at: new Date(Date.now() - message.minutesAgo * 60_000).toISOString(),
        read_at: null,
      })),
    );
  }

  // --- Programa de pretemporada -----------------------------------------
  const program = {
    id: newId(),
    coach_id: coach.id,
    name: 'PRETEMPORADA 2026',
    description: 'Bloque de 8 semanas: acumulación, intensificación y puesta a punto.',
    weeks_count: 8,
    start_date: addDays(today, 7),
    created_at: createdAt,
  };
  await db().insert('programs', program);
  for (let week = 1; week <= program.weeks_count; week += 1) {
    const programWeek = {
      id: newId(),
      program_id: program.id,
      week_index: week,
      title: week <= 3 ? `Semana ${week} · Acumulación` : week <= 6 ? `Semana ${week} · Intensificación` : `Semana ${week} · Puesta a punto`,
      notes: null,
    };
    await db().insert('program_weeks', programWeek);
    await db().insertMany(
      'program_workouts',
      WEEK_PLAN.flatMap((planned, index) => {
        const workout = workoutByKey.get(planned.workout);
        return workout
          ? [{ id: newId(), program_week_id: programWeek.id, workout_id: workout.id, day_of_week: index + 1 }]
          : [];
      }),
    );
  }

  return { seeded: true };
}

/**
 * Garantiza el sembrado una sola vez por proceso.
 *
 * No propaga el error a propósito: se llama desde el layout raíz y un fallo de
 * configuración (por ejemplo, Supabase sin credenciales) no debe tumbar el
 * renderizado ni la compilación. Las páginas que sí necesiten datos fallarán
 * después con un mensaje concreto.
 */
let seedPromise: Promise<{ seeded: boolean }> | null = null;

export function ensureSeeded(): Promise<{ seeded: boolean }> {
  seedPromise ??= seedDemoData().catch((error) => {
    seedPromise = null;
    console.error('[lordgym] no se ha podido sembrar la base:', error);
    return { seeded: false };
  });
  return seedPromise;
}
