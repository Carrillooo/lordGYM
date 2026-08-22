-- ===========================================================================
-- LORDGYM — esquema PostgreSQL / Supabase
--
-- Los nombres de tabla y columna coinciden exactamente con `src/types/db.ts`,
-- de modo que el driver `supabase-driver.ts` no necesita ninguna traducción.
--
-- Ejecutar en el SQL editor de Supabase (o `psql -f supabase/schema.sql`).
-- La biblioteca de ejercicios, las pruebas físicas y los datos demo NO se
-- duplican aquí: los siembra la propia aplicación al arrancar con
-- LORDGYM_DB_DRIVER=supabase sobre una base vacía (`src/lib/seed/`), de modo
-- que exista una única fuente de verdad. Ver `supabase/README.md`.
--
-- Notas de seguridad (§63):
--   * Todas las tablas llevan RLS activado y política por defecto DENY.
--   * Un jugador sólo ve sus propios datos.
--   * Un entrenador sólo ve los jugadores con vínculo `active`.
--   * El backend de LORDGYM aplica ADEMÁS sus propios guardas en servidor
--     (`src/lib/auth/guards.ts`): RLS es la segunda barrera, no la única.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

do $$ begin
  create type lg_role as enum ('coach', 'athlete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lg_staff_role as enum ('head_coach', 'strength_coach', 'physio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lg_link_status as enum ('pending', 'active', 'rejected', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lg_assignment_status as enum ('assigned', 'started', 'completed', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lg_set_status as enum ('pending', 'completed', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lg_set_type as enum (
    'normal', 'warmup', 'top_set', 'back_off', 'drop_set', 'superset',
    'triset', 'circuit', 'amrap', 'emom', 'isometric', 'eccentric'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type lg_metric_type as enum ('strength', 'bodyweight', 'time', 'distance', 'jump', 'cardio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lg_record_type as enum ('weight', 'reps', 'e1rm', 'volume', 'time', 'distance');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Identidad
-- ---------------------------------------------------------------------------

-- `users.id` debe coincidir con `auth.users.id` cuando se usa Supabase Auth.
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  birth_date date,
  avatar_url text,
  role lg_role not null,
  created_at timestamptz not null default now()
);

create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  coach_code text not null unique,
  org_name text,
  staff_role lg_staff_role not null default 'head_coach',
  created_at timestamptz not null default now()
);

create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
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

create table if not exists public.coach_athletes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  status lg_link_status not null default 'pending',
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (coach_id, athlete_id)
);

-- Estado interno de la aplicación. La clave primaria actúa de cerrojo: en
-- serverless varias instancias pueden arrancar a la vez y sólo una debe sembrar.
create table if not exists public.app_state (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Equipos
-- ---------------------------------------------------------------------------

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  name text not null,
  sport text,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (team_id, athlete_id)
);

-- ---------------------------------------------------------------------------
-- Biblioteca de ejercicios
-- ---------------------------------------------------------------------------

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  -- NULL = ejercicio global de LORDGYM, visible para todos los entrenadores.
  owner_coach_id uuid references public.coaches (id) on delete cascade,
  name text not null,
  category text not null,
  metric_type lg_metric_type not null default 'strength',
  movement_type text,
  muscles text[] not null default '{}',
  equipment text[] not null default '{}',
  description text,
  technique text,
  video_url text,
  image_url text,
  figure_key text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Plantillas de entrenamiento (§105: nunca se sobrescriben con resultados)
-- ---------------------------------------------------------------------------

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  name text not null,
  description text,
  goal text,
  estimated_minutes integer,
  level text check (level in ('iniciacion', 'intermedio', 'avanzado')),
  category text,
  is_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null default 0,
  superset_group text,
  rest_seconds integer not null default 90,
  tempo text,
  notes text
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  set_index integer not null,
  set_type lg_set_type not null default 'normal',
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

-- ---------------------------------------------------------------------------
-- Programas
-- ---------------------------------------------------------------------------

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  name text not null,
  description text,
  weeks_count integer not null default 4,
  start_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.program_weeks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  week_index integer not null,
  title text,
  notes text,
  unique (program_id, week_index)
);

create table if not exists public.program_workouts (
  id uuid primary key default gen_random_uuid(),
  program_week_id uuid not null references public.program_weeks (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7)
);

-- ---------------------------------------------------------------------------
-- Asignaciones y ejecución
-- ---------------------------------------------------------------------------

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  program_id uuid references public.programs (id) on delete set null,
  scheduled_date date not null,
  scheduled_time text,
  status lg_assignment_status not null default 'assigned',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments (id) on delete set null,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  status lg_assignment_status not null default 'started',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer,
  session_rpe numeric(3, 1),
  feeling integer check (feeling between 1 and 5),
  fatigue integer check (fatigue between 1 and 10),
  soreness integer check (soreness between 1 and 10),
  comment text,
  total_volume_kg numeric(10, 2) not null default 0,
  training_load_au integer
);

create table if not exists public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  workout_exercise_id uuid references public.workout_exercises (id) on delete set null,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null default 0,
  superset_group text,
  rest_seconds integer not null default 90,
  notes text,
  athlete_comment text,
  video_url text
);

create table if not exists public.session_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises (id) on delete cascade,
  set_index integer not null,
  set_type lg_set_type not null default 'normal',
  target_reps integer,
  target_weight_kg numeric(6, 2),
  actual_reps integer,
  actual_weight_kg numeric(6, 2),
  actual_duration_seconds integer,
  actual_distance_m numeric(7, 2),
  rpe numeric(3, 1),
  status lg_set_status not null default 'pending',
  completed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Seguimiento
-- ---------------------------------------------------------------------------

create table if not exists public.personal_records (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  record_type lg_record_type not null,
  value numeric(10, 2) not null,
  reps integer,
  weight_kg numeric(6, 2),
  achieved_at timestamptz not null default now(),
  session_id uuid references public.workout_sessions (id) on delete set null,
  unique (athlete_id, exercise_id, record_type)
);

create table if not exists public.wellness_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  date date not null,
  sleep integer not null check (sleep between 1 and 5),
  energy integer not null check (energy between 1 and 5),
  stress integer not null check (stress between 1 and 5),
  fatigue integer not null check (fatigue between 1 and 5),
  soreness integer not null check (soreness between 1 and 5),
  motivation integer not null check (motivation between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  unique (athlete_id, date)
);

create table if not exists public.pain_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  date date not null,
  body_part text not null,
  side text not null check (side in ('izquierda', 'derecha', 'central')),
  intensity integer not null check (intensity between 1 and 10),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.bodyweight_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  date date not null,
  weight_kg numeric(5, 1) not null,
  unique (athlete_id, date)
);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.coaches (id) on delete cascade,
  name text not null,
  unit text not null,
  category text not null default 'General',
  lower_is_better boolean not null default false
);

create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  date date not null,
  value numeric(10, 3) not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_key text not null,
  sender_id uuid not null references public.users (id) on delete cascade,
  recipient_id uuid not null references public.users (id) on delete cascade,
  body text not null,
  attachment_url text,
  attachment_type text check (attachment_type in ('image', 'video')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  body text not null,
  visible_to_athlete boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  coach_id uuid not null references public.coaches (id) on delete cascade,
  title text not null,
  metric text not null,
  exercise_id uuid references public.exercises (id) on delete set null,
  test_id uuid references public.tests (id) on delete set null,
  start_value numeric(10, 3),
  target_value numeric(10, 3) not null,
  unit text not null default 'kg',
  lower_is_better boolean not null default false,
  due_date date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index if not exists idx_coach_athletes_coach on public.coach_athletes (coach_id, status);
create index if not exists idx_coach_athletes_athlete on public.coach_athletes (athlete_id, status);
create index if not exists idx_assignments_athlete_date on public.assignments (athlete_id, scheduled_date);
create index if not exists idx_assignments_coach_date on public.assignments (coach_id, scheduled_date);
create index if not exists idx_sessions_athlete on public.workout_sessions (athlete_id, status, completed_at desc);
create index if not exists idx_session_exercises_session on public.session_exercises (session_id);
create index if not exists idx_session_exercises_exercise on public.session_exercises (exercise_id);
create index if not exists idx_session_sets_exercise on public.session_sets (session_exercise_id);
create index if not exists idx_workout_exercises_workout on public.workout_exercises (workout_id, position);
create index if not exists idx_workout_sets_exercise on public.workout_sets (workout_exercise_id, set_index);
create index if not exists idx_records_athlete on public.personal_records (athlete_id, exercise_id);
create index if not exists idx_wellness_athlete_date on public.wellness_logs (athlete_id, date desc);
create index if not exists idx_pain_athlete_date on public.pain_logs (athlete_id, date desc);
create index if not exists idx_bodyweight_athlete_date on public.bodyweight_logs (athlete_id, date desc);
create index if not exists idx_test_results_athlete on public.test_results (athlete_id, test_id, date desc);
create index if not exists idx_messages_thread on public.messages (thread_key, created_at);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);
create index if not exists idx_auth_sessions_user on public.auth_sessions (user_id, expires_at);

-- ---------------------------------------------------------------------------
-- Helpers de RLS
-- ---------------------------------------------------------------------------

create or replace function public.lg_current_coach_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.coaches where user_id = auth.uid();
$$;

create or replace function public.lg_current_athlete_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.athletes where user_id = auth.uid();
$$;

create or replace function public.lg_coach_has_athlete(target_athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coach_athletes ca
    join public.coaches c on c.id = ca.coach_id
    where c.user_id = auth.uid()
      and ca.athlete_id = target_athlete
      and ca.status = 'active'
  );
$$;

create or replace function public.lg_athlete_has_coach(target_coach uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coach_athletes ca
    join public.athletes a on a.id = ca.athlete_id
    where a.user_id = auth.uid()
      and ca.coach_id = target_coach
      and ca.status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.users             enable row level security;
alter table public.profiles          enable row level security;
alter table public.coaches           enable row level security;
alter table public.athletes          enable row level security;
alter table public.coach_athletes    enable row level security;
alter table public.auth_sessions     enable row level security;
alter table public.teams             enable row level security;
alter table public.team_members      enable row level security;
alter table public.exercises         enable row level security;
alter table public.workouts          enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets      enable row level security;
alter table public.programs          enable row level security;
alter table public.program_weeks     enable row level security;
alter table public.program_workouts  enable row level security;
alter table public.assignments       enable row level security;
alter table public.workout_sessions  enable row level security;
alter table public.session_exercises enable row level security;
alter table public.session_sets      enable row level security;
alter table public.personal_records  enable row level security;
alter table public.wellness_logs     enable row level security;
alter table public.pain_logs         enable row level security;
alter table public.bodyweight_logs   enable row level security;
alter table public.tests             enable row level security;
alter table public.test_results      enable row level security;
alter table public.messages          enable row level security;
alter table public.notifications     enable row level security;
alter table public.coach_notes       enable row level security;
alter table public.goals             enable row level security;
-- `app_state` queda con RLS activado y sin políticas: nadie accede con la anon
-- key. Sólo el servidor (service role) lo lee y escribe.
alter table public.app_state         enable row level security;

-- Identidad ------------------------------------------------------------------

drop policy if exists users_self on public.users;
create policy users_self on public.users
  for select using (id = auth.uid());

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using (
    user_id = auth.uid()
    -- El entrenador ve el perfil de sus jugadores y viceversa.
    or exists (select 1 from public.athletes a where a.user_id = profiles.user_id and public.lg_coach_has_athlete(a.id))
    or exists (select 1 from public.coaches c where c.user_id = profiles.user_id and public.lg_athlete_has_coach(c.id))
  );

drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists coaches_read on public.coaches;
create policy coaches_read on public.coaches
  -- El código de entrenador es público a propósito: es la vía de invitación.
  for select using (true);

drop policy if exists coaches_write on public.coaches;
create policy coaches_write on public.coaches
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists athletes_read on public.athletes;
create policy athletes_read on public.athletes
  for select using (user_id = auth.uid() or public.lg_coach_has_athlete(id));

drop policy if exists athletes_write on public.athletes;
create policy athletes_write on public.athletes
  for update using (user_id = auth.uid() or public.lg_coach_has_athlete(id))
  with check (user_id = auth.uid() or public.lg_coach_has_athlete(id));

drop policy if exists coach_athletes_read on public.coach_athletes;
create policy coach_athletes_read on public.coach_athletes
  for select using (coach_id = public.lg_current_coach_id() or athlete_id = public.lg_current_athlete_id());

drop policy if exists coach_athletes_insert on public.coach_athletes;
create policy coach_athletes_insert on public.coach_athletes
  for insert with check (athlete_id = public.lg_current_athlete_id());

drop policy if exists coach_athletes_update on public.coach_athletes;
create policy coach_athletes_update on public.coach_athletes
  for update using (coach_id = public.lg_current_coach_id())
  with check (coach_id = public.lg_current_coach_id());

drop policy if exists auth_sessions_self on public.auth_sessions;
create policy auth_sessions_self on public.auth_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Equipos --------------------------------------------------------------------

drop policy if exists teams_owner on public.teams;
create policy teams_owner on public.teams
  for all using (coach_id = public.lg_current_coach_id())
  with check (coach_id = public.lg_current_coach_id());

drop policy if exists team_members_scope on public.team_members;
create policy team_members_scope on public.team_members
  for all using (
    exists (select 1 from public.teams t where t.id = team_id and t.coach_id = public.lg_current_coach_id())
    or athlete_id = public.lg_current_athlete_id()
  )
  with check (exists (select 1 from public.teams t where t.id = team_id and t.coach_id = public.lg_current_coach_id()));

-- Ejercicios -----------------------------------------------------------------

drop policy if exists exercises_read on public.exercises;
create policy exercises_read on public.exercises
  -- Los globales los ve todo el mundo; los propios, sólo su autor. El jugador
  -- accede al detalle de los ejercicios que le han asignado.
  for select using (
    owner_coach_id is null
    or owner_coach_id = public.lg_current_coach_id()
    or exists (
      select 1
      from public.session_exercises se
      join public.workout_sessions ws on ws.id = se.session_id
      where se.exercise_id = exercises.id and ws.athlete_id = public.lg_current_athlete_id()
    )
  );

drop policy if exists exercises_write on public.exercises;
create policy exercises_write on public.exercises
  for all using (owner_coach_id = public.lg_current_coach_id())
  with check (owner_coach_id = public.lg_current_coach_id());

-- Plantillas -----------------------------------------------------------------

drop policy if exists workouts_scope on public.workouts;
create policy workouts_scope on public.workouts
  for all using (
    coach_id = public.lg_current_coach_id()
    or exists (
      select 1 from public.assignments a
      where a.workout_id = workouts.id and a.athlete_id = public.lg_current_athlete_id()
    )
  )
  with check (coach_id = public.lg_current_coach_id());

drop policy if exists workout_exercises_scope on public.workout_exercises;
create policy workout_exercises_scope on public.workout_exercises
  for all using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id
        and (
          w.coach_id = public.lg_current_coach_id()
          or exists (
            select 1 from public.assignments a
            where a.workout_id = w.id and a.athlete_id = public.lg_current_athlete_id()
          )
        )
    )
  )
  with check (
    exists (select 1 from public.workouts w where w.id = workout_id and w.coach_id = public.lg_current_coach_id())
  );

drop policy if exists workout_sets_scope on public.workout_sets;
create policy workout_sets_scope on public.workout_sets
  for all using (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id
        and (
          w.coach_id = public.lg_current_coach_id()
          or exists (
            select 1 from public.assignments a
            where a.workout_id = w.id and a.athlete_id = public.lg_current_athlete_id()
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id and w.coach_id = public.lg_current_coach_id()
    )
  );

-- Programas ------------------------------------------------------------------

drop policy if exists programs_owner on public.programs;
create policy programs_owner on public.programs
  for all using (coach_id = public.lg_current_coach_id())
  with check (coach_id = public.lg_current_coach_id());

drop policy if exists program_weeks_owner on public.program_weeks;
create policy program_weeks_owner on public.program_weeks
  for all using (exists (select 1 from public.programs p where p.id = program_id and p.coach_id = public.lg_current_coach_id()))
  with check (exists (select 1 from public.programs p where p.id = program_id and p.coach_id = public.lg_current_coach_id()));

drop policy if exists program_workouts_owner on public.program_workouts;
create policy program_workouts_owner on public.program_workouts
  for all using (
    exists (
      select 1 from public.program_weeks pw
      join public.programs p on p.id = pw.program_id
      where pw.id = program_week_id and p.coach_id = public.lg_current_coach_id()
    )
  )
  with check (
    exists (
      select 1 from public.program_weeks pw
      join public.programs p on p.id = pw.program_id
      where pw.id = program_week_id and p.coach_id = public.lg_current_coach_id()
    )
  );

-- Asignaciones y ejecución ---------------------------------------------------

drop policy if exists assignments_read on public.assignments;
create policy assignments_read on public.assignments
  for select using (coach_id = public.lg_current_coach_id() or athlete_id = public.lg_current_athlete_id());

drop policy if exists assignments_coach_write on public.assignments;
create policy assignments_coach_write on public.assignments
  for all using (coach_id = public.lg_current_coach_id())
  with check (coach_id = public.lg_current_coach_id() and public.lg_coach_has_athlete(athlete_id));

drop policy if exists assignments_athlete_status on public.assignments;
create policy assignments_athlete_status on public.assignments
  -- El jugador sólo puede mover el estado de sus propias asignaciones.
  for update using (athlete_id = public.lg_current_athlete_id())
  with check (athlete_id = public.lg_current_athlete_id());

drop policy if exists sessions_scope on public.workout_sessions;
create policy sessions_scope on public.workout_sessions
  for select using (athlete_id = public.lg_current_athlete_id() or public.lg_coach_has_athlete(athlete_id));

drop policy if exists sessions_athlete_write on public.workout_sessions;
create policy sessions_athlete_write on public.workout_sessions
  for all using (athlete_id = public.lg_current_athlete_id())
  with check (athlete_id = public.lg_current_athlete_id());

drop policy if exists session_exercises_scope on public.session_exercises;
create policy session_exercises_scope on public.session_exercises
  for all using (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = session_id
        and (ws.athlete_id = public.lg_current_athlete_id() or public.lg_coach_has_athlete(ws.athlete_id))
    )
  )
  with check (
    exists (select 1 from public.workout_sessions ws where ws.id = session_id and ws.athlete_id = public.lg_current_athlete_id())
  );

drop policy if exists session_sets_scope on public.session_sets;
create policy session_sets_scope on public.session_sets
  for all using (
    exists (
      select 1
      from public.session_exercises se
      join public.workout_sessions ws on ws.id = se.session_id
      where se.id = session_exercise_id
        and (ws.athlete_id = public.lg_current_athlete_id() or public.lg_coach_has_athlete(ws.athlete_id))
    )
  )
  with check (
    exists (
      select 1
      from public.session_exercises se
      join public.workout_sessions ws on ws.id = se.session_id
      where se.id = session_exercise_id and ws.athlete_id = public.lg_current_athlete_id()
    )
  );

-- Seguimiento ----------------------------------------------------------------

drop policy if exists records_scope on public.personal_records;
create policy records_scope on public.personal_records
  for all using (athlete_id = public.lg_current_athlete_id() or public.lg_coach_has_athlete(athlete_id))
  with check (athlete_id = public.lg_current_athlete_id());

drop policy if exists wellness_scope on public.wellness_logs;
create policy wellness_scope on public.wellness_logs
  for all using (athlete_id = public.lg_current_athlete_id() or public.lg_coach_has_athlete(athlete_id))
  with check (athlete_id = public.lg_current_athlete_id());

drop policy if exists pain_scope on public.pain_logs;
create policy pain_scope on public.pain_logs
  for all using (athlete_id = public.lg_current_athlete_id() or public.lg_coach_has_athlete(athlete_id))
  with check (athlete_id = public.lg_current_athlete_id());

drop policy if exists bodyweight_scope on public.bodyweight_logs;
create policy bodyweight_scope on public.bodyweight_logs
  for all using (athlete_id = public.lg_current_athlete_id() or public.lg_coach_has_athlete(athlete_id))
  with check (athlete_id = public.lg_current_athlete_id());

drop policy if exists tests_read on public.tests;
create policy tests_read on public.tests
  for select using (coach_id is null or coach_id = public.lg_current_coach_id() or public.lg_athlete_has_coach(coach_id));

drop policy if exists tests_write on public.tests;
create policy tests_write on public.tests
  for all using (coach_id = public.lg_current_coach_id())
  with check (coach_id = public.lg_current_coach_id());

drop policy if exists test_results_scope on public.test_results;
create policy test_results_scope on public.test_results
  for select using (athlete_id = public.lg_current_athlete_id() or public.lg_coach_has_athlete(athlete_id));

drop policy if exists test_results_coach_write on public.test_results;
create policy test_results_coach_write on public.test_results
  for all using (public.lg_coach_has_athlete(athlete_id))
  with check (public.lg_coach_has_athlete(athlete_id));

drop policy if exists messages_scope on public.messages;
create policy messages_scope on public.messages
  for select using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages
  for insert with check (sender_id = auth.uid());

drop policy if exists messages_mark_read on public.messages;
create policy messages_mark_read on public.messages
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

drop policy if exists notifications_self on public.notifications;
create policy notifications_self on public.notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists coach_notes_scope on public.coach_notes;
create policy coach_notes_scope on public.coach_notes
  -- El jugador sólo ve las notas marcadas como visibles (§42).
  for select using (
    coach_id = public.lg_current_coach_id()
    or (visible_to_athlete and athlete_id = public.lg_current_athlete_id())
  );

drop policy if exists coach_notes_write on public.coach_notes;
create policy coach_notes_write on public.coach_notes
  for all using (coach_id = public.lg_current_coach_id())
  with check (coach_id = public.lg_current_coach_id());

drop policy if exists goals_scope on public.goals;
create policy goals_scope on public.goals
  for select using (athlete_id = public.lg_current_athlete_id() or coach_id = public.lg_current_coach_id());

drop policy if exists goals_write on public.goals;
create policy goals_write on public.goals
  for all using (coach_id = public.lg_current_coach_id())
  with check (coach_id = public.lg_current_coach_id() and public.lg_coach_has_athlete(athlete_id));

-- ---------------------------------------------------------------------------
-- Trigger: mantener `workouts.updated_at`
-- ---------------------------------------------------------------------------

create or replace function public.lg_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_workouts_updated_at on public.workouts;
create trigger trg_workouts_updated_at
  before update on public.workouts
  for each row execute function public.lg_touch_updated_at();
