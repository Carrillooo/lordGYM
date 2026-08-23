import 'server-only';
import { del, put } from '@vercel/blob';
import type { MediaDriver, StoredMedia } from './types';

/**
 * Vercel Blob: el almacén recomendado en producción.
 *
 * Se activa solo con `BLOB_READ_WRITE_TOKEN`, que la integración de Vercel
 * inyecta al crear el store. Las subidas grandes van directas del navegador al
 * almacén (ver `/api/media/upload`): una función serverless de Vercel rechaza
 * cuerpos de más de 4,5 MB, así que un vídeo jamás puede pasar por ella.
 */
export const blobMediaDriver: MediaDriver = {
  name: 'vercel-blob',
  directUpload: true,

  async put(pathname, body, contentType): Promise<StoredMedia> {
    const result = await put(pathname, Buffer.from(body), {
      access: 'public',
      contentType,
      addRandomSuffix: false,
    });
    return { url: result.url, contentType, size: body.byteLength };
  },

  async remove(url): Promise<void> {
    await del(url);
  },
};
