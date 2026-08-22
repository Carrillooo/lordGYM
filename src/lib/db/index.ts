import 'server-only';
import type { DataDriver } from './driver';
import { localDriver } from './local-driver';
import { supabaseDriver } from './supabase-driver';
import { ensurePostgresSchema, postgresDriver } from './postgres-driver';

export type { DataDriver, SelectOptions, Where } from './driver';

/**
 * `true` en Vercel, AWS Lambda y similares: el sistema de ficheros es de sólo
 * lectura y efímero, así que el driver local no puede guardar nada.
 */
export function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/** `true` si hay una cadena de conexión de PostgreSQL en el entorno. */
export function hasPostgresUrl(): boolean {
  return Boolean(
    process.env.LORDGYM_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL,
  );
}

function resolveDriver(): DataDriver {
  const configured = (process.env.LORDGYM_DB_DRIVER || '').toLowerCase();
  if (configured === 'supabase') return supabaseDriver;
  if (configured === 'postgres') return postgresDriver;
  if (configured === 'local') return localDriver;

  // Sin driver explícito: si hay una base de datos conectada (la integración de
  // Neon o Vercel Postgres inyecta DATABASE_URL sola), se usa. Es lo que espera
  // cualquiera que enchufe una base y despliegue sin tocar nada más.
  if (hasPostgresUrl()) return postgresDriver;

  // Fallar claro y pronto es mejor que perder los datos del usuario en silencio.
  if (isServerlessRuntime()) {
    throw new Error(
      'LORDGYM está desplegado en un entorno serverless (Vercel), donde el driver local no puede ' +
        'guardar datos: el disco es de sólo lectura y se borra en cada petición. Conecta una base ' +
        'PostgreSQL (Neon, Vercel Postgres…) definiendo DATABASE_URL, o configura Supabase. ' +
        'Instrucciones en docs/DEPLOY.md.',
    );
  }
  return localDriver;
}

let driver: DataDriver | null = null;

export function db(): DataDriver {
  if (!driver) driver = resolveDriver();
  return driver;
}

/**
 * Deja la base lista para usarse. Con PostgreSQL aplica el esquema si falta,
 * de modo que no haya que ejecutar ningún SQL a mano antes del primer arranque.
 */
export async function ensureDatabaseReady(): Promise<void> {
  if (db().name === 'postgres') await ensurePostgresSchema();
}

/** Sólo para tests: fuerza un driver concreto. */
export function setDriverForTesting(next: DataDriver | null): void {
  driver = next;
}
