/**
 * Almacenamiento de vídeos (técnica del entrenador y series del jugador).
 *
 * Los ficheros no caben en la base de datos —un vídeo de una serie pesa más que
 * toda la tabla de sesiones— así que viven aparte, y en la fila sólo queda la
 * URL. Igual que con los datos, el almacén es intercambiable: Vercel Blob en
 * producción, disco en local, y nada en absoluto si no hay ninguno configurado.
 *
 * Este fichero no importa `server-only` a propósito: los tipos y los límites se
 * comparten con el componente de subida, que corre en el navegador.
 */

export type MediaScopeKind = 'exercise-video' | 'session-video';

/** Qué se sube y a qué fila pertenece. Es lo que el servidor verifica. */
export interface MediaScope {
  kind: MediaScopeKind;
  /** Id de la fila: el ejercicio, o la fila de `session_exercises`. */
  targetId: string;
}

export interface StoredMedia {
  url: string;
  contentType: string;
  size: number;
}

export interface MediaDriver {
  readonly name: 'vercel-blob' | 'local';
  /** `true` si el navegador puede subir directo, sin pasar por el servidor. */
  readonly directUpload: boolean;
  put(pathname: string, body: ArrayBuffer, contentType: string): Promise<StoredMedia>;
  remove(url: string): Promise<void>;
}

/** Modo de subida que ve el navegador. `off` = no hay almacén configurado. */
export type MediaMode = 'blob' | 'local' | 'off';

/**
 * Tipos admitidos. `video/quicktime` es obligatorio: es lo que graba la cámara
 * del iPhone, que es con lo que se van a grabar todos estos vídeos.
 */
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

/**
 * Límites de tamaño. El vídeo de una serie grabado con el móvil ronda los
 * 30-60 MB; 200 MB deja margen para un ejercicio explicado entero en 4K.
 *
 * El almacén local es más estricto porque el fichero pasa entero por memoria
 * del servidor, mientras que con Blob el navegador sube directo.
 */
export const MAX_BYTES: Record<MediaScopeKind, number> = {
  'exercise-video': 200 * 1024 * 1024,
  'session-video': 200 * 1024 * 1024,
};

export const MAX_BYTES_LOCAL = 60 * 1024 * 1024;

export function allowedTypes(_kind: MediaScopeKind): readonly string[] {
  return VIDEO_TYPES;
}

/** Extensión a partir del tipo MIME. Nunca se usa la del nombre original. */
export function extensionFor(contentType: string): string {
  switch (contentType) {
    case 'video/mp4':
      return 'mp4';
    case 'video/quicktime':
      return 'mov';
    case 'video/webm':
      return 'webm';
    default:
      return 'bin';
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
