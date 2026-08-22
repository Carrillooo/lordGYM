import { describe, expect, it } from 'vitest';
import {
  assignSchema,
  finishSessionSchema,
  logSetSchema,
  registerSchema,
  setConfigSchema,
  wellnessSchema,
} from '@/lib/validation/schemas';

/**
 * Regresión: los componentes cliente envían `null` explícito en los campos
 * vacíos (una serie sin notas, un comentario en blanco) mientras que `FormData`
 * envía `null` cuando el campo no existe. Si los opcionales sólo aceptaran
 * `undefined`, el autoguardado del constructor fallaría en silencio.
 */
describe('campos opcionales', () => {
  it('acepta null en textos opcionales', () => {
    const result = setConfigSchema.safeParse({
      setIndex: 1,
      setType: 'normal',
      targetReps: 6,
      targetWeightKg: 65,
      targetPercent1rm: null,
      targetRpe: 8,
      targetRir: null,
      targetDurationSeconds: null,
      targetDistanceM: null,
      targetVelocityMs: null,
      restSeconds: null,
      notes: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetWeightKg).toBe(65);
      expect(result.data.notes).toBeUndefined();
    }
  });

  it('acepta null en el comentario del cierre de sesión', () => {
    const result = finishSessionSchema.safeParse({
      sessionId: 'abc',
      durationSeconds: 3480,
      sessionRpe: 8,
      feeling: 4,
      fatigue: 6,
      soreness: 4,
      comment: null,
    });
    expect(result.success).toBe(true);
  });

  it('acepta null en los campos opcionales del registro', () => {
    const result = registerSchema.safeParse({
      email: 'Nuevo@Lordgym.app',
      password: 'contrasena-larga',
      firstName: 'Nuria',
      lastName: 'Vidal',
      birthDate: null,
      role: 'athlete',
      avatarUrl: null,
      coachCode: null,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('nuevo@lordgym.app');
  });

  it('acepta null en las notas de una asignación', () => {
    const result = assignSchema.safeParse({
      workoutId: 'w1',
      athleteIds: ['a1'],
      scheduledDate: '2026-06-24',
      scheduledTime: null,
      notes: null,
    });
    expect(result.success).toBe(true);
  });

  it('acepta null en los campos no aplicables de una serie registrada', () => {
    const result = logSetSchema.safeParse({
      sessionId: 's1',
      setId: 'set1',
      actualReps: 6,
      actualWeightKg: 62.5,
      actualDurationSeconds: null,
      actualDistanceM: null,
      rpe: 8,
      status: 'completed',
    });
    expect(result.success).toBe(true);
  });
});

describe('rangos', () => {
  it('rechaza un RPE de sesión fuera de 1–10', () => {
    const base = {
      sessionId: 's1',
      durationSeconds: 600,
      feeling: 3,
      fatigue: 5,
      soreness: 3,
      comment: null,
    };
    expect(finishSessionSchema.safeParse({ ...base, sessionRpe: 11 }).success).toBe(false);
    expect(finishSessionSchema.safeParse({ ...base, sessionRpe: 0 }).success).toBe(false);
    expect(finishSessionSchema.safeParse({ ...base, sessionRpe: 8 }).success).toBe(true);
  });

  it('rechaza valores de wellness fuera de 1–5', () => {
    const base = {
      date: '2026-06-24',
      sleep: 4,
      energy: 4,
      stress: 2,
      fatigue: 2,
      soreness: 2,
      motivation: 4,
      note: null,
    };
    expect(wellnessSchema.safeParse(base).success).toBe(true);
    expect(wellnessSchema.safeParse({ ...base, fatigue: 6 }).success).toBe(false);
    expect(wellnessSchema.safeParse({ ...base, sleep: 0 }).success).toBe(false);
  });

  it('exige una fecha con formato YYYY-MM-DD', () => {
    expect(
      assignSchema.safeParse({
        workoutId: 'w1',
        athleteIds: ['a1'],
        scheduledDate: '24/06/2026',
        scheduledTime: null,
        notes: null,
      }).success,
    ).toBe(false);
  });

  it('exige al menos un jugador al asignar', () => {
    expect(
      assignSchema.safeParse({
        workoutId: 'w1',
        athleteIds: [],
        scheduledDate: '2026-06-24',
        scheduledTime: null,
        notes: null,
      }).success,
    ).toBe(false);
  });
});
