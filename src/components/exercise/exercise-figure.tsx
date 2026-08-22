import type { ExerciseCategory } from '@/types/db';
import { cn } from '@/lib/cn';
import { PoseDrawing } from './figure-kit';
import { poseFor } from './poses';

/**
 * Ilustración de un ejercicio. Es un SVG en línea, así que no hay ninguna
 * petición de red: se ve al instante, funciona sin conexión y no depende de
 * ningún servicio externo que pueda caerse o cambiar de licencia.
 */
export function ExerciseFigure({
  figureKey,
  category,
  className,
  title,
}: {
  figureKey: string | null;
  category: ExerciseCategory;
  className?: string;
  /** Texto alternativo. Sin él la imagen se marca decorativa. */
  title?: string;
}) {
  const pose = poseFor(figureKey, category);
  return (
    <svg
      viewBox="0 0 200 140"
      className={cn('h-full w-full', className)}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <PoseDrawing pose={pose} />
    </svg>
  );
}

/** Ilustración con su marco: lo que se usa en tarjetas y cabeceras. */
export function ExerciseFigureFrame({
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
      <ExerciseFigure figureKey={figureKey} category={category} title={title} />
    </div>
  );
}
