/** Normaliza texto para buscar sin acentos ni mayúsculas. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** `true` si `haystack` contiene `needle` ignorando acentos y mayúsculas. */
export function matchesText(haystack: string, needle: string): boolean {
  return normalizeText(haystack).includes(normalizeText(needle));
}
