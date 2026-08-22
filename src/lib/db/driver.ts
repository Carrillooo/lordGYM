import type { TableName, Tables } from '@/types/db';

export type Primitive = string | number | boolean | null;

export type Filter =
  | Primitive
  | { in: Primitive[] }
  | { neq: Primitive }
  | { gte?: Primitive; lte?: Primitive; gt?: Primitive; lt?: Primitive };

/** Cláusula WHERE con AND implícito entre campos. */
export type Where = Record<string, Filter>;

export interface SelectOptions {
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
}

/**
 * Contrato mínimo de persistencia. Toda la lógica de negocio vive en
 * `lib/services` y sólo habla este dialecto, de forma que cambiar de driver
 * (JSON local ↔ Supabase/PostgreSQL) no toca ni una regla de dominio.
 */
export interface DataDriver {
  readonly name: 'local' | 'supabase';
  select<T extends TableName>(table: T, where?: Where, options?: SelectOptions): Promise<Tables[T][]>;
  insert<T extends TableName>(table: T, row: Tables[T]): Promise<Tables[T]>;
  insertMany<T extends TableName>(table: T, rows: Tables[T][]): Promise<Tables[T][]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<Tables[T] | null>;
  remove<T extends TableName>(table: T, id: string): Promise<void>;
  removeWhere<T extends TableName>(table: T, where: Where): Promise<void>;
}

function isPlainFilterObject(value: Filter): value is Exclude<Filter, Primitive> {
  return typeof value === 'object' && value !== null;
}

/** Evaluación de un filtro en memoria (driver local y utilidades de test). */
export function matchesFilter(value: unknown, filter: Filter): boolean {
  if (!isPlainFilterObject(filter)) return value === filter;
  if ('in' in filter && Array.isArray(filter.in)) return filter.in.includes(value as Primitive);
  if ('neq' in filter) return value !== filter.neq;

  const bounds = filter as { gte?: Primitive; lte?: Primitive; gt?: Primitive; lt?: Primitive };
  if (bounds.gte !== undefined && !(compare(value, bounds.gte) >= 0)) return false;
  if (bounds.lte !== undefined && !(compare(value, bounds.lte) <= 0)) return false;
  if (bounds.gt !== undefined && !(compare(value, bounds.gt) > 0)) return false;
  if (bounds.lt !== undefined && !(compare(value, bounds.lt) < 0)) return false;
  return true;
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

export function matchesWhere(row: Record<string, unknown>, where?: Where): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, filter]) => matchesFilter(row[key], filter));
}

export function applySelectOptions<T extends Record<string, unknown>>(rows: T[], options?: SelectOptions): T[] {
  let out = rows;
  if (options?.orderBy) {
    const { column, ascending = true } = options.orderBy;
    out = [...out].sort((a, b) => {
      const result = compare(a[column], b[column]);
      return ascending ? result : -result;
    });
  }
  if (options?.limit !== undefined) out = out.slice(0, options.limit);
  return out;
}
