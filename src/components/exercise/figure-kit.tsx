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

/**
 * El otro extremo del movimiento.
 *
 * Sólo hace falta declarar lo que se mueve: en un curl de bíceps cambia el
 * brazo y la mancuerna, y nada más. Lo que se omite se queda quieto.
 *
 * Cada miembro debe tener el mismo número de puntos que en la postura de
 * partida: la interpolación es punto a punto.
 */
export interface PoseFrame {
  head?: Point;
  spine?: Point[];
  armFar?: Point[];
  armNear?: Point[];
  legFar?: Point[];
  legNear?: Point[];
  /** Nueva posición de cada elemento de `propsFront`, en su mismo orden. */
  propsFront?: (Point | null)[];
  /** Ídem para el material de fondo (poleas, gomas), en el orden de `props`. */
  props?: (Point | null)[];
}

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
  /** Fin del recorrido. Sin esto la figura no se anima. */
  end?: PoseFrame;
  /** Duración de un ciclo completo en segundos (2,6 por defecto). */
  tempo?: number;
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

/*
 * La animación se hace con SMIL (`<animate>`), no con CSS ni JavaScript: va
 * dentro del propio SVG, no necesita hidratar nada y el navegador la interpola
 * en el compositor. Un ciclo de ida y vuelta cuesta unos 400 bytes de marcado.
 *
 * `keySplines` da una curva suave en los extremos, que es como se mueve un
 * cuerpo de verdad: frena al final del recorrido en vez de rebotar.
 */
const EASE = '0.42 0 0.58 1';

function Limb({
  points,
  color,
  width = LIMB,
  to,
  tempo,
}: {
  points: Point[];
  color: string;
  width?: number;
  /** Mismo miembro al final del recorrido. Si falta, no se anima. */
  to?: Point[];
  tempo: number;
}) {
  if (points.length < 2) return null;
  // Sólo se interpola punto a punto: distinto número de puntos no es animable.
  const animates = to && to.length === points.length;
  return (
    <path
      d={path(points)}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {animates ? (
        <animate
          attributeName="d"
          values={`${path(points)};${path(to)};${path(points)}`}
          keyTimes="0;0.5;1"
          calcMode="spline"
          keySplines={`${EASE};${EASE}`}
          dur={`${tempo}s`}
          repeatCount="indefinite"
        />
      ) : null}
    </path>
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

function Gear({ prop, pullTo, tempo }: { prop: Prop; pullTo?: Point; tempo?: number }): ReactNode {
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
      const cycle =
        pullTo && tempo
          ? {
              keyTimes: '0;0.5;1',
              calcMode: 'spline' as const,
              keySplines: `${EASE};${EASE}`,
              dur: `${tempo}s`,
              repeatCount: 'indefinite' as const,
            }
          : null;
      return (
        <g>
          {prop.tower === false ? null : (
            <rect x={x1 - 9} y={y1 - 4} width={18} height={Math.max(10, 126 - y1)} rx={3} fill={FLOOR} />
          )}
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={GEAR} strokeWidth={2.5} strokeLinecap="round">
            {cycle ? <animate attributeName="x2" values={`${x2};${pullTo![0]};${x2}`} {...cycle} /> : null}
            {cycle ? <animate attributeName="y2" values={`${y2};${pullTo![1]};${y2}`} {...cycle} /> : null}
          </line>
          <circle cx={x2} cy={y2} r={4} fill={GEAR}>
            {cycle ? <animate attributeName="cx" values={`${x2};${pullTo![0]};${x2}`} {...cycle} /> : null}
            {cycle ? <animate attributeName="cy" values={`${y2};${pullTo![1]};${y2}`} {...cycle} /> : null}
          </circle>
        </g>
      );
    }
    case 'band': {
      const stretched = pullTo ? bandPath(prop.from, pullTo) : null;
      return (
        <path d={bandPath(prop.from, prop.to)} fill="none" stroke={GEAR} strokeWidth={3} strokeLinecap="round">
          {stretched && tempo ? (
            <animate
              attributeName="d"
              values={`${bandPath(prop.from, prop.to)};${stretched};${bandPath(prop.from, prop.to)}`}
              keyTimes="0;0.5;1"
              calcMode="spline"
              keySplines={`${EASE};${EASE}`}
              dur={`${tempo}s`}
              repeatCount="indefinite"
            />
          ) : null}
        </path>
      );
    }
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

/**
 * Punto de anclaje de un elemento de material, para poder desplazarlo.
 *
 * `ground` también tiene `to`, pero es una coordenada suelta, no un punto: por
 * eso se decide por el tipo y no por la presencia del campo.
 */
function anchorOf(prop: Prop): Point | null {
  switch (prop.kind) {
    case 'barbell':
    case 'dumbbell':
    case 'bench':
    case 'box':
    case 'rig':
    case 'cone':
    case 'wheel':
      return prop.at;
    case 'cable':
    case 'band':
      return prop.to;
    default:
      return null;
  }
}

/**
 * Material que acompaña al movimiento (la barra, la mancuerna, el agarre de la
 * polea). Se mueve con un `translate` en lugar de redibujarlo: es un solo
 * `<animateTransform>` para todo el conjunto de trazos que lo forman.
 */
function MovingGear({ prop, to, tempo }: { prop: Prop; to: Point | null; tempo: number }) {
  const from = anchorOf(prop);
  if (!to || !from) return <Gear prop={prop} />;

  /*
   * Un cable y una goma no se desplazan: se estiran. Su extremo fijo (la torre,
   * el anclaje) se queda donde está y sólo se mueve el agarre, así que se
   * animan los extremos del trazo en vez de trasladar el conjunto.
   */
  if (prop.kind === 'cable' || prop.kind === 'band') {
    return <Gear prop={prop} pullTo={to} tempo={tempo} />;
  }

  const dx = Math.round((to[0] - from[0]) * 100) / 100;
  const dy = Math.round((to[1] - from[1]) * 100) / 100;
  if (dx === 0 && dy === 0) return <Gear prop={prop} />;
  return (
    <g>
      <Gear prop={prop} />
      <animateTransform
        attributeName="transform"
        type="translate"
        values={`0 0;${dx} ${dy};0 0`}
        keyTimes="0;0.5;1"
        calcMode="spline"
        keySplines={`${EASE};${EASE}`}
        dur={`${tempo}s`}
        repeatCount="indefinite"
      />
    </g>
  );
}

/**
 * Dibuja una postura completa.
 *
 * Sin estado ni identificadores generados: se renderiza en el servidor. Con
 * `animated` y una postura que declare su `end`, la figura recorre el
 * movimiento de ida y vuelta.
 */
export function PoseDrawing({ pose, animated = false }: { pose: Pose; animated?: boolean }) {
  const [hx, hy] = pose.head;
  const end = animated ? pose.end : undefined;
  const tempo = pose.tempo ?? 2.6;
  const headTo = end?.head;

  return (
    <g>
      {pose.props?.map((prop, index) => (
        <MovingGear key={`b${index}`} prop={prop} to={end?.props?.[index] ?? null} tempo={tempo} />
      ))}
      <Limb points={pose.armFar ?? []} color={FAR} to={end?.armFar} tempo={tempo} />
      <Limb points={pose.legFar ?? []} color={FAR} to={end?.legFar} tempo={tempo} />
      <Limb points={pose.spine} color={NEAR} width={TORSO} to={end?.spine} tempo={tempo} />
      <circle cx={hx} cy={hy} r={9} fill={NEAR}>
        {headTo ? (
          <>
            <animate
              attributeName="cx"
              values={`${hx};${headTo[0]};${hx}`}
              keyTimes="0;0.5;1"
              calcMode="spline"
              keySplines={`${EASE};${EASE}`}
              dur={`${tempo}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values={`${hy};${headTo[1]};${hy}`}
              keyTimes="0;0.5;1"
              calcMode="spline"
              keySplines={`${EASE};${EASE}`}
              dur={`${tempo}s`}
              repeatCount="indefinite"
            />
          </>
        ) : null}
      </circle>
      <Limb points={pose.legNear ?? []} color={NEAR} to={end?.legNear} tempo={tempo} />
      <Limb points={pose.armNear ?? []} color={NEAR} to={end?.armNear} tempo={tempo} />
      {pose.propsFront?.map((prop, index) => (
        <MovingGear key={`f${index}`} prop={prop} to={end?.propsFront?.[index] ?? null} tempo={tempo} />
      ))}
    </g>
  );
}
