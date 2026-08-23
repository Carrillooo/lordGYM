import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Almacén de vídeos y vínculo entrenador↔ejercicio.
 *
 * Lo que se comprueba aquí es lo que puede salir caro: que un nombre de fichero
 * con `..` no saque a nadie del directorio de medios, que el ámbito de subida
 * no acepte lo que le manden, y que el vídeo del entrenador no se escriba nunca
 * en la biblioteca compartida.
 */

let dataDir: string;

beforeAll(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lordgym-media-'));
  process.env.LORDGYM_DATA_FILE = path.join(dataDir, 'db.json');
  process.env.LORDGYM_DB_DRIVER = 'local';
  process.env.LORDGYM_MEDIA_DRIVER = 'local';
  process.env.LORDGYM_MEDIA_DIR = path.join(dataDir, 'media');
});

afterAll(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe('almacén de vídeos en disco', () => {
  it('guarda, sirve por una URL propia y borra', async () => {
    const { localMediaDriver } = await import('@/lib/media/local-driver');
    const contenido = new TextEncoder().encode('no es un vídeo, pero pesa igual').buffer as ArrayBuffer;

    const stored = await localMediaDriver.put('sessions/atleta/serie.mp4', contenido, 'video/mp4');
    expect(stored.url).toBe('/api/media/sessions/atleta/serie.mp4');
    expect(stored.size).toBe(contenido.byteLength);
    expect(await fs.readFile(path.join(dataDir, 'media', 'sessions/atleta/serie.mp4'), 'utf8')).toContain('vídeo');

    await localMediaDriver.remove(stored.url);
    await expect(fs.stat(path.join(dataDir, 'media', 'sessions/atleta/serie.mp4'))).rejects.toThrow();
  });

  it('no deja escapar del directorio de medios', async () => {
    const { resolveInsideRoot } = await import('@/lib/media/local-driver');
    expect(resolveInsideRoot('../../etc/passwd')).toBeNull();
    expect(resolveInsideRoot('sessions/../../fuera.mp4')).toBeNull();
    expect(resolveInsideRoot('sessions/dentro.mp4')).not.toBeNull();
  });
});

describe('ámbito de subida', () => {
  it('rechaza tipos y destinos inventados', async () => {
    const { parseScope, blobPathnameFor } = await import('@/lib/media/authorize');

    expect(() => parseScope({ kind: 'todo', targetId: 'x' })).toThrow();
    expect(() => parseScope({ kind: 'session-video', targetId: '' })).toThrow();
    expect(() => parseScope({ kind: 'session-video', targetId: 'x'.repeat(200) })).toThrow();
    expect(() => parseScope('no es json')).toThrow();

    const scope = parseScope(JSON.stringify({ kind: 'exercise-video', targetId: 'abc' }));
    expect(scope).toEqual({ kind: 'exercise-video', targetId: 'abc' });
    expect(blobPathnameFor(scope, 'video/quicktime')).toBe('exercise-video/abc.mov');
  });
});

describe('vídeo de técnica del entrenador', () => {
  it('manda sobre el del catálogo y no toca la biblioteca compartida', async () => {
    const { db } = await import('@/lib/db');
    const { newId } = await import('@/lib/domain/ids');
    const { nowIso } = await import('@/lib/domain/datetime');
    const { setExerciseVideo, videoUrlFor, videoUrlsFor } = await import('@/lib/services/exercise-media');

    const ejercicio = {
      id: newId(),
      owner_coach_id: null,
      name: 'Press de banca',
      category: 'pecho' as const,
      metric_type: 'strength' as const,
      movement_type: null,
      muscles: [],
      equipment: [],
      description: null,
      technique: null,
      video_url: 'https://ejemplo.test/catalogo.mp4',
      image_url: null,
      figure_key: null,
      created_at: nowIso(),
    };
    await db().insert('exercises', ejercicio);

    const josep = newId();
    const otro = newId();

    // Sin vídeo propio se ve el del catálogo.
    expect(await videoUrlFor(ejercicio, josep)).toBe('https://ejemplo.test/catalogo.mp4');

    await setExerciseVideo(josep, ejercicio.id, '/api/media/exercises/josep/press.mp4');
    expect(await videoUrlFor(ejercicio, josep)).toBe('/api/media/exercises/josep/press.mp4');

    // El de al lado sigue viendo el del catálogo: el vídeo es de quien lo sube.
    expect(await videoUrlFor(ejercicio, otro)).toBe('https://ejemplo.test/catalogo.mp4');

    // Y la fila del catálogo no se ha tocado.
    const [fila] = await db().select('exercises', { id: ejercicio.id });
    expect(fila.video_url).toBe('https://ejemplo.test/catalogo.mp4');

    const mapa = await videoUrlsFor([ejercicio.id], josep);
    expect(mapa.get(ejercicio.id)).toBe('/api/media/exercises/josep/press.mp4');

    // Guardar dos veces no duplica la fila; quitarlo devuelve el del catálogo.
    await setExerciseVideo(josep, ejercicio.id, '/api/media/exercises/josep/press-2.mp4');
    expect(await db().select('exercise_media', { coach_id: josep })).toHaveLength(1);
    await setExerciseVideo(josep, ejercicio.id, null);
    expect(await db().select('exercise_media', { coach_id: josep })).toHaveLength(0);
    expect(await videoUrlFor(ejercicio, josep)).toBe('https://ejemplo.test/catalogo.mp4');
  });
});
