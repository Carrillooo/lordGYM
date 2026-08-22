import { Pool, types } from 'pg';
import { TABLE_NAMES, type TableName, type Tables } from '@/types/db';
import type { DataDriver, Filter, SelectOptions, Where } from './driver';
import { POSTGRES_SCHEMA } from './postgres-schema';

/**
 * Driver de PostgreSQL directo (Neon, Vercel Postgres, RDS, servidor propio).
 *
 * A diferencia del de Supabase no hay API REST por medio: se habla SQL. La
 * autorización sigue viviendo en `lib/auth/guards.ts`, que es la única barrera
 * necesaria cuando el único cliente de la base es este servidor.
 */

/* --------------------------------------------------------------------------
 * Conversión de tipos
 *
 * node-postgres devuelve por defecto `numeric` y `bigint` como cadenas (para no
 * perder precisión) y las fechas como objetos `Date`. El modelo de LORDGYM
 * espera números y cadenas ISO, así que se ajustan los parsers una sola vez.
 * Sin esto, `total_volume_kg` llegaría como "1500.00" y las sumas concatenarían
 * texto en lugar de sumar.
 * ----------------------------------------------------------------------- */

const OID = {
  int8: 20,
  numeric: 1700,
  date: 1082,
  timestamp: 1114,
  timestamptz: 1184,
} as const;

let parsersReady = false;

function configureTypeParsers(): void {
  if (parsersReady) return;
  types.setTypeParser(OID.int8, (value) => (value === null ? null : Number.parseInt(value, 10)));
  types.setTypeParser(OID.numeric, (value) => (value === null ? null : Number.parseFloat(value)));
  // Los días naturales se guardan y se leen como 'YYYY-MM-DD', sin zona horaria.
  types.setTypeParser(OID.date, (value) => value);
  // Los instantes viajan como ISO 8601 en UTC, igual que en el driver local.
  types.setTypeParser(OID.timestamptz, (value) => (value === null ? null : new Date(value).toISOString()));
  types.setTypeParser(OID.timestamp, (value) =>
    value === null ? null : new Date(`${value.replace(' ', 'T')}Z`).toISOString(),
  );
  parsersReady = true;
}

function connectionString(): string {
  const url =
    process.env.LORDGYM_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL;
  if (!url) {
    throw new Error(
      'LORDGYM_DB_DRIVER=postgres requiere una cadena de conexión en DATABASE_URL (o POSTGRES_URL).',
    );
  }
  return url;
}

// El pool vive en `globalThis` para sobrevivir al hot-reload de Next en
// desarrollo y para reutilizarse entre invocaciones en serverless.
const POOL_KEY = Symbol.for('lordgym.pg-pool');
const globalScope = globalThis as unknown as Record<symbol, Pool | undefined>;

function getPool(): Pool {
  const existing = globalScope[POOL_KEY];
  if (existing) return existing;

  configureTypeParsers();
  const url = connectionString();

  /*
   * TLS: manda la cadena de conexión.
   *
   * `pg` da prioridad al `sslmode=` de la URL sobre cualquier opción `ssl` que
   * se pase aquí, así que ponerla sería engañoso: parecería que hace algo y no
   * haría nada. Neon y Vercel Postgres incluyen `sslmode=require`, que `pg`
   * trata como verificación completa del certificado; sus certificados son de
   * una CA pública, así que valida sin más.
   *
   * Para una base con certificado autofirmado, la salida es
   * `LORDGYM_PG_SSL_NO_VERIFY=1` (o añadir `?sslmode=no-verify` a la URL).
   */
  const skipVerification = process.env.LORDGYM_PG_SSL_NO_VERIFY === '1' && !/sslmode=/.test(url);

  const pool = new Pool({
    connectionString: url,
    // En serverless cada instancia atiende una petición: más de un par de
    // conexiones sólo consume cupo del pooler sin dar nada a cambio.
    max: Number(process.env.LORDGYM_PG_POOL_MAX ?? 3),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    ...(skipVerification ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  pool.on('error', (error) => console.error('[lordgym] error en el pool de PostgreSQL:', error));
  globalScope[POOL_KEY] = pool;
  return pool;
}

/* --------------------------------------------------------------------------
 * Construcción de SQL
 * ----------------------------------------------------------------------- */

const TABLE_SET = new Set<string>(TABLE_NAMES);

/** Sólo se permiten tablas del modelo: corta cualquier inyección por nombre. */
function table(name: TableName): string {
  if (!TABLE_SET.has(name)) throw new Error(`Tabla desconocida: ${name}`);
  return `"${name}"`;
}

/** Los nombres de columna vienen del código, nunca del usuario; se validan igual. */
function column(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Columna no válida: ${name}`);
  return `"${name}"`;
}

interface SqlBuilder {
  params: unknown[];
  placeholder(value: unknown): string;
}

function builder(): SqlBuilder {
  const params: unknown[] = [];
  return {
    params,
    placeholder(value) {
      params.push(value);
      return `$${params.length}`;
    },
  };
}

function filterToSql(sql: SqlBuilder, name: string, filter: Filter): string {
  const col = column(name);
  if (filter === null) return `${col} is null`;
  if (typeof filter !== 'object') return `${col} = ${sql.placeholder(filter)}`;

  if ('in' in filter && Array.isArray(filter.in)) {
    const values = filter.in;
    if (values.length === 0) return 'false';
    // `in` con null mezclado: PostgreSQL no lo casa con `= any`, se separa.
    const nonNull = values.filter((value) => value !== null);
    const parts: string[] = [];
    if (nonNull.length > 0) parts.push(`${col} = any(${sql.placeholder(nonNull)})`);
    if (values.length !== nonNull.length) parts.push(`${col} is null`);
    return `(${parts.join(' or ')})`;
  }

  if ('neq' in filter) {
    return filter.neq === null ? `${col} is not null` : `${col} is distinct from ${sql.placeholder(filter.neq)}`;
  }

  const bounds = filter as { gte?: unknown; lte?: unknown; gt?: unknown; lt?: unknown };
  const parts: string[] = [];
  if (bounds.gte !== undefined) parts.push(`${col} >= ${sql.placeholder(bounds.gte)}`);
  if (bounds.lte !== undefined) parts.push(`${col} <= ${sql.placeholder(bounds.lte)}`);
  if (bounds.gt !== undefined) parts.push(`${col} > ${sql.placeholder(bounds.gt)}`);
  if (bounds.lt !== undefined) parts.push(`${col} < ${sql.placeholder(bounds.lt)}`);
  return parts.length > 0 ? `(${parts.join(' and ')})` : 'true';
}

function whereToSql(sql: SqlBuilder, where?: Where): string {
  const entries = Object.entries(where ?? {});
  if (entries.length === 0) return '';
  return ` where ${entries.map(([name, filter]) => filterToSql(sql, name, filter)).join(' and ')}`;
}

async function run<T>(text: string, params: unknown[]): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

/* --------------------------------------------------------------------------
 * Esquema
 * ----------------------------------------------------------------------- */

let schemaPromise: Promise<void> | null = null;

/**
 * Aplica el esquema si falta. Todo es `IF NOT EXISTS`, así que es seguro
 * ejecutarlo en cada arranque; se memoriza por proceso para no repetirlo.
 */
export function ensurePostgresSchema(): Promise<void> {
  schemaPromise ??= getPool()
    .query(POSTGRES_SCHEMA)
    .then(() => undefined)
    .catch((error) => {
      schemaPromise = null;
      throw error;
    });
  return schemaPromise;
}

/* --------------------------------------------------------------------------
 * Driver
 * ----------------------------------------------------------------------- */

export const postgresDriver: DataDriver = {
  name: 'postgres',

  async select<T extends TableName>(name: T, where?: Where, options?: SelectOptions) {
    const sql = builder();
    let text = `select * from ${table(name)}${whereToSql(sql, where)}`;
    if (options?.orderBy) {
      const direction = options.orderBy.ascending === false ? 'desc' : 'asc';
      // `nulls last` iguala el comportamiento del driver local, que ordena por
      // comparación de cadenas y deja los vacíos al final.
      text += ` order by ${column(options.orderBy.column)} ${direction} nulls last`;
    }
    if (options?.limit !== undefined) text += ` limit ${sql.placeholder(options.limit)}`;
    return run<Tables[T]>(text, sql.params);
  },

  async insert<T extends TableName>(name: T, row: Tables[T]) {
    const entries = Object.entries(row as unknown as Record<string, unknown>);
    const sql = builder();
    const text =
      `insert into ${table(name)} (${entries.map(([key]) => column(key)).join(', ')}) ` +
      `values (${entries.map(([, value]) => sql.placeholder(value)).join(', ')}) returning *`;
    const [inserted] = await run<Tables[T]>(text, sql.params);
    return inserted;
  },

  async insertMany<T extends TableName>(name: T, rows: Tables[T][]) {
    if (rows.length === 0) return [];
    const keys = Object.keys(rows[0] as unknown as Record<string, unknown>);
    const sql = builder();
    const values = rows
      .map(
        (row) =>
          `(${keys.map((key) => sql.placeholder((row as unknown as Record<string, unknown>)[key])).join(', ')})`,
      )
      .join(', ');
    const text = `insert into ${table(name)} (${keys.map(column).join(', ')}) values ${values} returning *`;
    return run<Tables[T]>(text, sql.params);
  },

  async update<T extends TableName>(name: T, id: string, patch: Partial<Tables[T]>) {
    const entries = Object.entries(patch as unknown as Record<string, unknown>);
    if (entries.length === 0) {
      const [current] = await run<Tables[T]>(`select * from ${table(name)} where "id" = $1`, [id]);
      return current ?? null;
    }
    const sql = builder();
    const assignments = entries
      .map(([key, value]) => `${column(key)} = ${sql.placeholder(value)}`)
      .join(', ');
    const text = `update ${table(name)} set ${assignments} where "id" = ${sql.placeholder(id)} returning *`;
    const [updated] = await run<Tables[T]>(text, sql.params);
    return updated ?? null;
  },

  async remove<T extends TableName>(name: T, id: string) {
    await run(`delete from ${table(name)} where "id" = $1`, [id]);
  },

  async removeWhere<T extends TableName>(name: T, where: Where) {
    const sql = builder();
    const clause = whereToSql(sql, where);
    // Sin cláusula se borraría la tabla entera: se exige filtro a propósito.
    if (!clause) throw new Error(`removeWhere sin filtros sobre ${name}: operación no permitida.`);
    await run(`delete from ${table(name)}${clause}`, sql.params);
  },
};

/** Sólo para tests y scripts: cierra el pool para que el proceso pueda salir. */
export async function closePostgresPool(): Promise<void> {
  const pool = globalScope[POOL_KEY];
  if (!pool) return;
  globalScope[POOL_KEY] = undefined;
  schemaPromise = null;
  await pool.end();
}
