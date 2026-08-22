/**
 * Modelo de datos de LORDGYM.
 *
 * Cada interfaz representa una fila de una tabla. Los nombres de campo usan
 * snake_case para que el mismo tipo sirva tanto al driver local (JSON) como al
 * driver de Supabase/PostgreSQL sin capa de traducción.
 *
 * Reglas:
 *  - Las fechas con hora se guardan en UTC (ISO 8601, sufijo `Z`).
 *  - Las fechas "de calendario" (día de entrenamiento, check-in) se guardan como
 *    `YYYY-MM-DD` en la zona del usuario, porque representan un día natural.
 *  - Una plantilla de entrenamiento (`workouts`) NUNCA se sobrescribe con los
 *    resultados: éstos viven en `workout_sessions` / `session_sets`.
 */

export type Role = 'coach' | 'athlete';

/** Roles de staff. El MVP sólo activa `head_coach`, el resto queda preparado. */
export type StaffRole = 'head_coach' | 'strength_coach' | 'physio';

export type LinkStatus = 'pending' | 'active' | 'rejected' | 'archived';

export type AssignmentStatus = 'assigned' | 'started' | 'completed' | 'skipped';

export type SetStatus = 'pending' | 'completed' | 'skipped';

export type SetType =
  | 'normal'
  | 'warmup'
  | 'top_set'
  | 'back_off'
  | 'drop_set'
  | 'superset'
  | 'triset'
  | 'circuit'
  | 'amrap'
  | 'emom'
  | 'isometric'
  | 'eccentric';

/** Determina qué campos pide la UI al registrar una serie. */
export type MetricType = 'strength' | 'bodyweight' | 'time' | 'distance' | 'jump' | 'cardio';

export type ExerciseCategory =
  | 'pecho'
  | 'espalda'
  | 'hombro'
  | 'biceps'
  | 'triceps'
  | 'pierna'
  | 'core'
  | 'movilidad'
  | 'pliometria'
  | 'velocidad'
  | 'agilidad'
  | 'prevencion'
  | 'cardio'
  | 'rehabilitacion';

export type RecordType = 'weight' | 'reps' | 'e1rm' | 'volume' | 'time' | 'distance';

export type AthleteStatus = 'active' | 'fatigue' | 'attention' | 'inactive';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  avatar_url: string | null;
  role: Role;
  created_at: string;
}

export interface CoachRow {
  id: string;
  user_id: string;
  coach_code: string;
  org_name: string | null;
  staff_role: StaffRole;
  created_at: string;
}

export interface AthleteRow {
  id: string;
  user_id: string;
  sport: string | null;
  position: string | null;
  team_name: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  laterality: 'diestro' | 'zurdo' | 'ambidiestro' | null;
  goals: string | null;
  injuries: string | null;
  notes: string | null;
  created_at: string;
}

export interface CoachAthleteRow {
  id: string;
  coach_id: string;
  athlete_id: string;
  status: LinkStatus;
  requested_at: string;
  responded_at: string | null;
}

export interface TeamRow {
  id: string;
  coach_id: string;
  name: string;
  sport: string | null;
  category: string | null;
  created_at: string;
}

export interface TeamMemberRow {
  id: string;
  team_id: string;
  athlete_id: string;
  created_at: string;
}

export interface ExerciseRow {
  id: string;
  /** `null` = ejercicio de la biblioteca global de LORDGYM. */
  owner_coach_id: string | null;
  name: string;
  category: ExerciseCategory;
  metric_type: MetricType;
  movement_type: string | null;
  muscles: string[];
  equipment: string[];
  description: string | null;
  technique: string | null;
  video_url: string | null;
  image_url: string | null;
  created_at: string;
}

export interface WorkoutRow {
  id: string;
  coach_id: string;
  name: string;
  description: string | null;
  goal: string | null;
  estimated_minutes: number | null;
  level: 'iniciacion' | 'intermedio' | 'avanzado' | null;
  category: string | null;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkoutExerciseRow {
  id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
  /** Ejercicios con el mismo grupo se ejecutan encadenados (superserie). */
  superset_group: string | null;
  rest_seconds: number;
  tempo: string | null;
  notes: string | null;
}

export interface WorkoutSetRow {
  id: string;
  workout_exercise_id: string;
  set_index: number;
  set_type: SetType;
  target_reps: number | null;
  target_weight_kg: number | null;
  target_percent_1rm: number | null;
  target_rpe: number | null;
  target_rir: number | null;
  target_duration_seconds: number | null;
  target_distance_m: number | null;
  target_velocity_ms: number | null;
  rest_seconds: number | null;
  notes: string | null;
}

export interface ProgramRow {
  id: string;
  coach_id: string;
  name: string;
  description: string | null;
  weeks_count: number;
  start_date: string | null;
  created_at: string;
}

export interface ProgramWeekRow {
  id: string;
  program_id: string;
  week_index: number;
  title: string | null;
  notes: string | null;
}

export interface ProgramWorkoutRow {
  id: string;
  program_week_id: string;
  workout_id: string;
  /** 1 = lunes … 7 = domingo (ISO-8601). */
  day_of_week: number;
}

export interface AssignmentRow {
  id: string;
  coach_id: string;
  athlete_id: string;
  workout_id: string;
  program_id: string | null;
  /** `YYYY-MM-DD` en zona del usuario. */
  scheduled_date: string;
  /** `HH:mm` opcional. */
  scheduled_time: string | null;
  status: AssignmentStatus;
  notes: string | null;
  created_at: string;
}

export interface WorkoutSessionRow {
  id: string;
  assignment_id: string | null;
  athlete_id: string;
  workout_id: string;
  status: AssignmentStatus;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  session_rpe: number | null;
  feeling: number | null;
  fatigue: number | null;
  soreness: number | null;
  comment: string | null;
  total_volume_kg: number;
  training_load_au: number | null;
}

export interface SessionExerciseRow {
  id: string;
  session_id: string;
  workout_exercise_id: string | null;
  exercise_id: string;
  position: number;
  superset_group: string | null;
  rest_seconds: number;
  notes: string | null;
  athlete_comment: string | null;
  video_url: string | null;
}

export interface SessionSetRow {
  id: string;
  session_exercise_id: string;
  set_index: number;
  set_type: SetType;
  target_reps: number | null;
  target_weight_kg: number | null;
  actual_reps: number | null;
  actual_weight_kg: number | null;
  actual_duration_seconds: number | null;
  actual_distance_m: number | null;
  rpe: number | null;
  status: SetStatus;
  completed_at: string | null;
}

export interface PersonalRecordRow {
  id: string;
  athlete_id: string;
  exercise_id: string;
  record_type: RecordType;
  value: number;
  reps: number | null;
  weight_kg: number | null;
  achieved_at: string;
  session_id: string | null;
}

export interface WellnessLogRow {
  id: string;
  athlete_id: string;
  date: string;
  sleep: number;
  energy: number;
  stress: number;
  fatigue: number;
  soreness: number;
  motivation: number;
  note: string | null;
  created_at: string;
}

export interface PainLogRow {
  id: string;
  athlete_id: string;
  date: string;
  body_part: string;
  side: 'izquierda' | 'derecha' | 'central';
  intensity: number;
  note: string | null;
  created_at: string;
}

export interface BodyweightLogRow {
  id: string;
  athlete_id: string;
  date: string;
  weight_kg: number;
}

export interface TestRow {
  id: string;
  coach_id: string | null;
  name: string;
  unit: string;
  category: string;
  /** `true` para pruebas donde menos es mejor (sprints, agilidad). */
  lower_is_better: boolean;
}

export interface TestResultRow {
  id: string;
  test_id: string;
  athlete_id: string;
  date: string;
  value: number;
  note: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  /** `coachId:athleteId`, estable en ambos sentidos. */
  thread_key: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  attachment_url: string | null;
  attachment_type: 'image' | 'video' | null;
  created_at: string;
  read_at: string | null;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: 'assignment' | 'reminder' | 'record' | 'comment' | 'link_request' | 'alert';
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
}

export interface CoachNoteRow {
  id: string;
  coach_id: string;
  athlete_id: string;
  body: string;
  visible_to_athlete: boolean;
  created_at: string;
}

export interface GoalRow {
  id: string;
  athlete_id: string;
  coach_id: string;
  title: string;
  metric: 'exercise_e1rm' | 'exercise_weight' | 'test' | 'bodyweight' | 'custom';
  exercise_id: string | null;
  test_id: string | null;
  start_value: number | null;
  target_value: number;
  unit: string;
  lower_is_better: boolean;
  due_date: string | null;
  created_at: string;
}

/**
 * Estado interno de la aplicación. Hoy sólo guarda la marca de sembrado, que
 * sirve además de cerrojo atómico: en serverless pueden arrancar varias
 * instancias a la vez y sólo una debe sembrar (la clave primaria lo garantiza).
 */
export interface AppStateRow {
  key: string;
  value: string;
  created_at: string;
}

export interface SessionTokenRow {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

/** Mapa tabla → tipo de fila. Es la fuente de verdad del driver de datos. */
export interface Tables {
  users: UserRow;
  profiles: ProfileRow;
  coaches: CoachRow;
  athletes: AthleteRow;
  coach_athletes: CoachAthleteRow;
  teams: TeamRow;
  team_members: TeamMemberRow;
  exercises: ExerciseRow;
  workouts: WorkoutRow;
  workout_exercises: WorkoutExerciseRow;
  workout_sets: WorkoutSetRow;
  programs: ProgramRow;
  program_weeks: ProgramWeekRow;
  program_workouts: ProgramWorkoutRow;
  assignments: AssignmentRow;
  workout_sessions: WorkoutSessionRow;
  session_exercises: SessionExerciseRow;
  session_sets: SessionSetRow;
  personal_records: PersonalRecordRow;
  wellness_logs: WellnessLogRow;
  pain_logs: PainLogRow;
  bodyweight_logs: BodyweightLogRow;
  tests: TestRow;
  test_results: TestResultRow;
  messages: MessageRow;
  notifications: NotificationRow;
  coach_notes: CoachNoteRow;
  goals: GoalRow;
  auth_sessions: SessionTokenRow;
  app_state: AppStateRow;
}

export type TableName = keyof Tables;

export const TABLE_NAMES: TableName[] = [
  'users',
  'profiles',
  'coaches',
  'athletes',
  'coach_athletes',
  'teams',
  'team_members',
  'exercises',
  'workouts',
  'workout_exercises',
  'workout_sets',
  'programs',
  'program_weeks',
  'program_workouts',
  'assignments',
  'workout_sessions',
  'session_exercises',
  'session_sets',
  'personal_records',
  'wellness_logs',
  'pain_logs',
  'bodyweight_logs',
  'tests',
  'test_results',
  'messages',
  'notifications',
  'coach_notes',
  'goals',
  'auth_sessions',
  'app_state',
];
