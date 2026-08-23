'use client';

import { Video } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Reproductor del vídeo de un ejercicio.
 *
 * Un vídeo subido a LORDGYM se reproduce dentro de la app: durante la serie no
 * se puede estar saliendo a otra pestaña. Un enlace pegado a mano (YouTube y
 * compañía) no se puede incrustar sin su reproductor, así que ése sigue siendo
 * un enlace normal.
 *
 * `playsInline` es lo que impide que Safari en iPhone se apodere de la pantalla
 * completa en cuanto se pulsa reproducir.
 */

/** `true` si la URL apunta a un fichero de vídeo que podemos reproducir. */
export function isPlayable(url: string): boolean {
  if (url.startsWith('/api/media/')) return true;
  const withoutQuery = url.split('?')[0].toLowerCase();
  return /\.(mp4|mov|webm|m4v)$/.test(withoutQuery);
}

export function VideoPlayer({
  url,
  className,
  label = 'Ver vídeo',
}: {
  url: string;
  className?: string;
  label?: string;
}) {
  if (!isPlayable(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 text-sm font-medium text-volt-500 hover:underline"
      >
        <Video className="h-4 w-4" />
        {label}
      </a>
    );
  }

  return (
    <video
      src={url}
      controls
      playsInline
      preload="metadata"
      // Se limita la altura: un vídeo grabado en vertical con el móvil ocupa
      // si no la pantalla entera y esconde las series.
      className={cn('max-h-[45vh] w-full rounded-xl border border-ink-700 bg-ink-950', className)}
    />
  );
}
