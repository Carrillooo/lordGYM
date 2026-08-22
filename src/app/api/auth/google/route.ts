import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db';
import { supabasePublicKey, supabaseUrl } from '@/lib/supabase/env';
import { createSession } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { newCoachCode, newId } from '@/lib/domain/ids';
import { nowIso } from '@/lib/domain/datetime';
import type { AthleteRow, CoachRow, ProfileRow, UserRow } from '@/types/db';

/**
 * Valida el access token de Supabase en el servidor y abre sesión en LORDGYM.
 * Si el email no tenía cuenta se crea con el rol elegido antes del OAuth.
 */
export async function POST(request: Request) {
  const url = supabaseUrl();
  const anonKey = supabasePublicKey();
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Supabase Auth no está configurado en este despliegue.' }, { status: 501 });
  }

  const body = (await request.json().catch(() => null)) as { accessToken?: string; role?: string } | null;
  if (!body?.accessToken) {
    return NextResponse.json({ error: 'Falta el token de acceso.' }, { status: 400 });
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(body.accessToken);
  if (error || !data.user?.email) {
    return NextResponse.json({ error: 'El token de Google no es válido.' }, { status: 401 });
  }

  const email = data.user.email.toLowerCase();
  const role: 'coach' | 'athlete' = body.role === 'coach' ? 'coach' : 'athlete';
  const metadata = (data.user.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string };
  const displayName = metadata.full_name ?? metadata.name ?? email.split('@')[0];
  const [firstName, ...rest] = displayName.split(' ');

  const [existing] = await db().select('users', { email });
  if (existing) {
    const [profile] = await db().select('profiles', { user_id: existing.id });
    await createSession(existing.id);
    return NextResponse.json({ redirectTo: profile?.role === 'coach' ? '/coach' : '/player' });
  }

  const now = nowIso();
  const user: UserRow = {
    id: newId(),
    email,
    // Cuenta federada: no hay contraseña utilizable, se guarda un hash aleatorio.
    password_hash: await hashPassword(newId() + newId()),
    created_at: now,
  };
  await db().insert('users', user);

  const profile: ProfileRow = {
    id: newId(),
    user_id: user.id,
    first_name: firstName || 'Usuario',
    last_name: rest.join(' ') || 'LORDGYM',
    birth_date: null,
    avatar_url: metadata.avatar_url ?? null,
    role,
    created_at: now,
  };
  await db().insert('profiles', profile);

  if (role === 'coach') {
    const coach: CoachRow = {
      id: newId(),
      user_id: user.id,
      coach_code: newCoachCode(),
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
  }

  await createSession(user.id);
  return NextResponse.json({ redirectTo: role === 'coach' ? '/coach' : '/player' });
}
