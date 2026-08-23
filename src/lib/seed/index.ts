import 'server-only';
import { db, ensureDatabaseReady } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { newId } from '@/lib/domain/ids';
import { nowIso } from '@/lib/domain/datetime';
import { EXERCISE_LIBRARY, TEST_LIBRARY, type SeedExercise } from './exercise-library';
import { WGER_LIBRARY } from './wger-library';
import { limpiarHistorial, purgarDemo, reconciliarBiblioteca } from './reconcile';
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
 * Versión del contenido sembrado.
 *
 * `app_state.seed` guarda con qué versión se sembró una base. Al arrancar, si
 * no coincide con ésta, se reconcilia: es lo que permite que una instalación ya
 * desplegada reciba los cambios del catálogo en vez de quedarse congelada en la
 * versión del día que se desplegó. Súbela cuando cambie lo que se siembra.
 */
const SEED_VERSION = '3';

/**
 * Biblioteca completa: los ejercicios escritos a mano primero —con sus pautas
 * técnicas— y detrás el catálogo importado de wger.
 */
export const FULL_LIBRARY: SeedExercise[] = [...EXERCISE_LIBRARY, ...WGER_LIBRARY];

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
    await db().insert('app_state', { key: SEED_KEY, value: SEED_VERSION, created_at: nowIso() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Reclama la puesta al día, igual que `claimSeed` reclama el sembrado.
 *
 * En Vercel arrancan varias instancias a la vez y durante el build hay varios
 * procesos de prerenderizado. Sin cerrojo, dos podrían reconciliar en paralelo y
 * duplicar media biblioteca. La clave primaria de `app_state` hace de árbitro:
 * sólo una inserción gana.
 */
function reconcileKey(): string {
  return `${SEED_KEY}:${SEED_VERSION}`;
}

async function claimReconcile(): Promise<boolean> {
  const key = reconcileKey();
  const [existing] = await db().select('app_state', { key });
  if (existing) return false;
  try {
    await db().insert('app_state', { key, value: nowIso(), created_at: nowIso() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Inserta en tandas.
 *
 * La biblioteca son casi mil filas y cada una lleva catorce columnas: en una
 * sola sentencia son más de trece mil parámetros viajando a la base. Contra un
 * PostgreSQL gestionado y desde una función serverless con límite de tiempo,
 * eso es justo lo que se queda a medias. En tandas tarda lo mismo y no hay
 * ninguna sentencia gigante.
 */
async function insertarPorTandas<T extends { id: string }>(
  table: 'exercises' | 'tests',
  rows: T[],
  size = 150,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await db().insertMany(table, rows.slice(i, i + size) as never);
  }
}

/** Fila de `exercises` a partir de una entrada de la biblioteca. */
function exerciseRow(seed: SeedExercise, createdAt: string): ExerciseRow {
  return {
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
    figure_key: seed.figureKey ?? seed.slug,
    created_at: createdAt,
  };
}

/**
 * Se asegura de que existen las dos cuentas del club, vinculadas entre sí.
 *
 * Corre en **todos** los arranques, antes que cualquier otra cosa y al margen
 * del cerrojo de la reconciliación. Es barato —dos búsquedas por índice— y es
 * la red de seguridad que impide quedarse sin poder entrar: si algo dejó la
 * base sin cuenta de entrenador, el siguiente arranque la repone.
 *
 * Lo aprendimos por las malas: una reconciliación que se cortó entre borrar la
 * cuenta antigua y crear la nueva dejó la instalación sin acceso, y el cerrojo
 * impedía reintentarlo.
 */
async function ensureAccounts(): Promise<void> {
  const createdAt = nowIso();
  // El entrenador. Si la base se sembró con el correo antiguo, esa cuenta ya se
  // ha ido con la purga: aquí se crea la buena.
  let [coachUser] = await db().select('users', { email: COACH_EMAIL });
  if (!coachUser) {
    coachUser = await createUser(COACH_EMAIL, 'Josep', 'Sobervia', null, 'coach', createdAt);
    console.log('[lordgym] creada la cuenta del entrenador');
  }
  let [coach] = await db().select('coaches', { user_id: coachUser.id });
  if (!coach) {
    coach = {
      id: newId(),
      user_id: coachUser.id,
      coach_code: COACH_CODE,
      org_name: 'LORDGYM',
      staff_role: 'head_coach',
      created_at: createdAt,
    };
    await db().insert('coaches', coach);
  }

  // El jugador, con el historial de demostración fuera.
  let [athleteUser] = await db().select('users', { email: ATHLETE_EMAIL });
  if (!athleteUser) {
    athleteUser = await createUser(ATHLETE_EMAIL, 'Adrián', 'Carrillo', null, 'athlete', createdAt);
  }
  let [athlete] = await db().select('athletes', { user_id: athleteUser.id });
  if (!athlete) {
    athlete = {
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
  } else {
    await limpiarHistorial(athlete.id);
    console.log('[lordgym] historial de demostración del jugador retirado');
  }

  const [vinculo] = await db().select('coach_athletes', { coach_id: coach.id, athlete_id: athlete.id });
  if (!vinculo) {
    await db().insert('coach_athletes', {
      id: newId(),
      coach_id: coach.id,
      athlete_id: athlete.id,
      status: 'active',
      requested_at: createdAt,
      responded_at: createdAt,
    });
  }
}

/** Carga el contenido inicial. Es idempotente: sólo corre la primera vez. */
export async function seedInitialData(): Promise<{ seeded: boolean }> {
  // Con PostgreSQL el esquema se aplica solo si falta, antes de nada.
  await ensureDatabaseReady();

  if (!(await claimSeed())) {
    // Ya estaba sembrada. La red de seguridad va primero y sin cerrojo: nadie
    // debe poder quedarse sin acceso por culpa de una puesta al día a medias.
    await ensureAccounts();

    const [estado] = await db().select('app_state', { key: SEED_KEY });
    if (estado && estado.value !== SEED_VERSION && (await claimReconcile())) {
      console.log(`[lordgym] poniendo al día el contenido (${estado.value} -> ${SEED_VERSION})`);
      try {
        await reconcile();
      } catch (error) {
        // Si se corta a medias hay que poder reintentarlo en el siguiente
        // arranque: se suelta el cerrojo antes de propagar el fallo.
        await db().removeWhere('app_state', { key: reconcileKey() }).catch(() => {});
        throw error;
      }
      // `app_state` se identifica por `key`, no por `id`, y el driver actualiza
      // por identificador: se reemplaza la fila. Sólo llega aquí quien ganó el
      // cerrojo, así que no hay dos procesos escribiéndola a la vez.
      await db().removeWhere('app_state', { key: SEED_KEY });
      await db().insert('app_state', { key: SEED_KEY, value: SEED_VERSION, created_at: nowIso() });
    }
    return { seeded: false };
  }

  const createdAt = nowIso();

  // --- Biblioteca de ejercicios -------------------------------------------
  const exerciseRows: ExerciseRow[] = FULL_LIBRARY.map((seed) => exerciseRow(seed, createdAt));
  await insertarPorTandas('exercises', exerciseRows);

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
 * Pone al día una base sembrada con una versión anterior.
 *
 * Retira el equipo de demostración que llegó a desplegarse, deja al jugador con
 * su historial limpio, se asegura de que el entrenador existe con el correo
 * correcto y actualiza la biblioteca global.
 */
async function reconcile(): Promise<void> {
  const createdAt = nowIso();

  // Antes que nada: que las cuentas existan. Si lo que viene detrás se corta,
  // al menos se puede entrar.
  await ensureAccounts();

  const borradas = await purgarDemo();
  if (borradas > 0) console.log(`[lordgym] retiradas ${borradas} cuentas de demostración`);

  const biblioteca = await reconciliarBiblioteca(
    FULL_LIBRARY.map((seed) => ({
      name: seed.name,
      category: seed.category,
      metricType: seed.metricType,
      movementType: seed.movementType,
      muscles: seed.muscles,
      equipment: seed.equipment,
      description: seed.description,
      technique: seed.technique,
      figureKey: seed.figureKey ?? seed.slug,
    })),
    (seed) => exerciseRow(seed as unknown as SeedExercise, createdAt) as unknown as Record<string, unknown>,
  );
  console.log(
    `[lordgym] biblioteca: +${biblioteca.añadidos} nuevos, ${biblioteca.actualizados} actualizados, ` +
      `-${biblioteca.retirados} retirados`,
  );

  // Las pruebas físicas que falten.
  const pruebas = await db().select('tests', { coach_id: null });
  const tengo = new Set(pruebas.map((row) => row.name.toLowerCase()));
  const faltan = TEST_LIBRARY.filter((seed) => !tengo.has(seed.name.toLowerCase()));
  if (faltan.length > 0) {
    await db().insertMany(
      'tests',
      faltan.map((seed) => ({
        id: newId(),
        coach_id: null,
        name: seed.name,
        unit: seed.unit,
        category: seed.category,
        lower_is_better: seed.lowerIsBetter,
      })),
    );
  }

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
