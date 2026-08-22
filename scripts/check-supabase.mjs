#!/usr/bin/env node
/**
 * Comprueba que Supabase está listo para LORDGYM.
 *
 *   npm run check:supabase
 *
 * Lee las variables del entorno (o de .env.local) y verifica, en este orden:
 *   1. que están la URL y la clave secreta,
 *   2. que la clave es válida contra el proyecto,
 *   3. que existen las 30 tablas del esquema,
 *   4. si ya se ha sembrado la biblioteca de ejercicios.
 *
 * No escribe nada: sólo lee.
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const ok = (message) => console.log(`  OK    ${message}`);
const bad = (message) => console.log(`  FALLA ${message}`);
const info = (message) => console.log(`  ..    ${message}`);

console.log('\nComprobacion de Supabase para LORDGYM\n');

if (!url) {
  bad('Falta NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL).');
  process.exit(1);
}
if (!key) {
  bad('Falta SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}
ok(`URL del proyecto: ${url}`);
ok(`Clave secreta: ${key.slice(0, 12)}... (${key.startsWith('sb_secret_') ? 'formato nuevo' : 'formato clasico'})`);

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const head = (table) => fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });

const probe = await head('app_state').catch((error) => {
  bad(`No se ha podido contactar con el proyecto: ${error.message}`);
  process.exit(1);
});

if (probe.status === 401 || probe.status === 403) {
  bad('La clave no es valida para este proyecto (401/403). Revisa que sea la secreta y del proyecto correcto.');
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
const exercises = await fetch(`${url}/rest/v1/exercises?select=id`, {
  headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
});
const total = exercises.headers.get('content-range')?.split('/')[1] ?? '?';

if (Array.isArray(seeded) && seeded.length > 0) {
  ok(`Ya sembrado el ${String(seeded[0].value).slice(0, 10)} - ${total} ejercicios en la biblioteca.`);
} else {
  info('Sin sembrar todavia: se hara solo en la primera peticion a la aplicacion.');
}

console.log('\nTodo listo. Arranca la app con LORDGYM_DB_DRIVER=supabase.\n');
