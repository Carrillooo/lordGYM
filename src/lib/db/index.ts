import 'server-only';
import type { DataDriver } from './driver';
import { localDriver } from './local-driver';
import { supabaseDriver } from './supabase-driver';

export type { DataDriver, SelectOptions, Where } from './driver';

function resolveDriver(): DataDriver {
  const configured = (process.env.LORDGYM_DB_DRIVER || 'local').toLowerCase();
  if (configured === 'supabase') return supabaseDriver;
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
