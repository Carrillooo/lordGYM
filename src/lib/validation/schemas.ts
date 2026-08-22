import { z } from 'zod';
import { CATEGORY_ORDER, SET_TYPE_ORDER } from '@/lib/domain/labels';

/**
 * Normaliza "vacío" a `undefined` para que `.optional()` funcione tanto con
 * `FormData` (que da `null` cuando el campo no existe) como con los payloads
 * JSON de los componentes cliente, que envían `null` explícito.
 */
const emptyToUndefined = (value: unknown) =>
  value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value;

export const optionalString = z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional());
export const optionalNumber = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (typeof value === 'string') return Number(value.replace(',', '.'));
    return value;
  },
  z.number().finite().optional(),
);

export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida (YYYY-MM-DD)');
export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Hora no válida (HH:mm)');

export const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Introduce un email válido.'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(200),
    firstName: z.string().trim().min(1, 'El nombre es obligatorio.').max(80),
    lastName: z.string().trim().min(1, 'Los apellidos son obligatorios.').max(120),
    birthDate: z.preprocess(emptyToUndefined, dateKeySchema.optional()),
    role: z.enum(['coach', 'athlete']),
    avatarUrl: z.preprocess(emptyToUndefined, z.string().url().max(500).optional()),
    coachCode: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Introduce un email válido.'),
    password: z.string().min(1, 'Introduce tu contraseña.'),
  })
  .strict();

export const athleteProfileSchema = z.object({
  sport: optionalString,
  position: optionalString,
  teamName: optionalString,
  heightCm: optionalNumber,
  weightKg: optionalNumber,
  laterality: z.preprocess(emptyToUndefined, z.enum(['diestro', 'zurdo', 'ambidiestro']).optional()),
  goals: optionalString,
  injuries: optionalString,
  notes: optionalString,
});

export const exerciseSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio.').max(120),
  category: z.enum(CATEGORY_ORDER as [(typeof CATEGORY_ORDER)[number], ...typeof CATEGORY_ORDER]),
  metricType: z.enum(['strength', 'bodyweight', 'time', 'distance', 'jump', 'cardio']),
  movementType: optionalString,
  muscles: z.preprocess(
    (value) => (typeof value === 'string' ? value.split(',').map((m) => m.trim()).filter(Boolean) : value),
    z.array(z.string().max(60)).max(20).default([]),
  ),
  equipment: z.preprocess(
    (value) => (typeof value === 'string' ? value.split(',').map((m) => m.trim()).filter(Boolean) : value),
    z.array(z.string().max(60)).max(20).default([]),
  ),
  description: optionalString,
  technique: optionalString,
  videoUrl: z.preprocess(emptyToUndefined, z.string().url().max(500).optional()),
  imageUrl: z.preprocess(emptyToUndefined, z.string().url().max(500).optional()),
});

export const workoutSchema = z.object({
  name: z.string().trim().min(2, 'Ponle un nombre a la sesión.').max(120),
  description: optionalString,
  goal: optionalString,
  estimatedMinutes: optionalNumber,
  level: z.preprocess(emptyToUndefined, z.enum(['iniciacion', 'intermedio', 'avanzado']).optional()),
  category: optionalString,
  isTemplate: z.coerce.boolean().default(false),
});

export const setConfigSchema = z.object({
  setIndex: z.number().int().min(1).max(50),
  setType: z.enum(SET_TYPE_ORDER as [(typeof SET_TYPE_ORDER)[number], ...typeof SET_TYPE_ORDER]),
  targetReps: optionalNumber,
  targetWeightKg: optionalNumber,
  targetPercent1rm: optionalNumber,
  targetRpe: optionalNumber,
  targetRir: optionalNumber,
  targetDurationSeconds: optionalNumber,
  targetDistanceM: optionalNumber,
  targetVelocityMs: optionalNumber,
  restSeconds: optionalNumber,
  notes: optionalString,
});

export const workoutExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  position: z.number().int().min(0),
  supersetGroup: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
  restSeconds: z.number().int().min(0).max(3600).default(90),
  tempo: optionalString,
  notes: optionalString,
  sets: z.array(setConfigSchema).min(1, 'Añade al menos una serie.').max(50),
});

export const assignSchema = z.object({
  workoutId: z.string().min(1),
  athleteIds: z.array(z.string().min(1)).min(1, 'Selecciona al menos un jugador.'),
  scheduledDate: dateKeySchema,
  scheduledTime: z.preprocess(emptyToUndefined, timeSchema.optional()),
  notes: optionalString,
});

export const logSetSchema = z.object({
  sessionId: z.string().min(1),
  setId: z.string().min(1),
  actualReps: optionalNumber,
  actualWeightKg: optionalNumber,
  actualDurationSeconds: optionalNumber,
  actualDistanceM: optionalNumber,
  rpe: optionalNumber,
  status: z.enum(['pending', 'completed', 'skipped']),
});

export const finishSessionSchema = z.object({
  sessionId: z.string().min(1),
  durationSeconds: z.number().int().min(0).max(60 * 60 * 12),
  sessionRpe: z.number().min(1).max(10),
  feeling: z.number().int().min(1).max(5),
  fatigue: z.number().int().min(1).max(10),
  soreness: z.number().int().min(1).max(10),
  comment: optionalString,
});

export const wellnessSchema = z.object({
  date: dateKeySchema,
  sleep: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5),
  fatigue: z.number().int().min(1).max(5),
  soreness: z.number().int().min(1).max(5),
  motivation: z.number().int().min(1).max(5),
  note: optionalString,
});

export const painSchema = z.object({
  date: dateKeySchema,
  bodyPart: z.string().trim().min(1).max(60),
  side: z.enum(['izquierda', 'derecha', 'central']),
  intensity: z.number().int().min(1).max(10),
  note: optionalString,
});

export const bodyweightSchema = z.object({
  date: dateKeySchema,
  weightKg: z.number().min(20).max(300),
});

export const testResultSchema = z.object({
  testId: z.string().min(1),
  athleteId: z.string().min(1),
  date: dateKeySchema,
  value: z.number().finite(),
  note: optionalString,
});

export const messageSchema = z.object({
  recipientId: z.string().min(1),
  body: z.string().trim().min(1, 'Escribe un mensaje.').max(2000),
  attachmentUrl: z.preprocess(emptyToUndefined, z.string().url().max(500).optional()),
  attachmentType: z.preprocess(emptyToUndefined, z.enum(['image', 'video']).optional()),
});

export const goalSchema = z.object({
  athleteId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  metric: z.enum(['exercise_e1rm', 'exercise_weight', 'test', 'bodyweight', 'custom']),
  exerciseId: z.preprocess(emptyToUndefined, z.string().optional()),
  testId: z.preprocess(emptyToUndefined, z.string().optional()),
  startValue: optionalNumber,
  targetValue: z.number().finite(),
  unit: z.string().trim().max(20).default('kg'),
  lowerIsBetter: z.coerce.boolean().default(false),
  dueDate: z.preprocess(emptyToUndefined, dateKeySchema.optional()),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ExerciseInput = z.infer<typeof exerciseSchema>;
export type WorkoutInput = z.infer<typeof workoutSchema>;
export type WorkoutExerciseInput = z.infer<typeof workoutExerciseSchema>;
export type SetConfigInput = z.infer<typeof setConfigSchema>;
export type AssignInput = z.infer<typeof assignSchema>;
export type LogSetInput = z.infer<typeof logSetSchema>;
export type FinishSessionInput = z.infer<typeof finishSessionSchema>;
