'use client';

/**
 * Bandeja de salida del modo entrenamiento (§65).
 *
 * En muchos gimnasios no hay cobertura: sótano, paredes de hormigón y el wifi
 * de la recepción que no llega. Todo lo que el jugador hace mientras entrena se
 * guarda primero en el móvil y se envía después; si el envío falla, queda aquí
 * y se reintenta en cuanto vuelve la red.
 *
 * Cada entrada tiene una clave estable (la serie, el ejercicio, la sesión), así
 * que reintentar nunca duplica: sobrescribe el último valor conocido. Y el
 * orden importa —el cierre de la sesión recalcula el volumen a partir de las
 * series— así que el cierre siempre se envía el último.
 */

const STORAGE_KEY = 'lordgym.outbox';

export interface SetPayload {
  sessionId: string;
  setId: string;
  actualReps: number | null;
  actualWeightKg: number | null;
  actualDurationSeconds: number | null;
  actualDistanceM: number | null;
  rpe: number | null;
  status: 'pending' | 'completed' | 'skipped';
}

export interface CommentPayload {
  sessionId: string;
  sessionExerciseId: string;
  comment: string | null;
}

export interface FinishPayload {
  sessionId: string;
  durationSeconds: number;
  sessionRpe: number;
  feeling: number;
  fatigue: number;
  soreness: number;
  comment?: string;
}

export type OutboxEntry =
  | { kind: 'set'; key: string; sessionId: string; queuedAt: number; payload: SetPayload }
  | { kind: 'comment'; key: string; sessionId: string; queuedAt: number; payload: CommentPayload }
  | { kind: 'finish'; key: string; sessionId: string; queuedAt: number; payload: FinishPayload };

type Stored = Record<string, OutboxEntry>;

/** Orden de envío: primero lo que el cierre necesita tener ya guardado. */
const ORDER: Record<OutboxEntry['kind'], number> = { set: 0, comment: 1, finish: 2 };

function read(): Stored {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Stored) : {};
  } catch {
    return {};
  }
}

function write(value: Stored): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Cuota agotada o almacenamiento bloqueado: la sesión sigue funcionando
    // online, sólo pierde la red de seguridad.
  }
}

export function enqueueSet(payload: SetPayload): void {
  put({ kind: 'set', key: `set:${payload.setId}`, sessionId: payload.sessionId, queuedAt: Date.now(), payload });
}

export function enqueueComment(payload: CommentPayload): void {
  put({
    kind: 'comment',
    key: `comment:${payload.sessionExerciseId}`,
    sessionId: payload.sessionId,
    queuedAt: Date.now(),
    payload,
  });
}

export function enqueueFinish(payload: FinishPayload): void {
  put({ kind: 'finish', key: `finish:${payload.sessionId}`, sessionId: payload.sessionId, queuedAt: Date.now(), payload });
}

function put(entry: OutboxEntry): void {
  const stored = read();
  stored[entry.key] = entry;
  write(stored);
}

export function remove(key: string): void {
  const stored = read();
  delete stored[key];
  write(stored);
}

/** Todo lo pendiente, en el orden en que hay que enviarlo. */
export function pending(sessionId?: string): OutboxEntry[] {
  return Object.values(read())
    .filter((entry) => !sessionId || entry.sessionId === sessionId)
    .sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.queuedAt - b.queuedAt);
}

export function pendingCount(sessionId?: string): number {
  return pending(sessionId).length;
}

/** `true` si la sesión está cerrada en el móvil pero aún no en el servidor. */
export function hasPendingFinish(sessionId: string): boolean {
  return Boolean(read()[`finish:${sessionId}`]);
}

/** Se llama cuando el servidor confirma que la sesión ya está cerrada. */
export function clearSession(sessionId: string): void {
  const stored = read();
  for (const [key, entry] of Object.entries(stored)) {
    if (entry.sessionId === sessionId) delete stored[key];
  }
  write(stored);
}
