import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { getCurrentUser } from '@/lib/auth/session';
import { resolveInsideRoot } from '@/lib/media/local-driver';
import { mediaDriver } from '@/lib/media';
import { extensionFor, VIDEO_TYPES } from '@/lib/media/types';

/**
 * Sirve los vídeos del almacén local (desarrollo).
 *
 * Exige sesión: son vídeos de gente entrenando, no ficheros públicos. Con
 * Vercel Blob esta ruta no se usa —las URL apuntan al almacén— y por eso aquí
 * sólo responde si el driver activo es el de disco.
 *
 * Admite `Range` porque Safari no reproduce un vídeo sin él: pide los primeros
 * bytes antes de decidir si puede con el fichero.
 */

const TYPE_BY_EXTENSION = new Map(VIDEO_TYPES.map((type) => [extensionFor(type), type]));

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const driver = mediaDriver();
  if (!driver || driver.name !== 'local') return new Response('No encontrado', { status: 404 });
  if (!(await getCurrentUser())) return new Response('No autorizado', { status: 401 });

  const { path } = await params;
  const target = resolveInsideRoot(path.join('/'));
  if (!target) return new Response('No encontrado', { status: 404 });

  const stat = await fs.stat(target).catch(() => null);
  if (!stat?.isFile()) return new Response('No encontrado', { status: 404 });

  const contentType = TYPE_BY_EXTENSION.get(target.split('.').pop() ?? '') ?? 'application/octet-stream';
  const range = parseRange(request.headers.get('range'), stat.size);

  if (!range) {
    return new Response(stream(target), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }

  return new Response(stream(target, range), {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(range.end - range.start + 1),
      'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

function stream(target: string, range?: { start: number; end: number }): ReadableStream {
  return Readable.toWeb(createReadStream(target, range)) as ReadableStream;
}

function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;
  // `bytes=-500` = los últimos 500 bytes.
  const start = rawStart === '' ? Math.max(0, size - Number(rawEnd)) : Number(rawStart);
  const end = rawStart === '' || rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) return null;
  return { start, end };
}
