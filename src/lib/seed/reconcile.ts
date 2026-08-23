import 'server-only';
import { db } from '@/lib/db';
import type { TableName } from '@/types/db';

/**
 * Puesta al día de una base ya sembrada.
 *
 * El sembrado sólo corre una vez, contra una base vacía. Eso está bien —evita
 * duplicar y evita pisar datos reales— pero deja un agujero: una instalación
 * sembrada con una versión antigua se queda congelada ahí para siempre, aunque
 * el código cambie. Es exactamente lo que pasó con el equipo de demostración:
 * se retiró del código y siguió vivo en las bases que ya lo tenían.
 *
 * De ahí la versión del sembrado. `app_state.seed` guarda con qué versión se
 * sembró; si no coincide con la del código, se reconcilia y se anota la nueva.
 *
 * La reconciliación es deliberadamente conservadora: borra lo que se sabe que
 * es de demostración (por su correo exacto) y actualiza la biblioteca global,
 * pero no toca ni una fila de un usuario real.
 */

/** Correos del equipo de demostración que llegó a desplegarse. */
const CUENTAS_DEMO = [
  'carlos@lordgym.app',
  'sergio@lordgym.app',
  'marta@lordgym.app',
  'ivan@lordgym.app',
  'laura@lordgym.app',
  'nuria@lordgym.app',
];

/** Tablas colgadas de un jugador, con la columna que lo referencia. */
const POR_JUGADOR: [TableName, string][] = [
  ['assignments', 'athlete_id'],
  ['workout_sessions', 'athlete_id'],
  ['personal_records', 'athlete_id'],
  ['wellness_logs', 'athlete_id'],
  ['pain_logs', 'athlete_id'],
  ['bodyweight_logs', 'athlete_id'],
  ['test_results', 'athlete_id'],
  ['coach_notes', 'athlete_id'],
  ['goals', 'athlete_id'],
  ['team_members', 'athlete_id'],
  ['coach_athletes', 'athlete_id'],
];

/** Tablas colgadas de un entrenador. */
const POR_ENTRENADOR: [TableName, string][] = [
  ['assignments', 'coach_id'],
  ['coach_notes', 'coach_id'],
  ['goals', 'coach_id'],
  ['coach_athletes', 'coach_id'],
  ['tests', 'coach_id'],
];

async function borrarSiHay(table: TableName, column: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db().removeWhere(table, { [column]: { in: ids } });
}

/**
 * Borra el historial de entrenamiento de un jugador sin tocar su cuenta.
 *
 * Hay que bajar hasta las series: el driver local no tiene claves foráneas en
 * cascada, así que si no se limpian a mano quedan huérfanas.
 */
export async function limpiarHistorial(athleteId: string): Promise<void> {
  const sesiones = await db().select('workout_sessions', { athlete_id: athleteId });
  const ejerciciosDeSesion = sesiones.length
    ? await db().select('session_exercises', { session_id: { in: sesiones.map((s) => s.id) } })
    : [];
  await borrarSiHay('session_sets', 'session_exercise_id', ejerciciosDeSesion.map((e) => e.id));
  await borrarSiHay('session_exercises', 'session_id', sesiones.map((s) => s.id));
  for (const [table, column] of POR_JUGADOR) {
    if (table === 'coach_athletes') continue; // el vínculo con su entrenador se conserva
    await db().removeWhere(table, { [column]: athleteId });
  }
}

/** Borra un entrenamiento y todo lo que cuelga de él. */
async function borrarEntrenamientos(workoutIds: string[]): Promise<void> {
  if (workoutIds.length === 0) return;
  const we = await db().select('workout_exercises', { workout_id: { in: workoutIds } });
  await borrarSiHay('workout_sets', 'workout_exercise_id', we.map((r) => r.id));
  await borrarSiHay('workout_exercises', 'workout_id', workoutIds);
  await borrarSiHay('program_workouts', 'workout_id', workoutIds);
  await db().removeWhere('workouts', { id: { in: workoutIds } });
}

/** Borra una cuenta y absolutamente todo lo suyo. */
async function borrarCuenta(userId: string): Promise<void> {
  const [coach] = await db().select('coaches', { user_id: userId });
  const [athlete] = await db().select('athletes', { user_id: userId });

  if (athlete) {
    await limpiarHistorial(athlete.id);
    await db().removeWhere('coach_athletes', { athlete_id: athlete.id });
    await db().remove('athletes', athlete.id);
  }

  if (coach) {
    const entrenamientos = await db().select('workouts', { coach_id: coach.id });
    await borrarEntrenamientos(entrenamientos.map((w) => w.id));

    const programas = await db().select('programs', { coach_id: coach.id });
    if (programas.length > 0) {
      const semanas = await db().select('program_weeks', { program_id: { in: programas.map((p) => p.id) } });
      await borrarSiHay('program_workouts', 'program_week_id', semanas.map((w) => w.id));
      await borrarSiHay('program_weeks', 'program_id', programas.map((p) => p.id));
      await db().removeWhere('programs', { id: { in: programas.map((p) => p.id) } });
    }

    const equipos = await db().select('teams', { coach_id: coach.id });
    await borrarSiHay('team_members', 'team_id', equipos.map((t) => t.id));
    if (equipos.length > 0) await db().removeWhere('teams', { id: { in: equipos.map((t) => t.id) } });

    // Los ejercicios propios del entrenador se van con él.
    await db().removeWhere('exercises', { owner_coach_id: coach.id });
    for (const [table, column] of POR_ENTRENADOR) {
      await db().removeWhere(table, { [column]: coach.id });
    }
    await db().remove('coaches', coach.id);
  }

  await db().removeWhere('messages', { sender_id: userId });
  await db().removeWhere('messages', { recipient_id: userId });
  await db().removeWhere('notifications', { user_id: userId });
  await db().removeWhere('auth_sessions', { user_id: userId });
  await db().removeWhere('profiles', { user_id: userId });
  await db().remove('users', userId);
}

/**
 * Retira el equipo de demostración de una base que lo tenga.
 *
 * Devuelve cuántas cuentas ha borrado, para poder dejar constancia en el log:
 * un borrado silencioso en el arranque es justo lo que no se quiere.
 */
export async function purgarDemo(): Promise<number> {
  const cuentas = await db().select('users', { email: { in: CUENTAS_DEMO } });
  for (const usuario of cuentas) await borrarCuenta(usuario.id);
  return cuentas.length;
}

/**
 * Deja la biblioteca global igual que el código.
 *
 * Añade lo que falte, actualiza lo que cambió y retira lo que ya no está —pero
 * sólo si ningún entrenamiento ni sesión lo usa. Un ejercicio que alguien tiene
 * dentro de una rutina no se borra por una actualización de catálogo.
 */
export async function reconciliarBiblioteca(
  biblioteca: {
    name: string;
    category: string;
    metricType: string;
    movementType: string | null;
    muscles: string[];
    equipment: string[];
    description: string;
    technique: string | null;
    figureKey: string;
  }[],
  crearFila: (seed: (typeof biblioteca)[number]) => Record<string, unknown>,
): Promise<{ añadidos: number; actualizados: number; retirados: number }> {
  const existentes = await db().select('exercises', { owner_coach_id: null });
  const porNombre = new Map(existentes.map((row) => [row.name.toLowerCase(), row]));
  const enCodigo = new Set(biblioteca.map((seed) => seed.name.toLowerCase()));

  const nuevos: Record<string, unknown>[] = [];
  let actualizados = 0;

  for (const seed of biblioteca) {
    const actual = porNombre.get(seed.name.toLowerCase());
    if (!actual) {
      nuevos.push(crearFila(seed));
      continue;
    }
    // Se refresca lo que puede haber cambiado en el catálogo.
    const cambios = {
      category: seed.category,
      metric_type: seed.metricType,
      movement_type: seed.movementType,
      muscles: seed.muscles,
      equipment: seed.equipment,
      description: seed.description,
      technique: seed.technique,
      figure_key: seed.figureKey,
    };
    const distinto =
      actual.figure_key !== cambios.figure_key ||
      actual.description !== cambios.description ||
      actual.technique !== cambios.technique ||
      actual.category !== cambios.category;
    if (distinto) {
      await db().update('exercises', actual.id, cambios as never);
      actualizados += 1;
    }
  }

  if (nuevos.length > 0) await db().insertMany('exercises', nuevos as never);

  // Retirada: sólo lo que nadie usa.
  const sobrantes = existentes.filter((row) => !enCodigo.has(row.name.toLowerCase()));
  let retirados = 0;
  if (sobrantes.length > 0) {
    const ids = sobrantes.map((row) => row.id);
    const enRutinas = await db().select('workout_exercises', { exercise_id: { in: ids } });
    const enSesiones = await db().select('session_exercises', { exercise_id: { in: ids } });
    const usados = new Set([
      ...enRutinas.map((r) => r.exercise_id),
      ...enSesiones.map((r) => r.exercise_id),
    ]);
    const borrables = ids.filter((id) => !usados.has(id));
    if (borrables.length > 0) {
      await db().removeWhere('exercises', { id: { in: borrables } });
      retirados = borrables.length;
    }
  }

  return { añadidos: nuevos.length, actualizados, retirados };
}
