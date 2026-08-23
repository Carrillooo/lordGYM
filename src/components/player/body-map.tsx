'use client';

import { cn } from '@/lib/cn';

export interface BodyZone {
  id: string;
  label: string;
  side: 'izquierda' | 'derecha' | 'central';
  /** Rectángulo aproximado de la zona sobre la silueta (viewBox 0 0 200 420). */
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
}

export const BODY_ZONES: BodyZone[] = [
  { id: 'cabeza', label: 'Cabeza / cuello', side: 'central', x: 84, y: 8, width: 32, height: 46, rx: 16 },
  { id: 'hombro-izq', label: 'Hombro', side: 'izquierda', x: 52, y: 60, width: 28, height: 24, rx: 12 },
  { id: 'hombro-der', label: 'Hombro', side: 'derecha', x: 120, y: 60, width: 28, height: 24, rx: 12 },
  { id: 'pecho', label: 'Pecho', side: 'central', x: 80, y: 62, width: 40, height: 34, rx: 10 },
  { id: 'brazo-izq', label: 'Brazo', side: 'izquierda', x: 44, y: 88, width: 24, height: 56, rx: 12 },
  { id: 'brazo-der', label: 'Brazo', side: 'derecha', x: 132, y: 88, width: 24, height: 56, rx: 12 },
  { id: 'abdomen', label: 'Abdomen', side: 'central', x: 80, y: 100, width: 40, height: 40, rx: 10 },
  { id: 'espalda', label: 'Espalda / lumbar', side: 'central', x: 80, y: 142, width: 40, height: 32, rx: 10 },
  { id: 'cadera-izq', label: 'Cadera / ingle', side: 'izquierda', x: 66, y: 176, width: 28, height: 28, rx: 10 },
  { id: 'cadera-der', label: 'Cadera / ingle', side: 'derecha', x: 106, y: 176, width: 28, height: 28, rx: 10 },
  { id: 'cuadriceps-izq', label: 'Cuádriceps', side: 'izquierda', x: 66, y: 208, width: 28, height: 58, rx: 12 },
  { id: 'cuadriceps-der', label: 'Cuádriceps', side: 'derecha', x: 106, y: 208, width: 28, height: 58, rx: 12 },
  { id: 'isquios-izq', label: 'Isquiotibiales', side: 'izquierda', x: 66, y: 268, width: 28, height: 34, rx: 10 },
  { id: 'isquios-der', label: 'Isquiotibiales', side: 'derecha', x: 106, y: 268, width: 28, height: 34, rx: 10 },
  { id: 'rodilla-izq', label: 'Rodilla', side: 'izquierda', x: 68, y: 304, width: 24, height: 24, rx: 12 },
  { id: 'rodilla-der', label: 'Rodilla', side: 'derecha', x: 108, y: 304, width: 24, height: 24, rx: 12 },
  { id: 'gemelo-izq', label: 'Gemelo', side: 'izquierda', x: 68, y: 330, width: 24, height: 46, rx: 12 },
  { id: 'gemelo-der', label: 'Gemelo', side: 'derecha', x: 108, y: 330, width: 24, height: 46, rx: 12 },
  { id: 'tobillo-izq', label: 'Tobillo', side: 'izquierda', x: 70, y: 378, width: 20, height: 22, rx: 10 },
  { id: 'tobillo-der', label: 'Tobillo', side: 'derecha', x: 110, y: 378, width: 20, height: 22, rx: 10 },
];

/**
 * Mapa de dolor (§25). Silueta esquemática con zonas tocables; cada zona es un
 * botón real, de modo que también funciona con teclado y lector de pantalla.
 */
export function BodyMap({
  selectedId,
  onSelect,
  marked = {},
}: {
  selectedId: string | null;
  onSelect: (zone: BodyZone) => void;
  /** Intensidad ya registrada por zona, para colorear el histórico. */
  marked?: Record<string, number>;
}) {
  return (
    <svg
      viewBox="0 0 200 420"
      className="mx-auto h-auto w-full max-w-[320px] sm:max-w-[240px]"
      role="group"
      aria-label="Silueta del cuerpo para marcar molestias"
    >
      {/* Silueta de fondo */}
      <g fill="#141821" stroke="#232936" strokeWidth="1.5">
        <circle cx="100" cy="30" r="22" />
        <rect x="92" y="50" width="16" height="12" rx="4" />
        <rect x="62" y="60" width="76" height="118" rx="24" />
        <rect x="44" y="66" width="22" height="86" rx="11" />
        <rect x="134" y="66" width="22" height="86" rx="11" />
        <rect x="64" y="172" width="32" height="228" rx="16" />
        <rect x="104" y="172" width="32" height="228" rx="16" />
      </g>

      {BODY_ZONES.map((zone) => {
        const intensity = marked[zone.id];
        const selected = selectedId === zone.id;
        return (
          <g key={zone.id}>
            <rect
              x={zone.x}
              y={zone.y}
              width={zone.width}
              height={zone.height}
              rx={zone.rx ?? 8}
              className={cn(
                'cursor-pointer transition-all',
                selected
                  ? 'fill-[color:var(--color-volt-500)] opacity-80'
                  : intensity
                    ? intensity >= 7
                      ? 'fill-[color:var(--color-danger-500)] opacity-55'
                      : intensity >= 4
                        ? 'fill-[color:var(--color-amber-glow)] opacity-50'
                        : 'fill-[color:var(--color-teal-glow)] opacity-40'
                    : 'fill-white opacity-[0.04] hover:opacity-[0.14]',
              )}
              onClick={() => onSelect(zone)}
            />
            {/* Botón invisible superpuesto: accesibilidad por teclado. */}
            <foreignObject x={zone.x} y={zone.y} width={zone.width} height={zone.height}>
              <button
                type="button"
                onClick={() => onSelect(zone)}
                aria-pressed={selected}
                className="h-full w-full opacity-0"
              >
                {zone.label} {zone.side !== 'central' ? zone.side : ''}
              </button>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}
