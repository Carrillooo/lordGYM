'use client';

import { useSyncExternalStore } from 'react';
import type { ExerciseCategory } from '@/types/db';
import { cn } from '@/lib/cn';
import { PoseDrawing } from './figure-kit';
import { poseFor } from './poses';

/**
 * Ilustración en movimiento: la figura recorre el ejercicio de ida y vuelta.
 *
 * Es el mismo dibujo que la versión estática, con la animación dentro del SVG
 * (SMIL). No pesa nada —unos cientos de bytes de marcado— y no hay ningún GIF
 * que descargar: se ve nítida a cualquier tamaño y no se pixela.
 *
 * Es un componente de cliente sólo por una razón: `prefers-reduced-motion`.
 * SMIL no se puede apagar desde CSS, así que hay que consultar la preferencia
 * del sistema. Quien tenga «Reducir movimiento» activado en el iPhone ve la
 * figura quieta, que es lo que ha pedido.
 */

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** En el servidor se asume que no hay preferencia: la figura sale animada. */
function getServerSnapshot(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function AnimatedExerciseFigure({
  figureKey,
  category,
  className,
  title,
}: {
  figureKey: string | null;
  category: ExerciseCategory;
  className?: string;
  title?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const pose = poseFor(figureKey, category);

  return (
    <svg
      viewBox="0 0 200 140"
      className={cn('h-full w-full', className)}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <PoseDrawing pose={pose} animated={!reduced} />
    </svg>
  );
}

/** Con su marco, para cabeceras y fichas. */
export function AnimatedExerciseFigureFrame({
  figureKey,
  category,
  className,
  title,
}: {
  figureKey: string | null;
  category: ExerciseCategory;
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-ink-700/70 bg-gradient-to-br from-ink-900 to-ink-850',
        className,
      )}
    >
      <AnimatedExerciseFigure figureKey={figureKey} category={category} title={title} />
    </div>
  );
}
