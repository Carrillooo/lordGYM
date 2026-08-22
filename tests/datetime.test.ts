import { describe, expect, it } from 'vitest';
import {
  addDays,
  ageFromBirthDate,
  dateRange,
  diffDays,
  endOfMonth,
  formatDuration,
  isoWeekday,
  monthGrid,
  relativeDayLabel,
  startOfWeek,
  toDateKey,
} from '@/lib/domain/datetime';
import { coachCodeSuffix, normalizeCoachCode, threadKey } from '@/lib/domain/ids';

describe('semana ISO', () => {
  it('empieza en lunes', () => {
    // 2026-06-28 es domingo.
    expect(isoWeekday('2026-06-28')).toBe(7);
    expect(startOfWeek('2026-06-28')).toBe('2026-06-22');
    // 2026-06-22 es lunes y es su propio inicio de semana.
    expect(startOfWeek('2026-06-22')).toBe('2026-06-22');
  });
});

describe('aritmética de días', () => {
  it('suma y resta sin desbordar el mes', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('sobrevive al cambio de hora de Europe/Madrid', () => {
    // Último domingo de marzo de 2026: los relojes se adelantan una hora.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
    // Último domingo de octubre: se atrasan.
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('genera rangos inclusivos', () => {
    expect(dateRange('2026-06-22', '2026-06-28')).toHaveLength(7);
  });
});

describe('mes', () => {
  it('calcula el último día', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29');
    expect(endOfMonth('2026-04-05')).toBe('2026-04-30');
  });

  it('devuelve una rejilla de 6 semanas que empieza en lunes', () => {
    const grid = monthGrid('2026-06-15');
    expect(grid).toHaveLength(42);
    expect(isoWeekday(grid[0])).toBe(1);
    expect(grid).toContain('2026-06-15');
  });
});

describe('toDateKey', () => {
  it('usa la zona horaria indicada', () => {
    // 23:30 UTC del 31 de diciembre ya es 1 de enero en Madrid (UTC+1).
    const instant = new Date('2025-12-31T23:30:00.000Z');
    expect(toDateKey(instant, 'Europe/Madrid')).toBe('2026-01-01');
    expect(toDateKey(instant, 'UTC')).toBe('2025-12-31');
  });
});

describe('relativeDayLabel', () => {
  it('usa etiquetas amables para los días cercanos', () => {
    expect(relativeDayLabel('2026-06-24', '2026-06-24')).toBe('Hoy');
    expect(relativeDayLabel('2026-06-25', '2026-06-24')).toBe('Mañana');
    expect(relativeDayLabel('2026-06-23', '2026-06-24')).toBe('Ayer');
  });

  it('cae a la fecha corta cuando está lejos', () => {
    expect(relativeDayLabel('2026-08-01', '2026-06-24')).toBe('01/08/2026');
  });
});

describe('formatDuration', () => {
  it('formatea mm:ss y h:mm:ss', () => {
    expect(formatDuration(119)).toBe('01:59');
    expect(formatDuration(58 * 60)).toBe('58:00');
    expect(formatDuration(2551)).toBe('42:31');
    expect(formatDuration(3600 + 25 * 60 + 5)).toBe('1:25:05');
  });

  it('no devuelve negativos', () => {
    expect(formatDuration(-30)).toBe('00:00');
  });
});

describe('ageFromBirthDate', () => {
  it('resta un año si aún no ha sido el cumpleaños', () => {
    expect(ageFromBirthDate('2005-03-14', '2026-03-13')).toBe(20);
    expect(ageFromBirthDate('2005-03-14', '2026-03-14')).toBe(21);
  });

  it('devuelve null sin fecha', () => {
    expect(ageFromBirthDate(null)).toBeNull();
  });
});

describe('códigos de entrenador', () => {
  it('normaliza cualquier forma que escriba el jugador', () => {
    expect(normalizeCoachCode('a7k29')).toBe('LORD-A7K29');
    expect(normalizeCoachCode(' lord-a7k29 ')).toBe('LORD-A7K29');
    expect(normalizeCoachCode('LORDA7K29')).toBe('LORD-A7K29');
  });

  it('extrae el sufijo para el enlace de invitación', () => {
    expect(coachCodeSuffix('LORD-A7K29')).toBe('A7K29');
  });

  it('genera claves de conversación estables', () => {
    expect(threadKey('coach-1', 'athlete-2')).toBe('coach-1:athlete-2');
  });
});
