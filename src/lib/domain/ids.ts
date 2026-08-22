import { randomUUID, randomInt } from 'node:crypto';

/** Identificador de fila. UUID v4 para ser compatible con PostgreSQL. */
export function newId(): string {
  return randomUUID();
}

/** Alfabeto sin caracteres ambiguos (0/O, 1/I) para códigos leídos en voz alta. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Sufijo del código de entrenador: 5 caracteres. Ej. `A7K29`. */
export function newCoachCodeSuffix(length = 5): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

/** Código completo de entrenador. Ej. `LORD-A7K29`. */
export function newCoachCode(): string {
  return `LORD-${newCoachCodeSuffix()}`;
}

/** Normaliza lo que escribe el jugador: `lord-a7k29`, `a7k29` → `LORD-A7K29`. */
export function normalizeCoachCode(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, '').replace(/^LORD-?/, '');
  return `LORD-${cleaned}`;
}

/** Sufijo (para enlaces `/join/A7K29`). */
export function coachCodeSuffix(code: string): string {
  return code.replace(/^LORD-?/, '');
}

/** Clave estable de conversación entrenador↔jugador. */
export function threadKey(coachId: string, athleteId: string): string {
  return `${coachId}:${athleteId}`;
}
