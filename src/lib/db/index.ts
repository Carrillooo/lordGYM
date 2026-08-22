import 'server-only';
import type { DataDriver } from './driver';
import { localDriver } from './local-driver';
import { supabaseDriver } from './supabase-driver';

export type { DataDriver, SelectOptions, Where } from './driver';

/**
 * `true` en Vercel, AWS Lambda y similares: el sistema de ficheros es de sólo
 * lectura y efímero, así que el driver local no puede guardar nada.
 */
export function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function resolveDriver(): DataDriver {
  const configured = (process.env.LORDGYM_DB_DRIVER || 'local').toLowerCase();
  if (configured === 'supabase') return supabaseDriver;

  // Fallar claro y pronto es mejor que perder los datos del usuario en silencio.
  if (isServerlessRuntime()) {
    throw new Error(
      'LORDGYM está desplegado en un entorno serverless (Vercel), donde el driver local no puede ' +
        'guardar datos: el disco es de sólo lectura y se borra en cada petición. Configura Supabase ' +
        'con LORDGYM_DB_DRIVER=supabase, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y ' +
        'SUPABASE_SERVICE_ROLE_KEY. Instrucciones en supabase/README.md.',
    );
  }
  return localDriver;
}

let driver: DataDriver | null = null;

export function db(): DataDriver {
  if (!driver) driver = resolveDriver();
  return driver;
}

/** Sólo para tests: fuerza un driver concreto. */
export function setDriverForTesting(next: DataDriver | null): void {
  driver = next;
}
