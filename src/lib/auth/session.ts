import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { newId } from '@/lib/domain/ids';
import { nowIso } from '@/lib/domain/datetime';
import type { ProfileRow, UserRow } from '@/types/db';

export const SESSION_COOKIE = 'lordgym_session';
const SESSION_DAYS = 30;

function secret(): string {
  const value = process.env.LORDGYM_SESSION_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('LORDGYM_SESSION_SECRET es obligatoria en producción (mínimo 16 caracteres).');
  }
  // En desarrollo se genera una clave efímera: las sesiones caducan al reiniciar.
  const globalScope = globalThis as unknown as { __lordgymDevSecret?: string };
  globalScope.__lordgymDevSecret ??= randomBytes(32).toString('hex');
  return globalScope.__lordgymDevSecret;
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('hex');
}

/** Token con firma HMAC: el id de sesión no puede falsificarse desde el cliente. */
function encodeToken(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

function decodeToken(token: string): string | null {
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;
  const sessionId = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = sign(sessionId);
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return sessionId;
}

export async function createSession(userId: string): Promise<void> {
  const id = newId();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await db().insert('auth_sessions', { id, user_id: userId, created_at: nowIso(), expires_at: expiresAt });

  const store = await cookies();
  store.set(SESSION_COOKIE, encodeToken(id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const sessionId = decodeToken(token);
    if (sessionId) await db().remove('auth_sessions', sessionId);
  }
  store.delete(SESSION_COOKIE);
}

export interface CurrentUser {
  user: UserRow;
  profile: ProfileRow;
}

/** Usuario autenticado, o `null`. Nunca lanza: sirve para rutas públicas. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessionId = decodeToken(token);
  if (!sessionId) return null;

  const [session] = await db().select('auth_sessions', { id: sessionId });
  if (!session) return null;
  if (Date.parse(session.expires_at) < Date.now()) {
    await db().remove('auth_sessions', sessionId);
    return null;
  }

  const [user] = await db().select('users', { id: session.user_id });
  if (!user) return null;
  const [profile] = await db().select('profiles', { user_id: user.id });
  if (!profile) return null;

  return { user, profile };
}
