import { describe, expect, it } from 'vitest';
import {
  acuteChronicRatio,
  adherence,
  currentStreak,
  epley1RM,
  percentChange,
  round,
  setVolume,
  suggestProgression,
  trainingLoad,
  weightFromPercent,
} from '@/lib/domain/metrics';

describe('epley1RM', () => {
  it('devuelve el propio peso con una repetición', () => {
    expect(epley1RM(100, 1)).toBe(100);
  });

  it('aplica la fórmula peso × (1 + reps / 30)', () => {
    // 60 × (1 + 6/30) = 72
    expect(epley1RM(60, 6)).toBe(72);
    // 62,5 × (1 + 6/30) = 75
    expect(epley1RM(62.5, 6)).toBe(75);
  });

  it('devuelve 0 con entradas no válidas', () => {
    expect(epley1RM(0, 5)).toBe(0);
    expect(epley1RM(60, 0)).toBe(0);
    expect(epley1RM(Number.NaN, 5)).toBe(0);
    expect(epley1RM(-10, 5)).toBe(0);
  });
});

describe('weightFromPercent', () => {
  it('calcula el peso a partir del %1RM', () => {
    expect(weightFromPercent(100, 80)).toBe(80);
    expect(weightFromPercent(72.5, 70)).toBe(50.8);
  });

  it('protege contra valores no positivos', () => {
    expect(weightFromPercent(0, 80)).toBe(0);
    expect(weightFromPercent(100, 0)).toBe(0);
  });
});

describe('setVolume', () => {
  it('multiplica kilos por repeticiones', () => {
    expect(setVolume(60, 6)).toBe(360);
  });

  it('ignora series sin peso o sin repeticiones', () => {
    expect(setVolume(null, 6)).toBe(0);
    expect(setVolume(60, null)).toBe(0);
    expect(setVolume(0, 6)).toBe(0);
  });
});

describe('trainingLoad', () => {
  it('usa el método de Foster: RPE × minutos', () => {
    // RPE 8 durante 60 minutos = 480 AU (ejemplo del brief §26).
    expect(trainingLoad(8, 60 * 60)).toBe(480);
  });

  it('devuelve null si falta algún dato', () => {
    expect(trainingLoad(null, 3600)).toBeNull();
    expect(trainingLoad(8, null)).toBeNull();
    expect(trainingLoad(0, 3600)).toBeNull();
  });
});

describe('adherence', () => {
  it('calcula el porcentaje de sesiones completadas', () => {
    expect(adherence(18, 20)).toBe(90);
    expect(adherence(24, 30)).toBe(80);
  });

  it('devuelve 0 cuando no hay sesiones asignadas', () => {
    expect(adherence(0, 0)).toBe(0);
  });
});

describe('percentChange', () => {
  it('calcula la variación porcentual', () => {
    expect(percentChange(60, 62.5)).toBe(4.2);
  });

  it('invierte el signo cuando menos es mejor', () => {
    // Sprint 20 m: de 3,42 s a 3,19 s es una mejora del 6,7 % (§40).
    expect(percentChange(3.42, 3.19, true)).toBe(6.7);
  });

  it('devuelve null si el valor previo es cero', () => {
    expect(percentChange(0, 10)).toBeNull();
  });
});

describe('suggestProgression', () => {
  it('propone subir peso tras tres sesiones con RPE ≤ 8', () => {
    const result = suggestProgression({ lastWeightKg: 60, recentSessionRpes: [8, 7.5, 8] });
    expect(result.shouldIncrease).toBe(true);
    expect(result.suggestedWeightKg).toBe(62.5);
  });

  it('no propone subir si alguna sesión superó el techo de RPE', () => {
    const result = suggestProgression({ lastWeightKg: 60, recentSessionRpes: [9, 8, 8] });
    expect(result.shouldIncrease).toBe(false);
    expect(result.suggestedWeightKg).toBe(60);
  });

  it('no propone nada sin suficientes sesiones', () => {
    expect(suggestProgression({ lastWeightKg: 60, recentSessionRpes: [7, 7] }).shouldIncrease).toBe(false);
  });
});

describe('acuteChronicRatio', () => {
  it('divide la carga de 7 días entre la media semanal de 28', () => {
    const loads = Array.from({ length: 28 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 5, 1) + index * 86_400_000).toISOString().slice(0, 10),
      load: 100,
    }));
    // Carga constante: aguda 700, crónica semanal 700 → ratio 1.
    expect(acuteChronicRatio(loads, '2026-06-28')).toBe(1);
  });

  it('detecta un pico de carga', () => {
    const loads = [
      { date: '2026-06-26', load: 600 },
      { date: '2026-06-27', load: 600 },
      { date: '2026-06-10', load: 100 },
    ];
    const ratio = acuteChronicRatio(loads, '2026-06-28');
    expect(ratio).not.toBeNull();
    expect(ratio as number).toBeGreaterThan(1.5);
  });

  it('devuelve null sin histórico', () => {
    expect(acuteChronicRatio([], '2026-06-28')).toBeNull();
  });
});

describe('currentStreak', () => {
  it('cuenta días consecutivos hasta hoy', () => {
    expect(currentStreak(['2026-06-28', '2026-06-27', '2026-06-26'], '2026-06-28')).toBe(3);
  });

  it('mantiene la racha viva si aún no ha entrenado hoy', () => {
    expect(currentStreak(['2026-06-27', '2026-06-26'], '2026-06-28')).toBe(2);
  });

  it('se corta con un día de descanso', () => {
    expect(currentStreak(['2026-06-28', '2026-06-26'], '2026-06-28')).toBe(1);
  });

  it('devuelve 0 sin actividad', () => {
    expect(currentStreak([], '2026-06-28')).toBe(0);
  });
});

describe('round', () => {
  it('evita el ruido de coma flotante', () => {
    expect(round(0.1 + 0.2, 2)).toBe(0.3);
  });
});
