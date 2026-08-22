import type { ReactNode } from 'react';

/**
 * Motor de ilustración de ejercicios.
 *
 * Cada ejercicio se dibuja como una figura humana en la postura clave del
 * movimiento, más el material que usa. En vez de 40 dibujos sueltos hay un solo
 * renderizador y 40 descripciones de postura: así todas comparten proporciones,
 * grosores y color, y el conjunto se ve como un sistema y no como un pegote de
 * iconos de sitios distintos.
 *
 * Son SVG en línea a propósito: no hay ninguna petición de red, se ven nítidas
 * en cualquier pantalla, pesan nada y funcionan sin conexión (la PWA las tiene
 * igual). Tampoco hay licencias de fotos de por medio.
 *
 * Sistema de coordenadas: lienzo de 200 × 140 visto de perfil, suelo en y = 126.
 * Una persona de pie mide de la coronilla (y ≈ 21) al tobillo (y = 126).
 */

export type Point = [number, number];

export type Prop =
  /** Suelo o pared de referencia. */
  | { kind: 'ground'; y?: number; from?: number; to?: number }
  /** Barra olímpica con discos. */
  | { kind: 'barbell'; at: Point; width?: number; angle?: number }
  /** Mancuerna. */
  | { kind: 'dumbbell'; at: Point; angle?: number }
  /** Banco: `tilt` en grados, 0 = plano. */
  | { kind: 'bench'; at: Point; width?: number; tilt?: number }
  /** Cajón, step o plinto. */
  | { kind: 'box'; at: Point; width?: number; height?: number }
  /** Barra fija anclada (dominadas, jaula). */
  | { kind: 'rig'; at: Point; width?: number; drop?: number }
  /** Polea: torre más cable hasta las manos. */
  | { kind: 'cable'; from: Point; to: Point; tower?: boolean }
  /** Goma elástica (línea ondulada). */
  | { kind: 'band'; from: Point; to: Point }
  /** Cono de agilidad. */
  | { kind: 'cone'; at: Point }
  /** Rueda: bici estática, remoergómetro. */
  | { kind: 'wheel'; at: Point; r?: number }
  /** Trazo auxiliar de material (respaldo, raíl, manillar…). */
  | { kind: 'line'; from: Point; to: Point; dashed?: boolean }
  /** Flecha de dirección del movimiento. */
  | { kind: 'arrow'; from: Point; to: Point };

export interface Pose {
  /** Centro de la cabeza. */
  head: Point;
  /** Columna: del cuello a la cadera (admite curva con puntos intermedios). */
  spine: Point[];
  /** Brazo del lado lejano (se dibuja apagado para dar profundidad). */
  armFar?: Point[];
  /** Brazo del lado cercano. */
  armNear?: Point[];
  legFar?: Point[];
  legNear?: Point[];
  /** Material. `front` lo dibuja por delante de la figura. */
  props?: Prop[];
  propsFront?: Prop[];
}

const NEAR = 'var(--color-ink-100)';
const FAR = 'var(--color-ink-500)';
const GEAR = 'var(--color-volt-500)';
const FLOOR = 'var(--color-ink-700)';
const HINT = 'var(--color-data-500)';

const LIMB = 6;
const TORSO = 7.5;

function path(points: Point[]): string {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
}

function Limb({ points, color, width = LIMB }: { points: Point[]; color: string; width?: number }) {
  if (points.length < 2) return null;
  return (
    <path
      d={path(points)}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** Onda para las gomas elásticas: recta con zigzag perpendicular. */
function bandPath([x1, y1]: Point, [x2, y2]: Point): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const steps = Math.max(4, Math.round(length / 7));
  let d = `M${x1} ${y1}`;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const side = i % 2 === 0 ? 1 : -1;
    const amp = i === steps ? 0 : 3.2 * side;
    d += ` L${x1 + dx * t - uy * amp} ${y1 + dy * t + ux * amp}`;
  }
  return d;
}

function Gear({ prop }: { prop: Prop }): ReactNode {
  switch (prop.kind) {
    case 'ground': {
      const y = prop.y ?? 126;
      return (
        <line
          x1={prop.from ?? 14}
          y1={y}
          x2={prop.to ?? 186}
          y2={y}
          stroke={FLOOR}
          strokeWidth={3}
          strokeLinecap="round"
        />
      );
    }
    case 'barbell': {
      const [x, y] = prop.at;
      const half = (prop.width ?? 52) / 2;
      const angle = prop.angle ?? 0;
      return (
        <g transform={`rotate(${angle} ${x} ${y})`}>
          <line x1={x - half} y1={y} x2={x + half} y2={y} stroke={GEAR} strokeWidth={4} strokeLinecap="round" />
          <rect x={x - half - 3} y={y - 11} width={6} height={22} rx={2.5} fill={GEAR} />
          <rect x={x + half - 3} y={y - 11} width={6} height={22} rx={2.5} fill={GEAR} />
        </g>
      );
    }
    case 'dumbbell': {
      const [x, y] = prop.at;
      const angle = prop.angle ?? 0;
      return (
        <g transform={`rotate(${angle} ${x} ${y})`}>
          <line x1={x - 8} y1={y} x2={x + 8} y2={y} stroke={GEAR} strokeWidth={3.5} strokeLinecap="round" />
          <rect x={x - 12} y={y - 7} width={5.5} height={14} rx={2.5} fill={GEAR} />
          <rect x={x + 6.5} y={y - 7} width={5.5} height={14} rx={2.5} fill={GEAR} />
        </g>
      );
    }
    case 'bench': {
      const [x, y] = prop.at;
      const half = (prop.width ?? 92) / 2;
      const tilt = prop.tilt ?? 0;
      return (
        <g transform={`rotate(${tilt} ${x} ${y})`}>
          <rect x={x - half} y={y} width={half * 2} height={7} rx={3.5} fill={FLOOR} />
        </g>
      );
    }
    case 'box': {
      const [x, y] = prop.at;
      const width = prop.width ?? 44;
      const height = prop.height ?? 30;
      return <rect x={x - width / 2} y={y} width={width} height={height} rx={3} fill={FLOOR} />;
    }
    case 'rig': {
      const [x, y] = prop.at;
      const half = (prop.width ?? 62) / 2;
      const drop = prop.drop ?? 26;
      return (
        <g stroke={FLOOR} strokeWidth={4} strokeLinecap="round" fill="none">
          <line x1={x - half} y1={y} x2={x + half} y2={y} />
          <line x1={x - half} y1={y} x2={x - half} y2={y - drop} />
          <line x1={x + half} y1={y} x2={x + half} y2={y - drop} />
        </g>
      );
    }
    case 'cable': {
      const [x1, y1] = prop.from;
      const [x2, y2] = prop.to;
      return (
        <g>
          {prop.tower === false ? null : (
            <rect x={x1 - 9} y={y1 - 4} width={18} height={Math.max(10, 126 - y1)} rx={3} fill={FLOOR} />
          )}
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={GEAR} strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={x2} cy={y2} r={4} fill={GEAR} />
        </g>
      );
    }
    case 'band':
      return <path d={bandPath(prop.from, prop.to)} fill="none" stroke={GEAR} strokeWidth={3} strokeLinecap="round" />;
    case 'cone': {
      const [x, y] = prop.at;
      return <path d={`M${x} ${y - 14} L${x + 8} ${y} L${x - 8} ${y} Z`} fill={GEAR} />;
    }
    case 'wheel': {
      const [x, y] = prop.at;
      return <circle cx={x} cy={y} r={prop.r ?? 14} fill="none" stroke={FLOOR} strokeWidth={4} />;
    }
    case 'line':
      return (
        <line
          x1={prop.from[0]}
          y1={prop.from[1]}
          x2={prop.to[0]}
          y2={prop.to[1]}
          stroke={FLOOR}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={prop.dashed ? '5 5' : undefined}
        />
      );
    case 'arrow': {
      const [x1, y1] = prop.from;
      const [x2, y2] = prop.to;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const wing = 6;
      const a1: Point = [x2 - wing * Math.cos(angle - 0.5), y2 - wing * Math.sin(angle - 0.5)];
      const a2: Point = [x2 - wing * Math.cos(angle + 0.5), y2 - wing * Math.sin(angle + 0.5)];
      return (
        <g stroke={HINT} strokeWidth={2.5} strokeLinecap="round" fill="none">
          <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray="4 4" />
          <path d={`M${a1[0]} ${a1[1]} L${x2} ${y2} L${a2[0]} ${a2[1]}`} />
        </g>
      );
    }
    default:
      return null;
  }
}

/** Dibuja una postura completa. Sin estado ni identificadores: renderiza en servidor. */
export function PoseDrawing({ pose }: { pose: Pose }) {
  const [hx, hy] = pose.head;
  return (
    <g>
      {pose.props?.map((prop, index) => (
        <Gear key={`b${index}`} prop={prop} />
      ))}
      <Limb points={pose.armFar ?? []} color={FAR} />
      <Limb points={pose.legFar ?? []} color={FAR} />
      <Limb points={pose.spine} color={NEAR} width={TORSO} />
      <circle cx={hx} cy={hy} r={9} fill={NEAR} />
      <Limb points={pose.legNear ?? []} color={NEAR} />
      <Limb points={pose.armNear ?? []} color={NEAR} />
      {pose.propsFront?.map((prop, index) => (
        <Gear key={`f${index}`} prop={prop} />
      ))}
    </g>
  );
}
