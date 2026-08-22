/**
 * Funciones puras de cálculo deportivo. Sin dependencias de I/O para que sean
 * testeables y reutilizables en cliente y servidor.
 */

/** Redondea a `decimals` evitando el ruido de coma flotante (0.1+0.2). */
export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * 1RM estimado con la fórmula de Epley: `1RM = peso × (1 + reps / 30)`.
 * Con 1 repetición devuelve el propio peso (Epley es exacto en ese punto).
 */
export function epley1RM(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return 0;
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return round(weightKg, 1);
  return round(weightKg * (1 + reps / 30), 1);
}

/** Peso objetivo a partir de un %1RM. */
export function weightFromPercent(oneRepMax: number, percent: number): number {
  if (oneRepMax <= 0 || percent <= 0) return 0;
  return round((oneRepMax * percent) / 100, 1);
}

/** Volumen de una serie: kg × repeticiones. */
export function setVolume(weightKg: number | null, reps: number | null): number {
  if (!weightKg || !reps || weightKg <= 0 || reps <= 0) return 0;
  return round(weightKg * reps, 1);
}

/**
 * Carga de sesión (método de Foster): RPE de sesión × duración en minutos.
 * Se expresa en unidades arbitrarias (AU).
 */
export function trainingLoad(sessionRpe: number | null, durationSeconds: number | null): number | null {
  if (!sessionRpe || !durationSeconds || sessionRpe <= 0 || durationSeconds <= 0) return null;
  return Math.round(sessionRpe * (durationSeconds / 60));
}

/** Adherencia = completados / asignados, en porcentaje entero 0–100. */
export function adherence(completed: number, assigned: number): number {
  if (assigned <= 0) return 0;
  return Math.round((completed / assigned) * 100);
}

/**
 * Variación porcentual entre dos valores.
 * `lowerIsBetter` invierte el signo (sprints: bajar el tiempo es mejorar).
 */
export function percentChange(previous: number, current: number, lowerIsBetter = false): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  const raw = ((current - previous) / Math.abs(previous)) * 100;
  return round(lowerIsBetter ? -raw : raw, 1);
}

/**
 * Progresión automática (opcional, §69 del brief). Devuelve el peso sugerido
 * cuando el atleta encadena `requiredStreak` sesiones con RPE ≤ `rpeCeiling`.
 * El entrenador siempre tiene la última palabra: esto es una *sugerencia*.
 */
export function suggestProgression(options: {
  lastWeightKg: number;
  recentSessionRpes: number[];
  rpeCeiling?: number;
  requiredStreak?: number;
  incrementPercent?: number;
  roundToKg?: number;
}): { shouldIncrease: boolean; suggestedWeightKg: number; reason: string } {
  const {
    lastWeightKg,
    recentSessionRpes,
    rpeCeiling = 8,
    requiredStreak = 3,
    incrementPercent = 2.5,
    roundToKg = 2.5,
  } = options;

  if (lastWeightKg <= 0) {
    return { shouldIncrease: false, suggestedWeightKg: lastWeightKg, reason: 'Sin peso de referencia.' };
  }
  const streak = recentSessionRpes.slice(0, requiredStreak);
  const qualifies = streak.length >= requiredStreak && streak.every((rpe) => rpe > 0 && rpe <= rpeCeiling);
  if (!qualifies) {
    return {
      shouldIncrease: false,
      suggestedWeightKg: lastWeightKg,
      reason: `Aún no encadena ${requiredStreak} sesiones con RPE ≤ ${rpeCeiling}.`,
    };
  }
  const raw = lastWeightKg * (1 + incrementPercent / 100);
  const suggested = round(Math.round(raw / roundToKg) * roundToKg, 2);
  return {
    shouldIncrease: suggested > lastWeightKg,
    suggestedWeightKg: Math.max(suggested, lastWeightKg + roundToKg),
    reason: `${requiredStreak} sesiones con RPE ≤ ${rpeCeiling}: sugerido +${incrementPercent}%.`,
  };
}

/**
 * Ratio agudo:crónico de carga (ACWR). Carga de los últimos 7 días dividida por
 * la media semanal de los últimos 28. >1.5 se considera pico de riesgo.
 */
export function acuteChronicRatio(dailyLoads: { date: string; load: number }[], today: string): number | null {
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(todayMs)) return null;
  const dayMs = 86_400_000;
  let acute = 0;
  let chronic = 0;
  for (const entry of dailyLoads) {
    const ms = Date.parse(`${entry.date}T00:00:00Z`);
    if (Number.isNaN(ms)) continue;
    const diffDays = Math.floor((todayMs - ms) / dayMs);
    if (diffDays < 0) continue;
    if (diffDays < 7) acute += entry.load;
    if (diffDays < 28) chronic += entry.load;
  }
  const chronicWeekly = chronic / 4;
  if (chronicWeekly <= 0) return null;
  return round(acute / chronicWeekly, 2);
}

/** Racha de días consecutivos con actividad, contando hacia atrás desde hoy. */
export function currentStreak(activeDates: string[], today: string): number {
  const set = new Set(activeDates);
  const dayMs = 86_400_000;
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(todayMs)) return 0;

  let streak = 0;
  // Si aún no ha entrenado hoy la racha sigue viva si entrenó ayer.
  let cursor = set.has(today) ? todayMs : todayMs - dayMs;
  while (set.has(new Date(cursor).toISOString().slice(0, 10))) {
    streak += 1;
    cursor -= dayMs;
  }
  return streak;
}
