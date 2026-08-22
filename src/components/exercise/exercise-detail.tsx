'use client';

import { Dumbbell, Target, Video } from 'lucide-react';
import type { ExerciseRow } from '@/types/db';
import { CATEGORY_LABELS, METRIC_LABELS } from '@/lib/domain/labels';
import { Badge } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { ExerciseFigureFrame } from './exercise-figure';

/** Ficha completa: ilustración, para qué sirve y cómo se hace. */
export function ExerciseDetail({ exercise }: { exercise: ExerciseRow }) {
  return (
    <div className="space-y-5">
      <ExerciseFigureFrame
        figureKey={exercise.figure_key}
        category={exercise.category}
        title={`Ilustración de ${exercise.name}`}
        className="aspect-[10/7] w-full"
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
        <Badge tone="volt">{CATEGORY_LABELS[exercise.category]}</Badge>
        {exercise.movement_type ? <Badge>{exercise.movement_type}</Badge> : null}
        <span>{METRIC_LABELS[exercise.metric_type]}</span>
      </div>

      {exercise.description ? (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
            <Target className="h-4 w-4 text-volt-500" />
            Qué es
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{exercise.description}</p>
        </section>
      ) : null}

      {exercise.technique ? (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
            <Dumbbell className="h-4 w-4 text-volt-500" />
            Cómo se hace
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{exercise.technique}</p>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {exercise.muscles.length > 0 ? (
          <section>
            <h3 className="text-xs uppercase tracking-wider text-ink-500">Músculos</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {exercise.muscles.map((muscle) => (
                <Badge key={muscle}>{muscle}</Badge>
              ))}
            </div>
          </section>
        ) : null}
        {exercise.equipment.length > 0 ? (
          <section>
            <h3 className="text-xs uppercase tracking-wider text-ink-500">Material</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {exercise.equipment.map((item) => (
                <Badge key={item}>{item}</Badge>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {exercise.video_url ? (
        <a
          href={exercise.video_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-volt-500 hover:underline"
        >
          <Video className="h-4 w-4" />
          Ver vídeo de técnica
        </a>
      ) : null}
    </div>
  );
}

export function ExerciseDetailModal({
  exercise,
  onClose,
}: {
  exercise: ExerciseRow | null;
  onClose: () => void;
}) {
  return (
    <Modal open={exercise !== null} onClose={onClose} title={exercise?.name ?? ''} size="md">
      {exercise ? <ExerciseDetail exercise={exercise} /> : null}
    </Modal>
  );
}
