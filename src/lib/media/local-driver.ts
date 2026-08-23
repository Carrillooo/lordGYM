import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MediaDriver, StoredMedia } from './types';

/**
 * Almacén en disco para desarrollo.
 *
 * No sirve en Vercel —el disco es de sólo lectura y efímero— y por eso el
 * factory ni lo considera allí. En local evita tener que dar de alta un almacén
 * en la nube sólo para probar que la subida funciona.
 *
 * Los ficheros salen por `/api/media/...`, que exige sesión: son vídeos de
 * gente entrenando, no assets públicos.
 */

const ROOT = process.env.LORDGYM_MEDIA_DIR || '.lordgym-media';

/**
 * Comprueba que la ruta pedida cae dentro del directorio de medios.
 * Sin esto, un `..` en el nombre leería cualquier fichero del servidor.
 */
export function resolveInsideRoot(pathname: string): string | null {
  const root = path.resolve(ROOT);
  const target = path.resolve(root, pathname);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

export const localMediaDriver: MediaDriver = {
  name: 'local',
  directUpload: false,

  async put(pathname, body, contentType): Promise<StoredMedia> {
    const target = resolveInsideRoot(pathname);
    if (!target) throw new Error('Ruta de fichero no válida.');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.from(body));
    return { url: `/api/media/${pathname}`, contentType, size: body.byteLength };
  },

  async remove(url): Promise<void> {
    if (!url.startsWith('/api/media/')) return;
    const target = resolveInsideRoot(url.slice('/api/media/'.length));
    if (!target) return;
    await fs.rm(target, { force: true });
  },
};
