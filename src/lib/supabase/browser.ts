'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase en el navegador. Sólo se usa para el inicio de sesión con
 * Google: el resto de datos viaja por Server Actions, nunca directamente.
 */
let client: SupabaseClient | null = null;

export function supabaseIsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!supabaseIsConfigured()) {
    throw new Error('Supabase no está configurado: falta NEXT_PUBLIC_SUPABASE_URL o la anon key.');
  }
  client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: false } },
  );
  return client;
}
