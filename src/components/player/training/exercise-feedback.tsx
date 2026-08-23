'use client';

import { useState } from 'react';
import { Check, Loader2, MessageSquare } from 'lucide-react';
import { saveExerciseCommentAction, saveSessionVideoAction } from '@/lib/actions/player';
import type { MediaMode } from '@/lib/media/types';
import { VideoPlayer } from '@/components/media/video-player';
import { VideoUpload } from '@/components/media/video-upload';

/**
 * Comentario y vídeo del jugador para un ejercicio (§75, §77).
 * Va plegado para no estorbar durante la serie; el entrenador lo ve en la
 * ficha del jugador.
 *
 * El vídeo se guarda por su cuenta, en cuanto termina de subir, y no al pulsar
 * «guardar»: una subida de 50 MB desde el móvil tarda lo suyo y nadie se queda
 * mirando el botón hasta que acabe.
 */
export function ExerciseFeedback({
  sessionExerciseId,
  initialComment,
  initialVideoUrl,
  mediaMode,
}: {
  sessionExerciseId: string;
  initialComment: string | null;
  initialVideoUrl: string | null;
  mediaMode: MediaMode;
}) {
  const [comment, setComment] = useState(initialComment ?? '');
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function saveVideo(url: string | null) {
    const previous = videoUrl;
    setVideoUrl(url ?? '');
    const result = await saveSessionVideoAction({ sessionExerciseId, videoUrl: url });
    if (result.status === 'error') {
      setVideoUrl(previous);
      setStatus('error');
      setMessage(result.message ?? 'No se ha podido guardar el vídeo.');
    }
  }

  async function save() {
    setStatus('saving');
    const result = await saveExerciseCommentAction({
      sessionExerciseId,
      comment: comment.trim() || null,
      videoUrl: videoUrl.trim() || null,
    });
    if (result.status === 'success') {
      setStatus('saved');
      setMessage(null);
      setTimeout(() => setStatus((current) => (current === 'saved' ? 'idle' : current)), 2500);
    } else {
      setStatus('error');
      setMessage(result.message ?? 'No se ha podido guardar.');
    }
  }

  return (
    <details className="mt-4 rounded-xl border border-ink-800 bg-ink-900/40 px-3 py-2.5">
      <summary className="flex h-11 cursor-pointer select-none items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-400">
        <MessageSquare className="h-3.5 w-3.5" />
        Comentario o vídeo para tu entrenador
        {initialComment || initialVideoUrl ? <span className="text-volt-500">·</span> : null}
      </summary>

      <div className="mt-3 space-y-2">
        <label className="block">
          <span className="sr-only">Comentario del ejercicio</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Ej. última serie muy pesada."
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-500 focus:border-volt-500 focus:outline-none"
          />
        </label>

        {videoUrl ? <VideoPlayer url={videoUrl} label="Ver el vídeo que has enviado" /> : null}

        {mediaMode === 'off' ? (
          <label className="block">
            <span className="sr-only">Enlace a un vídeo de la serie</span>
            <input
              type="url"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              placeholder="Enlace a un vídeo de la serie (opcional)"
              className="h-11 w-full rounded-xl border border-ink-700 bg-ink-900 px-3 text-sm text-ink-50 placeholder:text-ink-500 focus:border-volt-500 focus:outline-none"
            />
          </label>
        ) : (
          <VideoUpload
            mode={mediaMode}
            scope={{ kind: 'session-video', targetId: sessionExerciseId }}
            hasVideo={Boolean(videoUrl)}
            onUploaded={saveVideo}
            onRemove={() => saveVideo(null)}
            label="Grabar o subir la serie"
          />
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={status === 'saving'}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-ink-750 px-3 text-sm font-medium text-ink-50 transition-colors hover:bg-ink-700 disabled:opacity-50"
          >
            {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar
          </button>
          {status === 'saved' ? (
            <span className="flex items-center gap-1 text-xs font-medium text-success-500">
              <Check className="h-3.5 w-3.5" />
              Enviado
            </span>
          ) : null}
          {status === 'error' && message ? <span className="text-xs text-danger-500">{message}</span> : null}
        </div>
      </div>
    </details>
  );
}
