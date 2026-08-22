import 'server-only';

/**
 * Resolución de las variables de Supabase en el servidor.
 *
 * Supabase convive con dos formatos de clave:
 *
 *  - el clásico: `anon` (pública) y `service_role` (secreta), ambas JWT `eyJ…`;
 *  - el nuevo:   `sb_publishable_…` y `sb_secret_…`.
 *
 * Los proyectos creados hoy entregan el segundo, con los nombres de variable
 * `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`. Se aceptan los dos juegos
 * para poder pegar tal cual lo que da el panel de Supabase, sin renombrar nada.
 */

export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || undefined;
}

/** Clave pública: la ve el navegador y está sujeta a las políticas RLS. */
export function supabasePublicKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    undefined
  );
}

/** Clave secreta: sólo servidor. Salta RLS, así que nunca sale de aquí. */
export function supabaseSecretKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || undefined;
}
