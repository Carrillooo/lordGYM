import 'server-only';
import { db, ensureDatabaseReady } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { newId } from '@/lib/domain/ids';
import { nowIso } from '@/lib/domain/datetime';
import { EXERCISE_LIBRARY, TEST_LIBRARY } from './exercise-library';
import type { AthleteRow, CoachRow, ExerciseRow, ProfileRow, TestRow, UserRow } from '@/types/db';

/**
 * Contenido inicial de LORDGYM.
 *
 * Aquí no hay datos de mentira: sólo la biblioteca de ejercicios y de pruebas
 * físicas —que es contenido del producto, no relleno— y las dos cuentas reales
 * del club. Ni sesiones inventadas, ni histórico falso, ni jugadores de adorno:
 * el entrenador empieza con su plantilla y crea el primer entrenamiento él.
 */

export const COACH_EMAIL = 'jusa@lordgym.app';
export const ATHLETE_EMAIL = 'adrian@lordgym.app';
export const COACH_CODE = 'LORD-A7K29';

const SEED_KEY = 'seed';

/**
 * Contraseña inicial de las dos cuentas. Se puede fijar en el entorno antes del
 * primer arranque; después cada uno la cambia desde sus ajustes. No se muestra
 * en ninguna pantalla pública.
 */
function initialPassword(): string {
  return process.env.LORDGYM_INITIAL_PASSWORD || 'lordgym2026';
}

async function createUser(
  email: string,
  firstName: string,
  lastName: string,
  birthDate: string | null,
  role: 'coach' | 'athlete',
  createdAt: string,
): Promise<UserRow> {
  const user: UserRow = {
    id: newId(),
    email,
    password_hash: await hashPassword(initialPassword()),
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
  return user;
}

/**
 * Reclama el sembrado con una fila en `app_state`. Su clave primaria hace de
 * cerrojo: si varias instancias arrancan a la vez sólo una gana la carrera y no
 * se duplica nada.
 */
async function claimSeed(): Promise<boolean> {
  const [existing] = await db().select('app_state', { key: SEED_KEY });
  if (existing) return false;
  try {
    await db().insert('app_state', { key: SEED_KEY, value: nowIso(), created_at: nowIso() });
    return true;
  } catch {
    return false;
  }
}

/** Carga el contenido inicial. Es idempotente: sólo corre la primera vez. */
export async function seedInitialData(): Promise<{ seeded: boolean }> {
  // Con PostgreSQL el esquema se aplica solo si falta, antes de nada.
  await ensureDatabaseReady();
  if (!(await claimSeed())) return { seeded: false };

  const createdAt = nowIso();

  // --- Biblioteca de ejercicios -------------------------------------------
  // `figure_key` es el slug: de ahí sale la ilustración de cada ejercicio.
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
    figure_key: seed.slug,
    created_at: createdAt,
  }));
  await db().insertMany('exercises', exerciseRows);

  const testRows: TestRow[] = TEST_LIBRARY.map((seed) => ({
    id: newId(),
    coach_id: null,
    name: seed.name,
    unit: seed.unit,
    category: seed.category,
    lower_is_better: seed.lowerIsBetter,
  }));
  await db().insertMany('tests', testRows);

  // --- Entrenador ----------------------------------------------------------
  const coachUser = await createUser(COACH_EMAIL, 'Josep', 'Sobervia', null, 'coach', createdAt);
  const coach: CoachRow = {
    id: newId(),
    user_id: coachUser.id,
    coach_code: COACH_CODE,
    org_name: 'LORDGYM',
    staff_role: 'head_coach',
    created_at: createdAt,
  };
  await db().insert('coaches', coach);

  // --- Jugador -------------------------------------------------------------
  const athleteUser = await createUser(ATHLETE_EMAIL, 'Adrián', 'Carrillo', null, 'athlete', createdAt);
  const athlete: AthleteRow = {
    id: newId(),
    user_id: athleteUser.id,
    sport: null,
    position: null,
    team_name: null,
    height_cm: null,
    weight_kg: null,
    laterality: null,
    goals: null,
    injuries: null,
    notes: null,
    created_at: createdAt,
  };
  await db().insert('athletes', athlete);

  // El jugador ya está vinculado al entrenador: no hay que aceptar nada.
  await db().insert('coach_athletes', {
    id: newId(),
    coach_id: coach.id,
    athlete_id: athlete.id,
    status: 'active',
    requested_at: createdAt,
    responded_at: createdAt,
  });

  return { seeded: true };
}

/**
 * Garantiza el sembrado una sola vez por proceso.
 *
 * No propaga el error a propósito: se llama desde el layout raíz y un fallo de
 * configuración no debe tumbar el renderizado ni la compilación. Las páginas
 * que sí necesiten datos fallarán después con un mensaje concreto.
 */
let seedPromise: Promise<{ seeded: boolean }> | null = null;

export function ensureSeeded(): Promise<{ seeded: boolean }> {
  seedPromise ??= seedInitialData().catch((error) => {
    seedPromise = null;
    console.error('[lordgym] no se ha podido sembrar la base:', error);
    return { seeded: false };
  });
  return seedPromise;
}
