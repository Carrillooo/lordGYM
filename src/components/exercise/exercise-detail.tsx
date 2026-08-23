'use client';

import { useState } from 'react';
import { Dumbbell, Target, Video } from 'lucide-react';
import type { ExerciseRow } from '@/types/db';
import type { MediaMode } from '@/lib/media/types';
import { saveExerciseVideoAction } from '@/lib/actions/exercises';
import { CATEGORY_LABELS, METRIC_LABELS } from '@/lib/domain/labels';
import { Badge } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { VideoPlayer } from '@/components/media/video-player';
import { VideoUpload } from '@/components/media/video-upload';
import { AnimatedExerciseFigureFrame } from './exercise-figure-animated';

/**
 * Ficha completa: ilustración, para qué sirve, cómo se hace y —si el
 * entrenador lo ha subido— el vídeo de técnica del club.
 *
 * La ilustración y el vídeo no compiten: el dibujo animado se ve siempre y
 * carga al instante; el vídeo es el detalle que sólo se mira cuando hace falta.
 */
export function ExerciseDetail({
  exercise,
  videoUrl,
  mediaMode,
}: {
  exercise: ExerciseRow;
  /** Vídeo efectivo para quien mira (el del entrenador, o el del ejercicio). */
  videoUrl?: string | null;
  /** Definido sólo para el entrenador: habilita subir o cambiar el vídeo. */
  mediaMode?: MediaMode;
}) {
  const [video, setVideo] = useState<string | null>(videoUrl ?? exercise.video_url);

  async function save(url: string | null) {
    setVideo(url);
    const result = await saveExerciseVideoAction({ exerciseId: exercise.id, videoUrl: url });
    // Si el servidor lo rechaza se deshace: nunca dejamos en pantalla un vídeo
    // que en realidad no se ha guardado.
    if (result.status === 'error') setVideo(videoUrl ?? exercise.video_url);
  }

  return (
    <div className="space-y-5">
      <AnimatedExerciseFigureFrame
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

      {video || mediaMode ? (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
            <Video className="h-4 w-4 text-volt-500" />
            Vídeo de técnica
          </h3>
          {video ? <VideoPlayer url={video} label="Ver vídeo de técnica" /> : null}
          {mediaMode ? (
            <VideoUpload
              mode={mediaMode}
              scope={{ kind: 'exercise-video', targetId: exercise.id }}
              hasVideo={Boolean(video)}
              onUploaded={save}
              onRemove={() => save(null)}
              label="Subir vídeo de técnica"
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export function ExerciseDetailModal({
  exercise,
  videoUrl,
  mediaMode,
  onClose,
}: {
  exercise: ExerciseRow | null;
  videoUrl?: string | null;
  mediaMode?: MediaMode;
  onClose: () => void;
}) {
  return (
    <Modal open={exercise !== null} onClose={onClose} title={exercise?.name ?? ''} size="md">
      {exercise ? (
        // La clave fuerza un componente nuevo por ejercicio: sin ella el
        // estado del vídeo se arrastraría de una ficha a la siguiente.
        <ExerciseDetail key={exercise.id} exercise={exercise} videoUrl={videoUrl} mediaMode={mediaMode} />
      ) : null}
    </Modal>
  );
}
