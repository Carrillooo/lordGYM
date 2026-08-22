import 'server-only';
import { isServerlessRuntime } from '@/lib/db';

export interface DeploymentIssue {
  title: string;
  detail: string;
  variables: string[];
}

/**
 * Comprueba que el despliegue está configurado antes de que el usuario se
 * choque con un error genérico al intentar entrar.
 *
 * Devuelve `null` cuando todo está en orden (que es el caso en local, donde el
 * driver de fichero funciona sin configurar nada).
 */
export function deploymentIssue(): DeploymentIssue | null {
  const driver = (process.env.LORDGYM_DB_DRIVER || 'local').toLowerCase();
  const serverless = isServerlessRuntime();

  if (serverless && driver !== 'supabase') {
    return {
      title: 'Falta configurar la base de datos',
      detail:
        'Este despliegue corre en un entorno serverless, donde el almacenamiento en fichero no ' +
        'persiste. Crea un proyecto en Supabase, ejecuta supabase/schema.sql y añade estas ' +
        'variables de entorno:',
      variables: [
        'LORDGYM_DB_DRIVER=supabase',
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'LORDGYM_SESSION_SECRET',
      ],
    };
  }

  if (driver === 'supabase') {
    const missing = [
      !process.env.NEXT_PUBLIC_SUPABASE_URL && 'NEXT_PUBLIC_SUPABASE_URL',
      !process.env.SUPABASE_SERVICE_ROLE_KEY &&
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        'SUPABASE_SERVICE_ROLE_KEY',
    ].filter((value): value is string => Boolean(value));

    if (missing.length > 0) {
      return {
        title: 'Faltan las claves de Supabase',
        detail: 'Has activado el driver de Supabase pero no están todas sus variables:',
        variables: missing,
      };
    }
  }

  if (process.env.NODE_ENV === 'production' && !process.env.LORDGYM_SESSION_SECRET) {
    return {
      title: 'Falta la clave de sesión',
      detail:
        'En producción hace falta una clave para firmar las cookies. Genera una con ' +
        '`openssl rand -hex 32` y añádela como:',
      variables: ['LORDGYM_SESSION_SECRET'],
    };
  }

  return null;
}
