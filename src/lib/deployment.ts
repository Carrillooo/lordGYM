import 'server-only';
import { hasPostgresUrl, isServerlessRuntime } from '@/lib/db';
import { supabasePublicKey, supabaseSecretKey, supabaseUrl } from '@/lib/supabase/env';

export interface DeploymentIssue {
  title: string;
  detail: string;
  variables: string[];
}

/**
 * Comprueba que el despliegue está configurado antes de que el usuario se
 * choque con un error genérico al intentar entrar.
 *
 * Devuelve `null` cuando todo está en orden (que es el caso en local, donde el
 * driver de fichero funciona sin configurar nada).
 */
export function deploymentIssue(): DeploymentIssue | null {
  const driver = (process.env.LORDGYM_DB_DRIVER || '').toLowerCase();
  const serverless = isServerlessRuntime();
  // Una base PostgreSQL conectada (Neon, Vercel Postgres) basta por sí sola:
  // la integración inyecta DATABASE_URL y el esquema se crea en el primer
  // arranque, sin ejecutar nada a mano.
  const hasDatabase = hasPostgresUrl() || driver === 'supabase' || driver === 'postgres';

  if (serverless && !hasDatabase) {
    return {
      title: 'Falta conectar una base de datos',
      detail:
        'Este despliegue corre en un entorno serverless, donde el almacenamiento en fichero no ' +
        'persiste. Lo más rápido es añadir una base PostgreSQL desde la pestaña Storage de Vercel ' +
        '(Neon): la integración define DATABASE_URL sola y LORDGYM crea el esquema al arrancar. ' +
        'Sólo queda añadir a mano:',
      variables: ['LORDGYM_SESSION_SECRET'],
    };
  }

  if (driver === 'supabase') {
    // Se aceptan tanto las claves clásicas (anon / service_role) como las
    // nuevas (sb_publishable_… / sb_secret_…), que es lo que entrega hoy el
    // panel de Supabase.
    const missing = [
      !supabaseUrl() && 'NEXT_PUBLIC_SUPABASE_URL',
      !supabaseSecretKey() &&
        !supabasePublicKey() &&
        'SUPABASE_SECRET_KEY  (o SUPABASE_SERVICE_ROLE_KEY)',
    ].filter((value): value is string => Boolean(value));

    if (missing.length > 0) {
      return {
        title: 'Faltan las claves de Supabase',
        detail: 'Has activado el driver de Supabase pero no están todas sus variables:',
        variables: missing,
      };
    }
  }

  if (driver === 'postgres' && !hasPostgresUrl()) {
    return {
      title: 'Falta la cadena de conexión',
      detail: 'Has activado el driver de PostgreSQL pero no hay ninguna base configurada:',
      variables: ['DATABASE_URL  (o POSTGRES_URL)'],
    };
  }

  if (process.env.NODE_ENV === 'production' && !process.env.LORDGYM_SESSION_SECRET) {
    return {
      title: 'Falta la clave de sesión',
      detail:
        'En producción hace falta una clave para firmar las cookies. Genera una con ' +
        '`openssl rand -hex 32` y añádela como:',
      variables: ['LORDGYM_SESSION_SECRET'],
    };
  }

  return null;
}
