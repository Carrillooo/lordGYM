import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { TableName, Tables } from '@/types/db';
import type { DataDriver, Filter, SelectOptions, Where } from './driver';

/**
 * Driver de Supabase / PostgreSQL.
 *
 * El esquema SQL vive en `supabase/schema.sql` y usa exactamente los mismos
 * nombres de tabla y columna que `src/types/db.ts`, por eso este adaptador es
 * una traducción directa de la cláusula WHERE a la API de PostgREST.
 *
 * Usa la service role key porque toda la autorización se aplica en el servidor
 * (`lib/auth/guards.ts`) antes de llegar aquí. Las políticas RLS del esquema
 * protegen además cualquier acceso hecho con la anon key desde el cliente.
 */
function createSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'LORDGYM_DB_DRIVER=supabase requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o la anon key).',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) client = createSupabaseClient();
  return client;
}

type Query = ReturnType<ReturnType<SupabaseClient['from']>['select']>;

function applyFilter(query: Query, column: string, filter: Filter): Query {
  if (filter === null) return query.is(column, null);
  if (typeof filter !== 'object') return query.eq(column, filter);
  if ('in' in filter && Array.isArray(filter.in)) return query.in(column, filter.in);
  if ('neq' in filter) return query.neq(column, filter.neq);

  let next = query;
  const bounds = filter as { gte?: unknown; lte?: unknown; gt?: unknown; lt?: unknown };
  if (bounds.gte !== undefined) next = next.gte(column, bounds.gte);
  if (bounds.lte !== undefined) next = next.lte(column, bounds.lte);
  if (bounds.gt !== undefined) next = next.gt(column, bounds.gt);
  if (bounds.lt !== undefined) next = next.lt(column, bounds.lt);
  return next;
}

function applyWhere(query: Query, where?: Where): Query {
  if (!where) return query;
  return Object.entries(where).reduce((acc, [column, filter]) => applyFilter(acc, column, filter), query);
}

export const supabaseDriver: DataDriver = {
  name: 'supabase',

  async select<T extends TableName>(table: T, where?: Where, options?: SelectOptions) {
    let query = applyWhere(getClient().from(table).select('*'), where);
    if (options?.orderBy) {
      query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true });
    }
    if (options?.limit !== undefined) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) throw new Error(`[supabase] select ${table}: ${error.message}`);
    return (data ?? []) as Tables[T][];
  },

  async insert<T extends TableName>(table: T, row: Tables[T]) {
    const { data, error } = await getClient()
      .from(table)
      .insert(row as unknown as Record<string, unknown>)
      .select('*')
      .single();
    if (error) throw new Error(`[supabase] insert ${table}: ${error.message}`);
    return data as Tables[T];
  },

  async insertMany<T extends TableName>(table: T, rows: Tables[T][]) {
    if (rows.length === 0) return [];
    const { data, error } = await getClient()
      .from(table)
      .insert(rows as unknown as Record<string, unknown>[])
      .select('*');
    if (error) throw new Error(`[supabase] insertMany ${table}: ${error.message}`);
    return (data ?? []) as Tables[T][];
  },

  async update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>) {
    const { data, error } = await getClient()
      .from(table)
      .update(patch as unknown as Record<string, unknown>)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`[supabase] update ${table}: ${error.message}`);
    return (data ?? null) as Tables[T] | null;
  },

  async remove<T extends TableName>(table: T, id: string) {
    const { error } = await getClient().from(table).delete().eq('id', id);
    if (error) throw new Error(`[supabase] delete ${table}: ${error.message}`);
  },

  async removeWhere<T extends TableName>(table: T, where: Where) {
    const query = applyWhere(getClient().from(table).delete() as unknown as Query, where);
    const { error } = await query;
    if (error) throw new Error(`[supabase] deleteWhere ${table}: ${error.message}`);
  },

  async isEmpty() {
    const { data, error } = await getClient().from('users').select('id').limit(1);
    if (error) throw new Error(`[supabase] isEmpty: ${error.message}`);
    return (data ?? []).length === 0;
  },
};
