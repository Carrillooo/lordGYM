'use client';

/**
 * Cola offline del modo entrenamiento (§65).
 *
 * Cada serie registrada se guarda primero en `localStorage` y después se envía
 * al servidor. Si falla (sin cobertura en el gimnasio), queda pendiente y se
 * reintenta al recuperar conexión. La clave es el id de la serie, por lo que
 * reintentar nunca duplica: sobrescribe el último valor conocido.
 */

const STORAGE_PREFIX = 'lordgym.session.';

export interface QueuedSet {
  sessionId: string;
  setId: string;
  actualReps: number | null;
  actualWeightKg: number | null;
  actualDurationSeconds: number | null;
  actualDistanceM: number | null;
  rpe: number | null;
  status: 'pending' | 'completed' | 'skipped';
  queuedAt: number;
}

function storageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}`;
}

function safeRead(sessionId: string): Record<string, QueuedSet> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    return raw ? (JSON.parse(raw) as Record<string, QueuedSet>) : {};
  } catch {
    return {};
  }
}

function safeWrite(sessionId: string, value: Record<string, QueuedSet>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(sessionId), JSON.stringify(value));
  } catch {
    // Cuota agotada o almacenamiento bloqueado: la sesión sigue online.
  }
}

export function enqueue(entry: Omit<QueuedSet, 'queuedAt'>): void {
  const queue = safeRead(entry.sessionId);
  queue[entry.setId] = { ...entry, queuedAt: Date.now() };
  safeWrite(entry.sessionId, queue);
}

export function dequeue(sessionId: string, setId: string): void {
  const queue = safeRead(sessionId);
  delete queue[setId];
  safeWrite(sessionId, queue);
}

export function pending(sessionId: string): QueuedSet[] {
  return Object.values(safeRead(sessionId)).sort((a, b) => a.queuedAt - b.queuedAt);
}

export function clearSession(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(sessionId));
  } catch {
    // Nada que limpiar.
  }
}
