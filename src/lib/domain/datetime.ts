/**
 * Utilidades de fecha. Regla del proyecto (§106): los instantes se guardan en
 * UTC (ISO con `Z`) y los días naturales como `YYYY-MM-DD`. La visualización usa
 * la zona horaria del navegador; en servidor se usa `DEFAULT_TIMEZONE`.
 */

export const DEFAULT_TIMEZONE = 'Europe/Madrid';
export const DEFAULT_LOCALE = 'es-ES';

export const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
export const WEEKDAYS_LONG = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const;
export const MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** Instante actual en UTC. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Día natural (`YYYY-MM-DD`) de una fecha en la zona indicada. */
export function toDateKey(date: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return parts;
}

export function todayKey(timeZone: string = DEFAULT_TIMEZONE): string {
  return toDateKey(new Date(), timeZone);
}

/** Convierte `YYYY-MM-DD` en un `Date` a mediodía UTC (evita saltos por DST). */
export function fromDateKey(key: string): Date {
  return new Date(`${key}T12:00:00.000Z`);
}

export function addDays(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  return Math.round((fromDateKey(to).getTime() - fromDateKey(from).getTime()) / 86_400_000);
}

/** Índice ISO del día de la semana: 1 = lunes … 7 = domingo. */
export function isoWeekday(key: string): number {
  const day = fromDateKey(key).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Lunes de la semana a la que pertenece `key`. */
export function startOfWeek(key: string): string {
  return addDays(key, -(isoWeekday(key) - 1));
}

export function endOfWeek(key: string): string {
  return addDays(startOfWeek(key), 6);
}

export function startOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function endOfMonth(key: string): string {
  const date = fromDateKey(startOfMonth(key));
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

/** Rango inclusivo de días entre dos claves. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 1000) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return out;
}

/** Rejilla de 6×7 días que cubre el mes de `key`, empezando en lunes. */
export function monthGrid(key: string): string[] {
  const first = startOfWeek(startOfMonth(key));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function formatDayMonth(key: string): string {
  const date = fromDateKey(key);
  return `${date.getUTCDate()} ${MONTHS_LONG[date.getUTCMonth()].slice(0, 3)}`;
}

export function formatLongDate(key: string): string {
  const date = fromDateKey(key);
  return `${WEEKDAYS_LONG[isoWeekday(key) - 1]}, ${date.getUTCDate()} de ${MONTHS_LONG[date.getUTCMonth()]}`;
}

export function formatShortDate(key: string): string {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

/** Etiqueta relativa amable: «Hoy», «Mañana», «Ayer» o la fecha corta. */
export function relativeDayLabel(key: string, today = todayKey()): string {
  const delta = diffDays(today, key);
  if (delta === 0) return 'Hoy';
  if (delta === 1) return 'Mañana';
  if (delta === -1) return 'Ayer';
  if (delta > 1 && delta < 7) return WEEKDAYS_LONG[isoWeekday(key) - 1];
  return formatShortDate(key);
}

/** Segundos → `mm:ss` (o `h:mm:ss` si supera la hora). */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function formatMinutes(totalSeconds: number | null): string {
  if (!totalSeconds) return '—';
  return `${Math.round(totalSeconds / 60)} min`;
}

/** Hora local `HH:mm` de un instante UTC. */
export function formatTime(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** Edad en años a partir de la fecha de nacimiento. */
export function ageFromBirthDate(birthDate: string | null, today = todayKey()): number | null {
  if (!birthDate) return null;
  const born = fromDateKey(birthDate);
  const ref = fromDateKey(today);
  let age = ref.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = ref.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && ref.getUTCDate() < born.getUTCDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}
