import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_DATA_FILE = '.lordgym-data/db.json';
import { TABLE_NAMES, type TableName, type Tables } from '@/types/db';
import {
  applySelectOptions,
  matchesWhere,
  type DataDriver,
  type SelectOptions,
  type Where,
} from './driver';

type Database = { [K in TableName]: Tables[K][] };

function emptyDatabase(): Database {
  const db = {} as Database;
  for (const table of TABLE_NAMES) {
    (db as Record<string, unknown[]>)[table] = [];
  }
  return db;
}

interface LocalState {
  data: Database | null;
  /** Cola de escritura: garantiza que dos mutaciones no se pisan el fichero. */
  writeChain: Promise<void>;
}

// El estado vive en `globalThis` para sobrevivir al hot-reload de Next en dev.
const GLOBAL_KEY = Symbol.for('lordgym.local-driver');
const globalScope = globalThis as unknown as Record<symbol, LocalState | undefined>;
const state: LocalState = globalScope[GLOBAL_KEY] ?? { data: null, writeChain: Promise.resolve() };
globalScope[GLOBAL_KEY] = state;

/**
 * Ruta del fichero de datos. Se devuelve tal cual: Node resuelve las rutas
 * relativas contra el directorio de trabajo. Evitamos componerla con
 * `process.cwd()` para que el analizador estático del bundler no acabe
 * trazando todo el proyecto por una ruta que sólo existe en tiempo de
 * ejecución.
 */
function dataFilePath(): string {
  return process.env.LORDGYM_DATA_FILE || DEFAULT_DATA_FILE;
}

async function load(): Promise<Database> {
  if (state.data) return state.data;
  try {
    // La ruta sólo se conoce en ejecución; `turbopackIgnore` impide que el
    // analizador estático incluya todo el proyecto en el trazado del bundle.
    const raw = await fs.readFile(/* turbopackIgnore: true */ dataFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<Database>;
    const db = emptyDatabase();
    for (const table of TABLE_NAMES) {
      const rows = parsed[table];
      if (Array.isArray(rows)) (db as Record<string, unknown[]>)[table] = rows;
    }
    state.data = db;
  } catch {
    state.data = emptyDatabase();
  }
  return state.data;
}

/** Escritura atómica: fichero temporal + rename, encolada tras la anterior. */
function persist(): Promise<void> {
  state.writeChain = state.writeChain.then(async () => {
    if (!state.data) return;
    const file = dataFilePath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(/* turbopackIgnore: true */ tmp, JSON.stringify(state.data, null, 2), 'utf8');
    await fs.rename(tmp, file);
  });
  return state.writeChain;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Driver por defecto: base de datos JSON persistida en disco.
 * Pensada para desarrollo, demo y despliegues de un solo proceso. Para
 * producción multi-instancia usar el driver de Supabase.
 */
export const localDriver: DataDriver = {
  name: 'local',

  async select<T extends TableName>(table: T, where?: Where, options?: SelectOptions) {
    const db = await load();
    const rows = (db[table] as Tables[T][]).filter((row) =>
      matchesWhere(row as unknown as Record<string, unknown>, where),
    );
    const ordered = applySelectOptions(rows as unknown as Record<string, unknown>[], options);
    return clone(ordered) as unknown as Tables[T][];
  },

  async insert<T extends TableName>(table: T, row: Tables[T]) {
    const db = await load();
    (db[table] as Tables[T][]).push(clone(row));
    await persist();
    return clone(row);
  },

  async insertMany<T extends TableName>(table: T, rows: Tables[T][]) {
    if (rows.length === 0) return [];
    const db = await load();
    (db[table] as Tables[T][]).push(...clone(rows));
    await persist();
    return clone(rows);
  },

  async update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>) {
    const db = await load();
    const rows = db[table] as (Tables[T] & { id: string })[];
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) return null;
    rows[index] = { ...rows[index], ...clone(patch) };
    await persist();
    return clone(rows[index]);
  },

  async remove<T extends TableName>(table: T, id: string) {
    const db = await load();
    const rows = db[table] as (Tables[T] & { id: string })[];
    const next = rows.filter((row) => row.id !== id);
    (db as Record<string, unknown[]>)[table] = next;
    await persist();
  },

  async removeWhere<T extends TableName>(table: T, where: Where) {
    const db = await load();
    const rows = db[table] as Tables[T][];
    const next = rows.filter((row) => !matchesWhere(row as unknown as Record<string, unknown>, where));
    (db as Record<string, unknown[]>)[table] = next;
    await persist();
  },
};

/** Sólo para tests: descarta la caché en memoria. */
export function resetLocalDriverCache(): void {
  state.data = null;
}
