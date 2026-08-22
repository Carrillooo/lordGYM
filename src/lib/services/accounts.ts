import 'server-only';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { newCoachCode, newId, normalizeCoachCode } from '@/lib/domain/ids';
import { nowIso } from '@/lib/domain/datetime';
import type { RegisterInput } from '@/lib/validation/schemas';
import type { AthleteRow, CoachRow, ProfileRow, UserRow } from '@/types/db';

export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}

/** Genera un código de entrenador único comprobando colisiones. */
async function uniqueCoachCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = newCoachCode();
    const [existing] = await db().select('coaches', { coach_code: code });
    if (!existing) return code;
  }
  throw new ServiceError('No se ha podido generar un código de entrenador.');
}

export interface RegisterResult {
  user: UserRow;
  profile: ProfileRow;
  /** Vinculación automática cuando el jugador se registra con un código. */
  linkedCoachName: string | null;
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const [existing] = await db().select('users', { email: input.email });
  if (existing) throw new ServiceError('Ya existe una cuenta con ese email.');

  const now = nowIso();
  const user: UserRow = {
    id: newId(),
    email: input.email,
    password_hash: await hashPassword(input.password),
    created_at: now,
  };
  await db().insert('users', user);

  const profile: ProfileRow = {
    id: newId(),
    user_id: user.id,
    first_name: input.firstName,
    last_name: input.lastName,
    birth_date: input.birthDate ?? null,
    avatar_url: input.avatarUrl ?? null,
    role: input.role,
    created_at: now,
  };
  await db().insert('profiles', profile);

  let linkedCoachName: string | null = null;

  if (input.role === 'coach') {
    const coach: CoachRow = {
      id: newId(),
      user_id: user.id,
      coach_code: await uniqueCoachCode(),
      org_name: null,
      staff_role: 'head_coach',
      created_at: now,
    };
    await db().insert('coaches', coach);
  } else {
    const athlete: AthleteRow = {
      id: newId(),
      user_id: user.id,
      sport: null,
      position: null,
      team_name: null,
      height_cm: null,
      weight_kg: null,
      laterality: null,
      goals: null,
      injuries: null,
      notes: null,
      created_at: now,
    };
    await db().insert('athletes', athlete);

    if (input.coachCode) {
      const { requestLink } = await import('./roster');
      const result = await requestLink(athlete.id, input.coachCode);
      linkedCoachName = result.coachName;
    }
  }

  return { user, profile, linkedCoachName };
}

export async function authenticate(email: string, password: string): Promise<UserRow> {
  const [user] = await db().select('users', { email: email.trim().toLowerCase() });
  // Se ejecuta el verify igualmente para no filtrar por tiempo si el email existe.
  const hash = user?.password_hash ?? 'scrypt$00$00';
  const valid = await verifyPassword(password, hash);
  if (!user || !valid) throw new ServiceError('Email o contraseña incorrectos.');
  return user;
}

export async function getProfileByUserId(userId: string): Promise<ProfileRow | null> {
  const [profile] = await db().select('profiles', { user_id: userId });
  return profile ?? null;
}

export async function findCoachByCode(rawCode: string): Promise<CoachRow | null> {
  const code = normalizeCoachCode(rawCode);
  const [coach] = await db().select('coaches', { coach_code: code });
  return coach ?? null;
}

export async function updateProfile(
  profileId: string,
  patch: Partial<Pick<ProfileRow, 'first_name' | 'last_name' | 'birth_date' | 'avatar_url'>>,
): Promise<void> {
  await db().update('profiles', profileId, patch);
}

export async function updateAthleteProfile(
  athleteId: string,
  patch: Partial<Omit<AthleteRow, 'id' | 'user_id' | 'created_at'>>,
): Promise<void> {
  await db().update('athletes', athleteId, patch);
}

export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const [user] = await db().select('users', { id: userId });
  if (!user) throw new ServiceError('Usuario no encontrado.');
  if (!(await verifyPassword(current, user.password_hash))) {
    throw new ServiceError('La contraseña actual no es correcta.');
  }
  await db().update('users', userId, { password_hash: await hashPassword(next) });
}

/** Perfiles indexados por `user_id`, para pintar nombres sin N+1 consultas. */
export async function profilesByUserIds(userIds: string[]): Promise<Map<string, ProfileRow>> {
  if (userIds.length === 0) return new Map();
  const rows = await db().select('profiles', { user_id: { in: userIds } });
  return new Map(rows.map((row) => [row.user_id, row]));
}
