'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { authenticate, changePassword, registerUser } from '@/lib/services/accounts';
import { createSession, destroySession, getCurrentUser } from '@/lib/auth/session';
import { changePasswordSchema, loginSchema, registerSchema } from '@/lib/validation/schemas';
import { errorState, fromException, successState, zodFieldErrors, type ActionState } from './state';

function destination(role: 'coach' | 'athlete'): string {
  return role === 'coach' ? '/coach' : '/player';
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return errorState('Revisa los datos.', zodFieldErrors(parsed.error));

  let role: 'coach' | 'athlete';
  try {
    const user = await authenticate(parsed.data.email, parsed.data.password);
    const [profile] = await db().select('profiles', { user_id: user.id });
    if (!profile) return errorState('La cuenta no tiene perfil asociado.');
    await createSession(user.id);
    role = profile.role;
  } catch (error) {
    return fromException(error, 'No se ha podido iniciar sesión.');
  }
  redirect(destination(role));
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    birthDate: formData.get('birthDate'),
    role: formData.get('role'),
    avatarUrl: formData.get('avatarUrl'),
    coachCode: formData.get('coachCode'),
  });
  if (!parsed.success) return errorState('Revisa los datos del formulario.', zodFieldErrors(parsed.error));

  try {
    const result = await registerUser(parsed.data);
    await createSession(result.user.id);
  } catch (error) {
    return fromException(error, 'No se ha podido crear la cuenta.');
  }
  redirect(destination(parsed.data.role));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/');
}

export async function currentUserRole(): Promise<'coach' | 'athlete' | null> {
  const current = await getCurrentUser();
  return current?.profile.role ?? null;
}

/**
 * Cambio de contraseña desde los ajustes. Exige la actual, de modo que una
 * sesión robada no baste para secuestrar la cuenta.
 */
export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = changePasswordSchema.safeParse({
    current: formData.get('current'),
    next: formData.get('next'),
    repeat: formData.get('repeat'),
  });
  if (!parsed.success) return errorState('Revisa los datos.', zodFieldErrors(parsed.error));

  const current = await getCurrentUser();
  if (!current) return errorState('Tu sesión ha caducado. Vuelve a entrar.');

  try {
    await changePassword(current.user.id, parsed.data.current, parsed.data.next);
  } catch (error) {
    return fromException(error, 'No se ha podido cambiar la contraseña.');
  }
  return successState('Contraseña actualizada.');
}
