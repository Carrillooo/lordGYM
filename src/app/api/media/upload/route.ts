import { randomBytes } from 'node:crypto';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { authorizeUpload, blobPathnameFor, parseScope } from '@/lib/media/authorize';
import { mediaDriver } from '@/lib/media';
import { AuthorizationError } from '@/lib/auth/guards';
import {
  allowedTypes,
  extensionFor,
  formatBytes,
  MAX_BYTES,
  MAX_BYTES_LOCAL,
  type MediaScope,
} from '@/lib/media/types';

/**
 * Subida de vídeos. Dos caminos según el almacén:
 *
 * - **Vercel Blob**: el navegador sube directo al almacén con un permiso de un
 *   solo uso que emite esta ruta. Es obligatorio que sea así: una función
 *   serverless de Vercel rechaza cuerpos de más de 4,5 MB, y un vídeo de una
 *   serie pesa diez veces eso.
 * - **Disco local** (desarrollo): el fichero sí pasa por aquí, con un límite
 *   más bajo, porque se carga entero en memoria.
 *
 * En ambos casos el permiso se comprueba antes de escribir nada, y el tipo y el
 * tamaño se validan en el servidor: lo que diga el navegador no cuenta.
 */

export async function POST(request: Request): Promise<Response> {
  const driver = mediaDriver();
  if (!driver) {
    return Response.json(
      { message: 'Este despliegue no tiene almacén de vídeos configurado.' },
      { status: 503 },
    );
  }

  try {
    if (driver.directUpload) return await handleBlobUpload(request);
    return await handleLocalUpload(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'No se ha podido subir el vídeo.';
    return Response.json({ message }, { status: 400 });
  }
}

/** Emite el permiso de subida directa, ya validado contra el ámbito. */
async function handleBlobUpload(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  const result = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const scope = parseScope(clientPayload);
      await authorizeUpload(scope);

      const types = allowedTypes(scope.kind);
      const expected = types.map((type) => blobPathnameFor(scope, type));
      if (!expected.includes(pathname)) {
        throw new AuthorizationError('Ruta de subida no válida.');
      }

      return {
        allowedContentTypes: [...types],
        maximumSizeInBytes: MAX_BYTES[scope.kind],
        addRandomSuffix: true,
        tokenPayload: null,
      };
    },
    // La confirmación llega por webhook desde Vercel y no se puede recibir en
    // local. No dependemos de ella: la URL se guarda desde el cliente en cuanto
    // termina la subida, con una Server Action que vuelve a comprobar permisos.
    onUploadCompleted: async () => {},
  });

  return Response.json(result);
}

/** Guarda el fichero en disco. Sólo fuera de serverless. */
async function handleLocalUpload(request: Request): Promise<Response> {
  const form = await request.formData();
  const scope: MediaScope = parseScope({
    kind: form.get('kind'),
    targetId: form.get('targetId'),
  });
  const prefix = await authorizeUpload(scope);

  const file = form.get('file');
  if (!(file instanceof File)) throw new Error('Falta el fichero.');

  const contentType = file.type;
  if (!allowedTypes(scope.kind).includes(contentType)) {
    throw new Error('Formato no admitido. Sube un vídeo MP4, MOV o WebM.');
  }
  if (file.size > MAX_BYTES_LOCAL) {
    throw new Error(`El vídeo supera el límite de ${formatBytes(MAX_BYTES_LOCAL)} en modo local.`);
  }

  const driver = mediaDriver();
  if (!driver) throw new Error('Sin almacén de vídeos.');

  // El sufijo aleatorio evita que una subida nueva quede escondida detrás de la
  // caché del navegador por reutilizar la misma URL.
  const pathname = `${prefix}-${randomBytes(6).toString('hex')}.${extensionFor(contentType)}`;
  const stored = await driver.put(pathname, await file.arrayBuffer(), contentType);
  return Response.json({ url: stored.url });
}
