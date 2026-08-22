/**
 * Métricas de progresión por ejercicio (§11).
 *
 * Vive en `domain` y no en `services` porque lo consumen tanto el servidor
 * (cálculo) como los selectores del cliente: `services/progress.ts` es
 * server-only y no puede llegar al bundle del navegador.
 */
export type ExerciseMetric = 'max_weight' | 'volume' | 'e1rm' | 'reps' | 'rpe';

export const EXERCISE_METRICS: ExerciseMetric[] = ['max_weight', 'volume', 'e1rm', 'reps', 'rpe'];

export const EXERCISE_METRIC_LABELS: Record<ExerciseMetric, string> = {
  max_weight: 'Peso máximo',
  volume: 'Volumen',
  e1rm: '1RM estimado',
  reps: 'Repeticiones',
  rpe: 'RPE',
};

export const EXERCISE_METRIC_UNITS: Record<ExerciseMetric, string> = {
  max_weight: 'kg',
  volume: 'kg',
  e1rm: 'kg',
  reps: 'reps',
  rpe: '',
};
