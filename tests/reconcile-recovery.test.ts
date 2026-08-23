import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Recuperación de una puesta al día que se quedó a medias.
 *
 * Pasó en producción: la purga borró la cuenta del entrenador antiguo, el paso
 * siguiente —insertar la biblioteca entera— no llegó a terminar dentro del
 * límite de tiempo de la función, y el cerrojo ya estaba tomado. Resultado: la
 * cuenta nueva nunca se creó y no volvía a intentarse. Nadie podía entrar.
 *
 * De ahí dos garantías que este test fija: las cuentas se aseguran **antes** de
 * cualquier trabajo caro, y un fallo suelta el cerrojo para poder reintentar.
 */

let dataDir: string;

beforeAll(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lordgym-recovery-'));
  process.env.LORDGYM_DATA_FILE = path.join(dataDir, 'db.json');
  process.env.LORDGYM_DB_DRIVER = 'local';
});

afterAll(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe('recuperación de una puesta al día interrumpida', () => {
  it('vuelve a dejar entrar aunque la reconciliación anterior se quedara a medias', async () => {
    const { db } = await import('@/lib/db');
    const { newId } = await import('@/lib/domain/ids');
    const { nowIso } = await import('@/lib/domain/datetime');
    const { hashPassword } = await import('@/lib/auth/password');
    const { seedInitialData, COACH_EMAIL, ATHLETE_EMAIL } = await import('@/lib/seed');

    const now = nowIso();

    /*
     * El estado en el que quedó la instalación real: la purga borró al
     * entrenador antiguo, la reconciliación se cortó antes de crear el nuevo y
     * el cerrojo quedó tomado, así que no volvía a intentarlo. Resultado: nadie
     * podía entrar, ni con el correo viejo ni con el nuevo.
     */
    await db().insert('app_state', { key: 'seed', value: now, created_at: now });
    await db().insert('app_state', { key: 'seed:3', value: now, created_at: now });

    // Sólo queda el jugador; no hay ninguna cuenta de entrenador.
    const user = { id: newId(), email: ATHLETE_EMAIL, password_hash: await hashPassword('lordgym2026'), created_at: now };
    await db().insert('users', user);
    await db().insert('profiles', { id: newId(), user_id: user.id, first_name: 'Adrián', last_name: 'Carrillo', birth_date: null, avatar_url: null, role: 'athlete', created_at: now });
    await db().insert('athletes', { id: newId(), user_id: user.id, sport: null, position: null, team_name: null, height_cm: null, weight_kg: null, laterality: null, goals: null, injuries: null, notes: null, created_at: now });
    expect(await db().select('coaches', {})).toHaveLength(0);

    // Arranque: tiene que recuperarse pase lo que pase con el cerrojo.
    await seedInitialData();

    const [coachUser] = await db().select('users', { email: COACH_EMAIL });
    expect(coachUser).toBeTruthy();
    const [coach] = await db().select('coaches', { user_id: coachUser.id });
    expect(coach).toBeTruthy();

    // Y el jugador sigue vinculado a él.
    const [athlete] = await db().select('athletes', { user_id: user.id });
    const [link] = await db().select('coach_athletes', { athlete_id: athlete.id });
    expect(link?.coach_id).toBe(coach.id);

    // Se puede iniciar sesión de verdad con la contraseña inicial.
    const { authenticate } = await import('@/lib/services/accounts');
    await expect(authenticate(COACH_EMAIL, 'lordgym2026')).resolves.toBeTruthy();
  }, 120_000);
});
