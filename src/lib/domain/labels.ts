import type {
  AssignmentStatus,
  AthleteStatus,
  ExerciseCategory,
  MetricType,
  SetType,
  StaffRole,
} from '@/types/db';

export const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: 'Normal',
  warmup: 'Calentamiento',
  top_set: 'Top set',
  back_off: 'Back-off',
  drop_set: 'Drop set',
  superset: 'Superserie',
  triset: 'Triserie',
  circuit: 'Circuito',
  amrap: 'AMRAP',
  emom: 'EMOM',
  isometric: 'Isométrico',
  eccentric: 'Excéntrico',
};

export const SET_TYPE_ORDER: SetType[] = [
  'normal',
  'warmup',
  'top_set',
  'back_off',
  'drop_set',
  'superset',
  'triset',
  'circuit',
  'amrap',
  'emom',
  'isometric',
  'eccentric',
];

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  pecho: 'Pecho',
  espalda: 'Espalda',
  hombro: 'Hombro',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  pierna: 'Pierna',
  core: 'Core',
  calistenia: 'Calistenia',
  gimnasio: 'Gimnasio',
  movilidad: 'Movilidad',
  pliometria: 'Pliometría',
  velocidad: 'Velocidad',
  agilidad: 'Agilidad',
  prevencion: 'Prevención',
  cardio: 'Cardio',
  rehabilitacion: 'Rehabilitación',
};

export const CATEGORY_ORDER: ExerciseCategory[] = [
  'pecho',
  'espalda',
  'hombro',
  'biceps',
  'triceps',
  'pierna',
  'core',
  'calistenia',
  'gimnasio',
  'movilidad',
  'pliometria',
  'velocidad',
  'agilidad',
  'prevencion',
  'cardio',
  'rehabilitacion',
];

export const METRIC_LABELS: Record<MetricType, string> = {
  strength: 'Fuerza (kg × reps)',
  bodyweight: 'Peso corporal (reps)',
  time: 'Tiempo',
  distance: 'Distancia',
  jump: 'Salto',
  cardio: 'Cardio',
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  assigned: 'Pendiente',
  started: 'En curso',
  completed: 'Completado',
  skipped: 'Omitido',
};

export const ATHLETE_STATUS_LABELS: Record<AthleteStatus, string> = {
  active: 'Activo',
  fatigue: 'Fatiga',
  attention: 'Atención',
  inactive: 'Inactivo',
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  head_coach: 'Entrenador principal',
  strength_coach: 'Preparador físico',
  physio: 'Fisioterapeuta',
};

export const FEELING_LABELS = ['Muy mal', 'Mal', 'Normal', 'Bien', 'Muy bien'] as const;

/** Formatea kilos con coma decimal española y sin decimales innecesarios. */
export function formatKg(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toLocaleString('es-ES', { maximumFractionDigits: 2 })} kg`;
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('es-ES', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: digits })}%`;
}

export function formatSigned(value: number | null | undefined, suffix = '%'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('es-ES', { maximumFractionDigits: 1 })}${suffix}`;
}

export function fullName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}

export function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
