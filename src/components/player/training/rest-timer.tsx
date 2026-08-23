'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Plus, SkipForward, Timer } from 'lucide-react';
import { formatDuration } from '@/lib/domain/datetime';
import { playAlertSound, vibrate } from '@/lib/alert-sound';
import { cn } from '@/lib/cn';

/**
 * Temporizador de descanso (§19).
 *
 * La cuenta atrás va contra el reloj, no restando un segundo por tick. Parece
 * lo mismo y no lo es: el navegador frena o congela los temporizadores cuando
 * el móvil se guarda en el bolsillo, que es exactamente lo que se hace durante
 * un descanso. Con el método de restar, dos minutos de descanso se convertían
 * en cuatro. Con una hora de salida fija, el tiempo que pasa fuera cuenta igual
 * y al volver el número ya es el correcto.
 *
 * Si el aviso cae con la app en segundo plano no se pierde: se dispara al
 * volver, y la pantalla dice cuánto hace que terminó para que nadie se crea que
 * acaba de sonar.
 */
export function RestTimer({
  seconds,
  onDone,
  onSkip,
  soundEnabled,
  onToggleSound,
}: {
  seconds: number;
  onDone: () => void;
  onSkip: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}) {
  const [total, setTotal] = useState(seconds);
  const [deadline, setDeadline] = useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const notified = useRef(false);

  const remainingMs = deadline - now;
  const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
  /** Segundos transcurridos desde que terminó, si terminó estando fuera. */
  const overdue = Math.max(0, Math.floor(-remainingMs / 1000));

  const tick = useCallback(() => setNow(Date.now()), []);

  useEffect(() => {
    // Cuatro veces por segundo: el último segundo se ve caer sin saltos, y al
    // volver de segundo plano el número se corrige casi al instante.
    const interval = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [tick]);

  useEffect(() => {
    if (remainingMs > 0 || notified.current) return;
    notified.current = true;
    vibrate([180, 90, 180]);
    if (soundEnabled) playAlertSound();

    // Si el aviso ha sonado con la app delante, el jugador lo ha visto y el
    // panel se retira solo para dejar a la vista el botón de terminar. Si ha
    // sonado en el bolsillo, se queda puesto: al sacar el móvil hay que poder
    // leer cuánto hace que acabó el descanso.
    if (document.visibilityState !== 'visible' || overdue >= 3) return;
    const timeout = setTimeout(onDone, 2500);
    return () => clearTimeout(timeout);
  }, [remainingMs, overdue, soundEnabled, onDone]);

  const progress = total > 0 ? Math.min(100, ((total * 1000 - remainingMs) / (total * 1000)) * 100) : 100;

  function addTime(extraSeconds: number): void {
    setTotal((current) => current + extraSeconds);
    setDeadline((current) => Math.max(current, Date.now()) + extraSeconds * 1000);
    notified.current = false;
  }

  return (
    <div
      role="timer"
      aria-live="off"
      className="safe-inset-x fixed bottom-0 z-40 border-t border-volt-500/25 bg-ink-900/95 px-4 pb-[calc(1rem+var(--safe-bottom))] pt-4 backdrop-blur-lg"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-volt-500">
              <Timer className="h-3.5 w-3.5" />
              Descanso
            </p>
            <button
              type="button"
              onClick={onToggleSound}
              aria-pressed={soundEnabled}
              aria-label={soundEnabled ? 'Desactivar el aviso sonoro' : 'Activar el aviso sonoro'}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium transition-colors',
                soundEnabled
                  ? 'border-volt-500/40 text-volt-500'
                  : 'border-ink-700 text-ink-400 hover:border-ink-600',
              )}
            >
              {soundEnabled ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
              {soundEnabled ? 'Con sonido' : 'Sin sonido'}
            </button>
          </div>

          <p className="metric mt-0.5 text-4xl text-ink-50">{formatDuration(remaining)}</p>
          {overdue > 0 ? (
            <p className="text-xs text-ink-400">Terminó hace {formatDuration(overdue)}</p>
          ) : null}

          <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-volt-500 transition-[width] duration-300 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => addTime(30)}
            className="flex h-12 items-center gap-1 rounded-xl border border-ink-700 px-3 text-sm font-medium text-ink-100 transition-colors hover:border-ink-600"
          >
            <Plus className="h-4 w-4" />
            30 s
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="flex h-12 items-center gap-1.5 rounded-xl bg-volt-500 px-4 text-sm font-semibold text-ink-950 transition-transform active:scale-95"
          >
            <SkipForward className="h-4 w-4" />
            {remaining > 0 ? 'Saltar' : 'Seguir'}
          </button>
        </div>
      </div>
    </div>
  );
}
