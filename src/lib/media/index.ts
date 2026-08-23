import 'server-only';
import { isServerlessRuntime } from '@/lib/db';
import { blobMediaDriver } from './blob-driver';
import { localMediaDriver } from './local-driver';
import type { MediaDriver, MediaMode } from './types';

export * from './types';

/**
 * Elige el almacén de medios igual que `db()` elige el de datos: por lo que hay
 * en el entorno, sin obligar a configurar nada para trabajar en local.
 *
 * Devuelve `null` cuando no hay ninguno disponible. Eso no rompe la app: los
 * campos de vídeo siguen admitiendo un enlace pegado a mano, que es como
 * funcionaba antes de existir la subida.
 */
export function mediaDriver(): MediaDriver | null {
  const configured = (process.env.LORDGYM_MEDIA_DRIVER || '').toLowerCase();
  if (configured === 'blob') return blobMediaDriver;
  if (configured === 'local') return localMediaDriver;
  if (configured === 'off') return null;

  if (process.env.BLOB_READ_WRITE_TOKEN) return blobMediaDriver;
  // En serverless el disco no persiste: mejor sin subida que con una subida
  // que se evapora en el siguiente despliegue.
  return isServerlessRuntime() ? null : localMediaDriver;
}

/** Lo que necesita saber el navegador para pintar el campo de subida. */
export function mediaMode(): MediaMode {
  const driver = mediaDriver();
  if (!driver) return 'off';
  return driver.directUpload ? 'blob' : 'local';
}

/**
 * Borra un fichero que guardamos nosotros. Un enlace pegado a mano (YouTube y
 * demás) se ignora: no es nuestro y no hay nada que borrar.
 *
 * Nunca lanza: quedarse con un fichero huérfano en el almacén es un problema
 * pequeño; que falle por eso el guardado de la fila es un problema grande.
 */
export async function removeIfOwned(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const driver = mediaDriver();
  if (!driver) return;
  const ours =
    (driver.name === 'local' && url.startsWith('/api/media/')) ||
    (driver.name === 'vercel-blob' && /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(url));
  if (!ours) return;
  try {
    await driver.remove(url);
  } catch (error) {
    console.error('[lordgym] no se ha podido borrar el vídeo antiguo:', error);
  }
}
