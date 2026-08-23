'use client';

import { useId, useRef, useState } from 'react';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { upload } from '@vercel/blob/client';
import {
  allowedTypes,
  extensionFor,
  formatBytes,
  MAX_BYTES,
  MAX_BYTES_LOCAL,
  type MediaMode,
  type MediaScope,
} from '@/lib/media/types';

/**
 * Botón de «subir vídeo».
 *
 * Con Vercel Blob el fichero va del móvil al almacén sin pasar por el servidor
 * (`@vercel/blob/client`): una función serverless corta el cuerpo a 4,5 MB y un
 * vídeo grabado con el iPhone pesa mucho más. Con el almacén en disco —sólo en
 * desarrollo— se sube por XHR, que es lo único que da progreso real.
 *
 * El componente sólo devuelve la URL: guardarla en la base es cosa de quien lo
 * usa, con su Server Action y su comprobación de permisos.
 */

type Status = { state: 'idle' } | { state: 'uploading'; percent: number } | { state: 'error'; message: string };

export function VideoUpload({
  mode,
  scope,
  hasVideo,
  onUploaded,
  onRemove,
  label = 'Subir vídeo',
}: {
  mode: MediaMode;
  scope: MediaScope;
  hasVideo: boolean;
  onUploaded: (url: string) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  label?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ state: 'idle' });

  if (mode === 'off') return null;

  const limit = mode === 'blob' ? MAX_BYTES[scope.kind] : MAX_BYTES_LOCAL;

  async function handleFile(file: File) {
    const types = allowedTypes(scope.kind);
    if (!types.includes(file.type)) {
      setStatus({
        state: 'error',
        message: file.type
          ? 'Ese formato no vale. Sube un vídeo MP4, MOV o WebM.'
          : 'No se reconoce el formato del fichero.',
      });
      return;
    }
    if (file.size > limit) {
      setStatus({ state: 'error', message: `El vídeo pesa demasiado: máximo ${formatBytes(limit)}.` });
      return;
    }

    setStatus({ state: 'uploading', percent: 0 });
    try {
      const url = mode === 'blob' ? await uploadToBlob(file, scope, setStatus) : await uploadToServer(file, scope, setStatus);
      await onUploaded(url);
      setStatus({ state: 'idle' });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'No se ha podido subir el vídeo.',
      });
    }
  }

  const uploading = status.state === 'uploading';

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="sr-only"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Se limpia el input para que elegir el mismo fichero otra vez
          // vuelva a disparar el evento.
          event.target.value = '';
          if (file) void handleFile(file);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-ink-700 bg-ink-850 px-3.5 text-sm font-medium text-ink-100 transition-colors hover:border-volt-500 hover:text-volt-500 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? `Subiendo… ${status.percent}%` : hasVideo ? 'Cambiar vídeo' : label}
        </button>

        {hasVideo && onRemove ? (
          <button
            type="button"
            onClick={() => void onRemove()}
            disabled={uploading}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-ink-700 px-3.5 text-sm font-medium text-ink-400 transition-colors hover:border-danger-500 hover:text-danger-500 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Quitar
          </button>
        ) : null}
      </div>

      {uploading ? (
        <div className="h-1 overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full bg-volt-500 transition-[width]"
            style={{ width: `${status.percent}%` }}
          />
        </div>
      ) : null}

      {status.state === 'error' ? <p className="text-xs text-danger-500">{status.message}</p> : null}

      <p className="text-[11px] text-ink-500">MP4, MOV o WebM · hasta {formatBytes(limit)}</p>
    </div>
  );
}

/** Subida directa al almacén. El servidor sólo emite el permiso. */
async function uploadToBlob(
  file: File,
  scope: MediaScope,
  setStatus: (status: Status) => void,
): Promise<string> {
  const result = await upload(`${scope.kind}/${scope.targetId}.${extensionFor(file.type)}`, file, {
    access: 'public',
    contentType: file.type,
    handleUploadUrl: '/api/media/upload',
    clientPayload: JSON.stringify(scope),
    onUploadProgress: ({ percentage }) => setStatus({ state: 'uploading', percent: Math.round(percentage) }),
  });
  return result.url;
}

/** Subida al propio servidor (almacén en disco). */
function uploadToServer(file: File, scope: MediaScope, setStatus: (status: Status) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.set('kind', scope.kind);
    body.set('targetId', scope.targetId);
    body.set('file', file);

    const request = new XMLHttpRequest();
    request.open('POST', '/api/media/upload');
    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      setStatus({ state: 'uploading', percent: Math.round((event.loaded / event.total) * 100) });
    });
    request.addEventListener('load', () => {
      let payload: { url?: string; message?: string } = {};
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        // Respuesta no JSON: se trata como error genérico más abajo.
      }
      if (request.status >= 200 && request.status < 300 && payload.url) resolve(payload.url);
      else reject(new Error(payload.message ?? 'No se ha podido subir el vídeo.'));
    });
    request.addEventListener('error', () => reject(new Error('Se ha cortado la conexión durante la subida.')));
    request.send(body);
  });
}
