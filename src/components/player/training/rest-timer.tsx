'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, SkipForward, Timer } from 'lucide-react';
import { formatDuration } from '@/lib/domain/datetime';

/**
 * Temporizador de descanso (§19). Arranca al completar una serie, permite
 * añadir 30 s o saltar, y avisa con vibración (y sonido opcional) al terminar.
 */
export function RestTimer({
  seconds,
  onDone,
  onSkip,
  soundEnabled,
}: {
  seconds: number;
  onDone: () => void;
  onSkip: () => void;
  soundEnabled: boolean;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [total, setTotal] = useState(seconds);
  const doneRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [total]);

  useEffect(() => {
    if (remaining > 0 || doneRef.current) return;
    doneRef.current = true;
    notify(soundEnabled);
    onDone();
  }, [remaining, onDone, soundEnabled]);

  const progress = total > 0 ? ((total - remaining) / total) * 100 : 100;

  return (
    <div
      role="timer"
      aria-live="off"
      className="safe-inset-x fixed bottom-0 z-40 border-t border-volt-500/25 bg-ink-900/95 px-4 pb-[calc(1rem+var(--safe-bottom))] pt-4 backdrop-blur-lg"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-volt-500">
            <Timer className="h-3.5 w-3.5" />
            Descanso
          </p>
          <p className="metric mt-0.5 text-4xl text-ink-50">{formatDuration(remaining)}</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-volt-500 transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => {
              setTotal((current) => current + 30);
              setRemaining((current) => current + 30);
              doneRef.current = false;
            }}
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
            Saltar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Vibración si el navegador lo permite; sonido corto opcional (§92). */
function notify(soundEnabled: boolean): void {
  try {
    navigator.vibrate?.([180, 90, 180]);
  } catch {
    // Safari en iOS no expone `vibrate`: se ignora sin romper nada.
  }
  if (!soundEnabled) return;
  try {
    const AudioContextCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.5);
    oscillator.onended = () => void context.close();
  } catch {
    // Sin permiso de audio el aviso queda en la vibración.
  }
}
