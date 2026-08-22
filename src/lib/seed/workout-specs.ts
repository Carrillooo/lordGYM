import type { SetType } from '@/types/db';

export interface SeedSetSpec {
  type?: SetType;
  reps?: number | null;
  weightKg?: number | null;
  percent1rm?: number | null;
  rpe?: number | null;
  rir?: number | null;
  durationSeconds?: number | null;
  distanceM?: number | null;
  restSeconds?: number | null;
  notes?: string;
}

export interface SeedWorkoutExerciseSpec {
  slug: string;
  restSeconds: number;
  tempo?: string;
  notes?: string;
  supersetGroup?: string;
  sets: SeedSetSpec[];
}

export interface SeedWorkoutSpec {
  key: string;
  name: string;
  description: string;
  goal: string;
  estimatedMinutes: number;
  level: 'iniciacion' | 'intermedio' | 'avanzado';
  category: string;
  isTemplate: boolean;
  exercises: SeedWorkoutExerciseSpec[];
}

const uniform = (count: number, set: SeedSetSpec): SeedSetSpec[] => Array.from({ length: count }, () => ({ ...set }));

/**
 * Sesiones demo (§85). `FUERZA + POTENCIA A` reproduce exactamente el ejemplo
 * del brief; el resto completa una microsemana realista de deporte de equipo.
 */
export const WORKOUT_SPECS: SeedWorkoutSpec[] = [
  {
    key: 'fuerza-potencia-a',
    name: 'FUERZA + POTENCIA A',
    description: 'Sesión mixta de fuerza de tren superior y transferencia a potencia.',
    goal: 'Fuerza máxima y potencia',
    estimatedMinutes: 60,
    level: 'intermedio',
    category: 'Fuerza',
    isTemplate: true,
    exercises: [
      { slug: 'press-banca', restSeconds: 150, sets: uniform(4, { reps: 6, weightKg: 60, rpe: 8 }) },
      { slug: 'dominadas', restSeconds: 120, sets: uniform(4, { reps: 8, rpe: 8 }) },
      { slug: 'landmine-press', restSeconds: 90, sets: uniform(3, { reps: 8, weightKg: 25, rpe: 7 }) },
      { slug: 'pallof-press', restSeconds: 60, sets: uniform(3, { reps: 12, weightKg: 15 }) },
      {
        slug: 'box-jump',
        restSeconds: 90,
        notes: 'Máxima calidad de salto. Si baja la altura, corta la serie.',
        sets: uniform(4, { reps: 5 }),
      },
      {
        slug: 'sprint-10m',
        restSeconds: 120,
        notes: '6 repeticiones al 100%. Recuperación completa entre salidas.',
        sets: uniform(6, { reps: 1, distanceM: 10 }),
      },
    ],
  },
  {
    key: 'fuerza-superior-a',
    name: 'FUERZA TREN SUPERIOR A',
    description: 'Empujes y tracciones en superserie para ganar densidad de trabajo.',
    goal: 'Hipertrofia y fuerza de tren superior',
    estimatedMinutes: 50,
    level: 'intermedio',
    category: 'Fuerza',
    isTemplate: true,
    exercises: [
      {
        slug: 'press-banca',
        restSeconds: 0,
        supersetGroup: 'A',
        sets: [
          { type: 'warmup', reps: 10, weightKg: 30 },
          { reps: 8, weightKg: 55, rpe: 7 },
          { reps: 8, weightKg: 57.5, rpe: 8 },
          { type: 'top_set', reps: 6, weightKg: 60, rpe: 9 },
        ],
      },
      {
        slug: 'remo-mancuerna',
        restSeconds: 120,
        supersetGroup: 'A',
        notes: 'Superserie con press banca: A1 → A2 → descanso.',
        sets: uniform(4, { reps: 10, weightKg: 24, rpe: 8 }),
      },
      { slug: 'press-militar', restSeconds: 120, sets: uniform(3, { reps: 8, weightKg: 35, rpe: 8 }) },
      { slug: 'face-pull', restSeconds: 60, sets: uniform(3, { reps: 15, weightKg: 20 }) },
      { slug: 'curl-martillo', restSeconds: 60, sets: uniform(3, { reps: 12, weightKg: 12 }) },
    ],
  },
  {
    key: 'fuerza-inferior-b',
    name: 'FUERZA TREN INFERIOR B',
    description: 'Bloque de fuerza de piernas con énfasis en cadena posterior.',
    goal: 'Fuerza de tren inferior',
    estimatedMinutes: 65,
    level: 'intermedio',
    category: 'Fuerza',
    isTemplate: true,
    exercises: [
      {
        slug: 'sentadilla',
        restSeconds: 180,
        tempo: '3-1-X',
        sets: [
          { type: 'warmup', reps: 8, weightKg: 40 },
          { reps: 5, weightKg: 80, rpe: 7 },
          { reps: 5, weightKg: 85, rpe: 8 },
          { type: 'top_set', reps: 5, weightKg: 90, rpe: 9 },
        ],
      },
      { slug: 'peso-muerto-rumano', restSeconds: 150, sets: uniform(3, { reps: 8, weightKg: 70, rpe: 8 }) },
      { slug: 'sentadilla-bulgara', restSeconds: 90, sets: uniform(3, { reps: 10, weightKg: 20, rpe: 8 }) },
      { slug: 'nordic-curl', restSeconds: 120, sets: uniform(3, { reps: 5 }) },
      { slug: 'elevacion-talones', restSeconds: 60, sets: uniform(3, { reps: 15, weightKg: 20 }) },
    ],
  },
  {
    key: 'velocidad-agilidad',
    name: 'VELOCIDAD Y AGILIDAD',
    description: 'Aceleraciones y cambios de dirección a máxima intensidad.',
    goal: 'Velocidad y cambio de dirección',
    estimatedMinutes: 45,
    level: 'intermedio',
    category: 'Velocidad',
    isTemplate: true,
    exercises: [
      { slug: 'pogo-jumps', restSeconds: 60, sets: uniform(3, { reps: 12 }) },
      { slug: 'sprint-10m', restSeconds: 120, sets: uniform(4, { reps: 1, distanceM: 10 }) },
      { slug: 'sprint-20m', restSeconds: 150, sets: uniform(4, { reps: 1, distanceM: 20 }) },
      { slug: 'sprint-30m', restSeconds: 180, sets: uniform(2, { reps: 1, distanceM: 30 }) },
      { slug: 'test-5-10-5', restSeconds: 150, sets: uniform(4, { reps: 1, durationSeconds: 5 }) },
    ],
  },
  {
    key: 'movilidad-prevencion',
    name: 'MOVILIDAD Y PREVENCIÓN',
    description: 'Sesión de recuperación activa, movilidad y prevención de lesiones.',
    goal: 'Movilidad y prevención',
    estimatedMinutes: 35,
    level: 'iniciacion',
    category: 'Prevención',
    isTemplate: true,
    exercises: [
      { slug: 'movilidad-cadera', restSeconds: 30, sets: uniform(2, { durationSeconds: 60 }) },
      { slug: 'movilidad-toracica', restSeconds: 30, sets: uniform(2, { durationSeconds: 60 }) },
      { slug: 'movilidad-tobillo', restSeconds: 30, sets: uniform(2, { durationSeconds: 45 }) },
      { slug: 'copenhagen-plank', restSeconds: 45, sets: uniform(3, { type: 'isometric', durationSeconds: 25 }) },
      { slug: 'monster-walk', restSeconds: 45, sets: uniform(3, { durationSeconds: 40 }) },
      { slug: 'propiocepcion-tobillo', restSeconds: 30, sets: uniform(3, { durationSeconds: 30 }) },
    ],
  },
  {
    key: 'core-prevencion',
    name: 'CORE + PREVENCIÓN',
    description: 'Bloque corto de core anti-rotación y prevención de isquiotibiales.',
    goal: 'Core y prevención',
    estimatedMinutes: 25,
    level: 'iniciacion',
    category: 'Core',
    isTemplate: true,
    exercises: [
      { slug: 'plancha', restSeconds: 45, sets: uniform(3, { type: 'isometric', durationSeconds: 45 }) },
      { slug: 'dead-bug', restSeconds: 45, sets: uniform(3, { reps: 10 }) },
      { slug: 'pallof-press', restSeconds: 45, sets: uniform(3, { reps: 12, weightKg: 15 }) },
      { slug: 'nordic-curl', restSeconds: 90, sets: uniform(3, { reps: 4 }) },
    ],
  },
];
