import type { z } from 'zod';

export interface ActionState {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const idleState: ActionState = { status: 'idle' };

export function errorState(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { status: 'error', message, fieldErrors };
}

export function successState(message?: string): ActionState {
  return { status: 'success', message };
}

/** Primer mensaje de error por campo, listo para pintar bajo cada input. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Traduce una excepción de servicio en estado de formulario. */
export function fromException(error: unknown, fallback = 'Ha ocurrido un error inesperado.'): ActionState {
  if (error instanceof Error && (error.name === 'ServiceError' || error.name === 'AuthorizationError')) {
    return errorState(error.message);
  }
  console.error('[lordgym] action error:', error);
  return errorState(fallback);
}
