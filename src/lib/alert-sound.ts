'use client';

/**
 * Aviso sonoro del final del descanso.
 *
 * El problema de iOS: un `AudioContext` nace suspendido y sólo se puede
 * arrancar desde un gesto del usuario. Cuando el descanso termina no hay ningún
 * gesto —justamente por eso hace falta el aviso—, así que crear el contexto en
 * ese momento no suena nunca. Es el fallo silencioso clásico: en el escritorio
 * funciona, en el móvil no, y no hay error en la consola.
 *
 * La solución es prepararlo antes, aprovechando el gesto que sí existe: el
 * dedo que marca la serie como completada. Desde ahí el contexto queda
 * arrancado y ya puede sonar solo.
 */

let context: AudioContext | null = null;

function createContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

/**
 * Deja el audio listo. Hay que llamarlo **dentro** de un manejador de evento de
 * usuario (un click, un toque); fuera de ahí no sirve de nada.
 */
export function primeAlertSound(): void {
  context ??= createContext();
  if (context?.state === 'suspended') void context.resume();
}

/** Dos pitidos cortos. Se oyen por encima del ruido de un gimnasio. */
export function playAlertSound(): void {
  const ctx = context;
  if (!ctx || ctx.state !== 'running') return;
  const start = ctx.currentTime;
  for (const [index, frequency] of [880, 1174.7].entries()) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const at = start + index * 0.22;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.2);
  }
}

/** Vibración. Safari en iOS no la expone; se ignora sin romper nada. */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Sin soporte: el aviso queda en el sonido y en la pantalla.
  }
}
