/**
 * Esquema de LORDGYM para PostgreSQL «a secas» (Neon, Vercel Postgres, RDS,
 * un servidor propio…).
 *
 * Es la misma estructura que `supabase/schema.sql` **sin las políticas de Row
 * Level Security**, y a propósito: RLS protege los accesos que llegan por una
 * API pública con la clave anónima, algo que aquí no existe. Con una conexión
 * directa el único cliente es el servidor de LORDGYM, y la autorización se
 * aplica en `lib/auth/guards.ts` antes de cada lectura y cada escritura.
 *
 * Todo es `IF NOT EXISTS`, así que aplicarlo dos veces no rompe nada. El driver
 * lo ejecuta solo la primera vez que arranca contra una base vacía.
 */
export const POSTGRES_SCHEMA = `
create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  birth_date date,
  avatar_url text,
  role text not null check (role in ('coach', 'athlete')),
  created_at timestamptz not null default now()
);

create table if not exists coaches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users (id) on delete cascade,
  coach_code text not null unique,
  org_name text,
  staff_role text not null default 'head_coach',
  created_at timestamptz not null default now()
);

create table if not exists athletes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users (id) on delete cascade,
  sport text,
  position text,
  team_name text,
  height_cm numeric(5, 1),
  weight_kg numeric(5, 1),
  laterality text check (laterality in ('diestro', 'zurdo', 'ambidiestro')),
  goals text,
  injuries text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists coach_athletes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches (id) on delete cascade,
  athlete_id uuid not null references athletes (id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (coach_id, athlete_id)
);

create table if not exists app_state (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches (id) on delete cascade,
  name text not null,
  sport text,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  athlete_id uuid not null references athletes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (team_id, athlete_id)
);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  owner_coach_id uuid references coaches (id) on delete cascade,
  name text not null,
  category text not null,
  metric_type text not null default 'strength',
  movement_type text,
  muscles text[] not null default '{}',
  equipment text[] not null default '{}',
  description text,
  technique text,
  video_url text,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches (id) on delete cascade,
  name text not null,
  description text,
  goal text,
  estimated_minutes integer,
  level text,
  category text,
  is_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete restrict,
  position integer not null default 0,
  superset_group text,
  rest_seconds integer not null default 90,
  tempo text,
  notes text
);

create table if not exists workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references workout_exercises (id) on delete cascade,
  set_index integer not null,
  set_type text not null default 'normal',
  target_reps integer,
  target_weight_kg numeric(6, 2),
  target_percent_1rm numeric(5, 2),
  target_rpe numeric(3, 1),
  target_rir integer,
  target_duration_seconds integer,
  target_distance_m numeric(7, 2),
  target_velocity_ms numeric(5, 2),
  rest_seconds integer,
  notes text
);

create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches (id) on delete cascade,
  name text not null,
  description text,
  weeks_count integer not null default 4,
  start_date date,
  created_at timestamptz not null default now()
);

create table if not exists program_weeks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs (id) on delete cascade,
  week_index integer not null,
  title text,
  notes text,
  unique (program_id, week_index)
);

create table if not exists program_workouts (
  id uuid primary key default gen_random_uuid(),
  program_week_id uuid not null references program_weeks (id) on delete cascade,
  workout_id uuid not null references workouts (id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7)
);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches (id) on delete cascade,
  athlete_id uuid not null references athletes (id) on delete cascade,
  workout_id uuid not null references workouts (id) on delete cascade,
  program_id uuid references programs (id) on delete set null,
  scheduled_date date not null,
  scheduled_time text,
  status text not null default 'assigned',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments (id) on delete set null,
  athlete_id uuid not null references athletes (id) on delete cascade,
  workout_id uuid not null references workouts (id) on delete cascade,
  status text not null default 'started',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer,
  session_rpe numeric(3, 1),
  feeling integer,
  fatigue integer,
  soreness integer,
  comment text,
  total_volume_kg numeric(10, 2) not null default 0,
  training_load_au integer
);

create table if not exists session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions (id) on delete cascade,
  workout_exercise_id uuid references workout_exercises (id) on delete set null,
  exercise_id uuid not null references exercises (id) on delete restrict,
  position integer not null default 0,
  superset_group text,
  rest_seconds integer not null default 90,
  notes text,
  athlete_comment text,
  video_url text
);

create table if not exists session_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references session_exercises (id) on delete cascade,
  set_index integer not null,
  set_type text not null default 'normal',
  target_reps integer,
  target_weight_kg numeric(6, 2),
  actual_reps integer,
  actual_weight_kg numeric(6, 2),
  actual_duration_seconds integer,
  actual_distance_m numeric(7, 2),
  rpe numeric(3, 1),
  status text not null default 'pending',
  completed_at timestamptz
);

create table if not exists personal_records (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete cascade,
  record_type text not null,
  value numeric(10, 2) not null,
  reps integer,
  weight_kg numeric(6, 2),
  achieved_at timestamptz not null default now(),
  session_id uuid references workout_sessions (id) on delete set null,
  unique (athlete_id, exercise_id, record_type)
);

create table if not exists wellness_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes (id) on delete cascade,
  date date not null,
  sleep integer not null,
  energy integer not null,
  stress integer not null,
  fatigue integer not null,
  soreness integer not null,
  motivation integer not null,
  note text,
  created_at timestamptz not null default now(),
  unique (athlete_id, date)
);

create table if not exists pain_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes (id) on delete cascade,
  date date not null,
  body_part text not null,
  side text not null,
  intensity integer not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists bodyweight_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes (id) on delete cascade,
  date date not null,
  weight_kg numeric(5, 1) not null,
  unique (athlete_id, date)
);

create table if not exists tests (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references coaches (id) on delete cascade,
  name text not null,
  unit text not null,
  category text not null default 'General',
  lower_is_better boolean not null default false
);

create table if not exists test_results (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests (id) on delete cascade,
  athlete_id uuid not null references athletes (id) on delete cascade,
  date date not null,
  value numeric(10, 3) not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  thread_key text not null,
  sender_id uuid not null references users (id) on delete cascade,
  recipient_id uuid not null references users (id) on delete cascade,
  body text not null,
  attachment_url text,
  attachment_type text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists coach_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches (id) on delete cascade,
  athlete_id uuid not null references athletes (id) on delete cascade,
  body text not null,
  visible_to_athlete boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes (id) on delete cascade,
  coach_id uuid not null references coaches (id) on delete cascade,
  title text not null,
  metric text not null,
  exercise_id uuid references exercises (id) on delete set null,
  test_id uuid references tests (id) on delete set null,
  start_value numeric(10, 3),
  target_value numeric(10, 3) not null,
  unit text not null default 'kg',
  lower_is_better boolean not null default false,
  due_date date,
  created_at timestamptz not null default now()
);

create index if not exists idx_coach_athletes_coach on coach_athletes (coach_id, status);
create index if not exists idx_coach_athletes_athlete on coach_athletes (athlete_id, status);
create index if not exists idx_assignments_athlete_date on assignments (athlete_id, scheduled_date);
create index if not exists idx_assignments_coach_date on assignments (coach_id, scheduled_date);
create index if not exists idx_sessions_athlete on workout_sessions (athlete_id, status, completed_at desc);
create index if not exists idx_session_exercises_session on session_exercises (session_id);
create index if not exists idx_session_exercises_exercise on session_exercises (exercise_id);
create index if not exists idx_session_sets_exercise on session_sets (session_exercise_id);
create index if not exists idx_workout_exercises_workout on workout_exercises (workout_id, position);
create index if not exists idx_workout_sets_exercise on workout_sets (workout_exercise_id, set_index);
create index if not exists idx_records_athlete on personal_records (athlete_id, exercise_id);
create index if not exists idx_wellness_athlete_date on wellness_logs (athlete_id, date desc);
create index if not exists idx_pain_athlete_date on pain_logs (athlete_id, date desc);
create index if not exists idx_bodyweight_athlete_date on bodyweight_logs (athlete_id, date desc);
create index if not exists idx_test_results_athlete on test_results (athlete_id, test_id, date desc);
create index if not exists idx_messages_thread on messages (thread_key, created_at);
create index if not exists idx_notifications_user on notifications (user_id, created_at desc);
create index if not exists idx_auth_sessions_user on auth_sessions (user_id, expires_at);
`;
