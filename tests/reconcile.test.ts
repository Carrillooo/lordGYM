import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Una base sembrada con una versión antigua tiene que ponerse al día sola.
 *
 * Es el caso real que se dio en producción: la instalación se sembró con el
 * equipo de demostración, después se retiró del código, y la base siguió con
 * los jugadores inventados dentro y sin la cuenta del entrenador nueva —porque
 * el sembrado sólo corre una vez.
 *
 * Aquí se reconstruye ese estado a mano y se comprueba que el arranque lo
 * arregla: fuera la demostración, dentro las dos cuentas reales y la biblioteca
 * al día. Y, sobre todo, que no se lleva por delante datos de usuarios reales.
 */

let dataDir: string;

beforeAll(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lordgym-reconcile-'));
  process.env.LORDGYM_DATA_FILE = path.join(dataDir, 'db.json');
  process.env.LORDGYM_DB_DRIVER = 'local';
});

afterAll(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe('puesta al día de una base ya sembrada', () => {
  it('retira la demostración, deja las cuentas reales y respeta a los usuarios de verdad', async () => {
    const { db } = await import('@/lib/db');
    const { newId } = await import('@/lib/domain/ids');
    const { nowIso, todayKey } = await import('@/lib/domain/datetime');
    const { hashPassword } = await import('@/lib/auth/password');
    const { seedInitialData, COACH_EMAIL, ATHLETE_EMAIL, FULL_LIBRARY } = await import('@/lib/seed');

    const now = nowIso();

    // --- Se reconstruye una base sembrada por la versión antigua ------------
    // Marca de sembrado con el formato viejo: una fecha, no una versión.
    await db().insert('app_state', { key: 'seed', value: now, created_at: now });

    async function crearUsuario(email: string, nombre: string, rol: 'coach' | 'athlete') {
      const user = { id: newId(), email, password_hash: await hashPassword('lordgym2026'), created_at: now };
      await db().insert('users', user);
      await db().insert('profiles', {
        id: newId(),
        user_id: user.id,
        first_name: nombre,
        last_name: 'Demo',
        birth_date: null,
        avatar_url: null,
        role: rol,
        created_at: now,
      });
      return user;
    }

    // El entrenador de demostración, con el correo antiguo.
    const carlos = await crearUsuario('carlos@lordgym.app', 'Carlos', 'coach');
    const coachDemo = {
      id: newId(),
      user_id: carlos.id,
      coach_code: 'LORD-A7K29',
      org_name: 'CP LORDGYM',
      staff_role: 'head_coach' as const,
      created_at: now,
    };
    await db().insert('coaches', coachDemo);

    // Los jugadores inventados, y Adrián con historial de mentira.
    const inventados = ['sergio', 'marta', 'ivan', 'laura', 'nuria'];
    for (const nombre of inventados) {
      const user = await crearUsuario(`${nombre}@lordgym.app`, nombre, 'athlete');
      const athlete = { id: newId(), user_id: user.id, sport: null, position: null, team_name: null, height_cm: null, weight_kg: null, laterality: null, goals: null, injuries: null, notes: null, created_at: now };
      await db().insert('athletes', athlete);
      await db().insert('coach_athletes', { id: newId(), coach_id: coachDemo.id, athlete_id: athlete.id, status: 'active', requested_at: now, responded_at: now });
    }

    const adrianUser = await crearUsuario(ATHLETE_EMAIL, 'Adrián', 'athlete');
    const adrian = { id: newId(), user_id: adrianUser.id, sport: null, position: null, team_name: null, height_cm: null, weight_kg: null, laterality: null, goals: null, injuries: null, notes: null, created_at: now };
    await db().insert('athletes', adrian);
    await db().insert('coach_athletes', { id: newId(), coach_id: coachDemo.id, athlete_id: adrian.id, status: 'active', requested_at: now, responded_at: now });

    // Entrenamiento y sesión de demostración colgando del entrenador viejo.
    const workoutDemo = { id: newId(), coach_id: coachDemo.id, name: 'FUERZA DEMO', description: null, goal: null, estimated_minutes: 60, level: null, category: null, is_template: true, created_at: now, updated_at: now };
    await db().insert('workouts', workoutDemo);
    await db().insert('assignments', { id: newId(), coach_id: coachDemo.id, athlete_id: adrian.id, workout_id: workoutDemo.id, program_id: null, scheduled_date: todayKey(), scheduled_time: null, status: 'assigned', notes: null, created_at: now });
    await db().insert('wellness_logs', { id: newId(), athlete_id: adrian.id, date: todayKey(), sleep: 4, energy: 4, stress: 2, fatigue: 2, soreness: 2, motivation: 4, note: null, created_at: now });

    // Un ejercicio de la biblioteca vieja que ya no está en el catálogo.
    await db().insert('exercises', { id: newId(), owner_coach_id: null, name: 'Ejercicio retirado del catálogo', category: 'pecho', metric_type: 'strength', movement_type: null, muscles: [], equipment: [], description: null, technique: null, video_url: null, image_url: null, figure_key: null, created_at: now });

    // --- Y un club de verdad, que NO se puede tocar -------------------------
    const realCoachUser = await crearUsuario('club@real.com', 'Entrenador', 'coach');
    const realCoach = { id: newId(), user_id: realCoachUser.id, coach_code: 'LORD-REAL1', org_name: 'Club real', staff_role: 'head_coach' as const, created_at: now };
    await db().insert('coaches', realCoach);
    const realPlayerUser = await crearUsuario('jugador@real.com', 'Jugador', 'athlete');
    const realPlayer = { id: newId(), user_id: realPlayerUser.id, sport: null, position: null, team_name: null, height_cm: null, weight_kg: null, laterality: null, goals: null, injuries: null, notes: null, created_at: now };
    await db().insert('athletes', realPlayer);
    const realWorkout = { id: newId(), coach_id: realCoach.id, name: 'RUTINA DEL CLUB', description: null, goal: null, estimated_minutes: 45, level: null, category: null, is_template: true, created_at: now, updated_at: now };
    await db().insert('workouts', realWorkout);

    // === Arranque con el código nuevo ======================================
    const resultado = await seedInitialData();
    expect(resultado.seeded).toBe(false); // no siembra de cero: reconcilia

    // 1. El equipo de demostración ya no está.
    for (const nombre of [...inventados, 'carlos']) {
      expect(await db().select('users', { email: `${nombre}@lordgym.app` })).toHaveLength(0);
    }
    expect(await db().select('coaches', { id: coachDemo.id })).toHaveLength(0);
    expect(await db().select('workouts', { id: workoutDemo.id })).toHaveLength(0);

    // 2. El entrenador real de LORDGYM existe y es Josep.
    const [coachUser] = await db().select('users', { email: COACH_EMAIL });
    expect(coachUser).toBeTruthy();
    const [coachProfile] = await db().select('profiles', { user_id: coachUser.id });
    expect(`${coachProfile.first_name} ${coachProfile.last_name}`).toBe('Josep Sobervia');
    const [coach] = await db().select('coaches', { user_id: coachUser.id });
    expect(coach).toBeTruthy();

    // 3. Adrián sigue, vinculado, y sin el historial inventado.
    const [athleteUser] = await db().select('users', { email: ATHLETE_EMAIL });
    expect(athleteUser.id).toBe(adrianUser.id); // es la MISMA cuenta, no una nueva
    const [athlete] = await db().select('athletes', { user_id: athleteUser.id });
    expect(await db().select('assignments', { athlete_id: athlete.id })).toHaveLength(0);
    expect(await db().select('wellness_logs', { athlete_id: athlete.id })).toHaveLength(0);
    const [link] = await db().select('coach_athletes', { athlete_id: athlete.id });
    expect(link.coach_id).toBe(coach.id);
    expect(link.status).toBe('active');

    // 4. En la plantilla del entrenador sólo está Adrián.
    const plantilla = await db().select('coach_athletes', { coach_id: coach.id });
    expect(plantilla).toHaveLength(1);

    // 5. La biblioteca está completa y el ejercicio retirado ha desaparecido.
    const biblioteca = await db().select('exercises', { owner_coach_id: null });
    expect(biblioteca.length).toBe(FULL_LIBRARY.length);
    expect(biblioteca.some((row) => row.name === 'Ejercicio retirado del catálogo')).toBe(false);
    for (const row of biblioteca) expect(row.figure_key).toBeTruthy();

    // 6. El club real no se ha tocado.
    expect(await db().select('users', { email: 'club@real.com' })).toHaveLength(1);
    expect(await db().select('users', { email: 'jugador@real.com' })).toHaveLength(1);
    expect(await db().select('workouts', { id: realWorkout.id })).toHaveLength(1);

    // 7. Volver a arrancar no hace nada: la versión ya coincide.
    const antes = (await db().select('exercises', { owner_coach_id: null })).length;
    await seedInitialData();
    expect((await db().select('exercises', { owner_coach_id: null })).length).toBe(antes);
  }, 120_000);
});
