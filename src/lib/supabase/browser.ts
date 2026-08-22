'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase en el navegador. Sólo se usa para el inicio de sesión con
 * Google: el resto de datos viaja por Server Actions, nunca directamente.
 *
 * Las dos variables se leen como literales estáticos a propósito: Next sólo
 * inyecta en el bundle del navegador las referencias `process.env.NEXT_PUBLIC_*`
 * que puede resolver en tiempo de compilación, así que aquí no vale una lectura
 * dinámica como en `env.ts`.
 */
const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

export function supabaseIsConfigured(): boolean {
  return Boolean(PUBLIC_URL && PUBLIC_KEY);
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!PUBLIC_URL || !PUBLIC_KEY) {
    throw new Error(
      'Supabase no está configurado: falta NEXT_PUBLIC_SUPABASE_URL o la clave pública ' +
        '(NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY).',
    );
  }
  client ??= createClient(PUBLIC_URL, PUBLIC_KEY, {
    auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: false },
  });
  return client;
}
