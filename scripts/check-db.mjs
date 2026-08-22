#!/usr/bin/env node
/**
 * Comprueba que la base de datos de LORDGYM está lista.
 *
 *   npm run check:db
 *
 * Detecta sola qué has configurado:
 *   - PostgreSQL (Neon, Vercel Postgres, servidor propio) si hay DATABASE_URL
 *   - Supabase si hay NEXT_PUBLIC_SUPABASE_URL
 *
 * Verifica la conexión, que existan las 30 tablas del esquema y si ya se ha
 * sembrado la biblioteca de ejercicios. No escribe nada: sólo lee.
 */

import { readFileSync } from 'node:fs';

const TABLES = [
  'users', 'profiles', 'coaches', 'athletes', 'coach_athletes', 'teams', 'team_members',
  'exercises', 'workouts', 'workout_exercises', 'workout_sets', 'programs', 'program_weeks',
  'program_workouts', 'assignments', 'workout_sessions', 'session_exercises', 'session_sets',
  'personal_records', 'wellness_logs', 'pain_logs', 'bodyweight_logs', 'tests', 'test_results',
  'messages', 'notifications', 'coach_notes', 'goals', 'auth_sessions', 'app_state',
];

// Carga .env.local si existe, sin pisar lo que ya venga del entorno.
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
} catch {
  // Sin .env.local se usan sólo las variables del entorno.
}

const ok = (message) => console.log(`  OK    ${message}`);
const bad = (message) => console.log(`  FALLA ${message}`);
const info = (message) => console.log(`  ..    ${message}`);

const postgresUrl =
  process.env.LORDGYM_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

console.log('\nComprobacion de la base de datos de LORDGYM\n');

if (postgresUrl) {
  await checkPostgres(postgresUrl);
} else if (supabaseUrl) {
  await checkSupabase(supabaseUrl, supabaseKey);
} else {
  bad('No hay base de datos configurada.');
  info('Para PostgreSQL (Neon, Vercel Postgres): define DATABASE_URL.');
  info('Para Supabase: define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY.');
  info('En local sin nada configurado, LORDGYM usa un fichero JSON y no hace falta comprobar nada.');
  process.exit(1);
}

async function checkPostgres(url) {
  const safe = url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
  ok(`PostgreSQL: ${safe}`);

  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15000 });

  try {
    await client.connect();
  } catch (error) {
    bad(`No se ha podido conectar: ${error.message}`);
    if (/self.signed|certificate/i.test(error.message)) {
      info('Certificado no verificable: prueba a anadir ?sslmode=no-verify a la cadena.');
    }
    process.exit(1);
  }

  const version = await client.query('select version()');
  ok(version.rows[0].version.split(',')[0]);

  const found = await client.query(
    'select table_name from information_schema.tables where table_schema = current_schema()',
  );
  const names = new Set(found.rows.map((row) => row.table_name));
  const missing = TABLES.filter((table) => !names.has(table));

  if (missing.length === TABLES.length) {
    info('La base esta vacia. LORDGYM creara el esquema solo en el primer arranque.');
    await client.end();
    console.log('\nTodo listo.\n');
    return;
  }
  if (missing.length > 0) {
    bad(`Faltan ${missing.length} de ${TABLES.length} tablas: ${missing.join(', ')}`);
    info('Arranca la aplicacion una vez: el esquema se completa solo.');
    await client.end();
    process.exit(1);
  }
  ok(`Las ${TABLES.length} tablas del esquema existen.`);

  const seeded = await client.query("select value from app_state where key = 'seed'");
  const exercises = await client.query('select count(*)::int as total from exercises');
  if (seeded.rows.length > 0) {
    ok(`Sembrado el ${String(seeded.rows[0].value).slice(0, 10)} - ${exercises.rows[0].total} ejercicios.`);
  } else {
    info('Sin sembrar todavia: se hara en la primera peticion.');
  }

  await client.end();
  console.log('\nTodo listo.\n');
}

async function checkSupabase(url, key) {
  if (!key) {
    bad('Falta SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY).');
    process.exit(1);
  }
  ok(`Supabase: ${url}`);
  ok(`Clave secreta: ${key.slice(0, 12)}... (${key.startsWith('sb_secret_') ? 'formato nuevo' : 'formato clasico'})`);

  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const head = (table) => fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });

  const probe = await head('app_state').catch((error) => {
    bad(`No se ha podido contactar con el proyecto: ${error.message}`);
    process.exit(1);
  });
  if (probe.status === 401 || probe.status === 403) {
    bad('La clave no es valida para este proyecto (401/403).');
    process.exit(1);
  }
  ok('La clave es valida y el proyecto responde.');

  const missing = [];
  for (const table of TABLES) {
    const response = await head(table);
    if (response.status === 404 || response.status === 400) missing.push(table);
  }
  if (missing.length > 0) {
    bad(`Faltan ${missing.length} de ${TABLES.length} tablas: ${missing.join(', ')}`);
    info('Ejecuta supabase/schema.sql en el SQL Editor de Supabase.');
    process.exit(1);
  }
  ok(`Las ${TABLES.length} tablas del esquema existen.`);

  const seeded = await fetch(`${url}/rest/v1/app_state?key=eq.seed&select=value`, { headers }).then((r) => r.json());
  if (Array.isArray(seeded) && seeded.length > 0) ok('Ya sembrado.');
  else info('Sin sembrar todavia: se hara en la primera peticion.');

  console.log('\nTodo listo.\n');
}
