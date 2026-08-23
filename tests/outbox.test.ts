import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Bandeja de salida del gimnasio sin cobertura.
 *
 * Lo importante no es que guarde, sino el orden y la idempotencia: el cierre de
 * la sesión recalcula el volumen con lo que el servidor tenga guardado, así que
 * si sale antes que las series el resumen queda corto; y reintentar el envío no
 * puede duplicar nada, porque un reintento es lo normal, no la excepción.
 */

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: fakeStorage() });
  vi.resetModules();
});

const serie = (setId: string, sessionId = 's1') => ({
  sessionId,
  setId,
  actualReps: 8,
  actualWeightKg: 60,
  actualDurationSeconds: null,
  actualDistanceM: null,
  rpe: 7,
  status: 'completed' as const,
});

describe('bandeja de salida', () => {
  it('envía las series antes que el cierre, aunque se apuntara al revés', async () => {
    const outbox = await import('@/lib/offline/outbox');

    outbox.enqueueFinish({
      sessionId: 's1',
      durationSeconds: 3600,
      sessionRpe: 8,
      feeling: 4,
      fatigue: 5,
      soreness: 3,
    });
    outbox.enqueueSet(serie('set-1'));
    outbox.enqueueComment({ sessionId: 's1', sessionExerciseId: 'se-1', comment: 'pesaba' });

    expect(outbox.pending().map((entry) => entry.kind)).toEqual(['set', 'comment', 'finish']);
  });

  it('no duplica al reintentar la misma serie', async () => {
    const outbox = await import('@/lib/offline/outbox');

    outbox.enqueueSet(serie('set-1'));
    outbox.enqueueSet({ ...serie('set-1'), actualWeightKg: 65 });
    outbox.enqueueSet(serie('set-2'));

    const pendientes = outbox.pending();
    expect(pendientes).toHaveLength(2);
    // Y se queda con el último valor apuntado, no con el primero.
    const primera = pendientes.find((entry) => entry.key === 'set:set-1');
    expect(primera?.kind === 'set' && primera.payload.actualWeightKg).toBe(65);
  });

  it('separa por sesión y limpia sólo la que se ha confirmado', async () => {
    const outbox = await import('@/lib/offline/outbox');

    outbox.enqueueSet(serie('set-1', 's1'));
    outbox.enqueueSet(serie('set-2', 's2'));
    outbox.enqueueFinish({
      sessionId: 's1',
      durationSeconds: 60,
      sessionRpe: 5,
      feeling: 3,
      fatigue: 3,
      soreness: 3,
    });

    expect(outbox.pendingCount('s1')).toBe(2);
    expect(outbox.hasPendingFinish('s1')).toBe(true);
    expect(outbox.hasPendingFinish('s2')).toBe(false);

    outbox.clearSession('s1');
    expect(outbox.pendingCount('s1')).toBe(0);
    expect(outbox.pendingCount('s2')).toBe(1);
  });

  it('aguanta un almacenamiento con basura dentro', async () => {
    const outbox = await import('@/lib/offline/outbox');
    window.localStorage.setItem('lordgym.outbox', 'esto no es json');
    expect(outbox.pending()).toEqual([]);

    // Y sigue admitiendo escrituras después.
    outbox.enqueueSet(serie('set-1'));
    expect(outbox.pendingCount()).toBe(1);
  });
});
