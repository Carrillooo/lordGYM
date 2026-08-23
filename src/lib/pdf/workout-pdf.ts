import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ExerciseCategory } from '@/types/db';
import { poseFor } from '@/components/exercise/poses';
import type { Point, Prop } from '@/components/exercise/figure-kit';

/**
 * Genera el PDF imprimible de un entrenamiento.
 *
 * Está pensado para llevarlo en papel al gimnasio: las series salen con su
 * objetivo y con casillas en blanco para apuntar a mano lo que se ha hecho. Si
 * la sesión ya está cerrada, en vez de casillas van los datos reales.
 *
 * Las ilustraciones se dibujan con las mismas coordenadas que usa la pantalla
 * (`components/exercise/poses.ts`), así que el papel y la aplicación enseñan
 * exactamente lo mismo. En papel se invierten los tonos: fondo blanco y trazo
 * oscuro, que es lo que se imprime bien y no gasta un cartucho por hoja.
 */

export interface PdfSet {
  label: string;
  /** Objetivo ya formateado: «6 x 60 kg», «30 s», «400 m»… */
  target: string;
  restSeconds: number | null;
  /** Resultado real, sólo en sesiones cerradas. */
  actual?: string | null;
  actualRpe?: number | null;
}

export interface PdfExercise {
  name: string;
  figureKey: string | null;
  category: ExerciseCategory;
  technique: string | null;
  notes: string | null;
  sets: PdfSet[];
}

export interface WorkoutPdfInput {
  title: string;
  /** Línea de contexto: entrenador, jugador, fecha. */
  meta: string[];
  /** Etiquetas cortas: objetivo, nivel, duración. */
  tags: string[];
  notes: string | null;
  exercises: PdfExercise[];
  /** `true` en sesiones cerradas: se imprimen los resultados en vez de casillas. */
  withResults: boolean;
}

/* -------------------------------------------------------------------------- */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 42;
const CONTENT = A4.width - MARGIN * 2;

const INK = rgb(0.07, 0.08, 0.1);
const MUTED = rgb(0.42, 0.45, 0.5);
const HAIRLINE = rgb(0.85, 0.86, 0.88);
const BOX = rgb(0.62, 0.64, 0.68);
const ACCENT = rgb(0.44, 0.62, 0.05);
const LIMB_NEAR = rgb(0.16, 0.18, 0.22);
const LIMB_FAR = rgb(0.63, 0.65, 0.69);
const GEAR = rgb(0.05, 0.06, 0.08);
const FLOOR = rgb(0.72, 0.74, 0.77);

type Color = ReturnType<typeof rgb>;

const DOT = '·';

/**
 * Las fuentes estándar de PDF usan WinAnsi, que no tiene comillas tipográficas
 * ni rayas largas. Se sustituyen para que no reviente al escribir.
 */
function safe(text: string): string {
  return text
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[→⇒]/g, '->')
    .replace(/[   ]/g, ' ')
    .replace(/[«»]/g, '"')
    // Cualquier otro carácter fuera de Latin-1 se descarta antes que fallar.
    .replace(/[^ -ÿ]/g, '');
}

/** Parte un texto en líneas que caben en `maxWidth`. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* --------------------------- Ilustración ---------------------------------- */

interface FigureBox {
  x: number;
  /** Borde superior en coordenadas de PDF (y hacia arriba). */
  top: number;
  width: number;
}

function drawProp(page: PDFPage, prop: Prop, to: (p: Point) => Point, k: number): void {
  const line = (a: Point, b: Point, thickness: number, color: Color = FLOOR, dashed = false) => {
    const [x1, y1] = to(a);
    const [x2, y2] = to(b);
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: thickness * k,
      color,
      lineCap: 1,
      dashArray: dashed ? [3 * k, 3 * k] : undefined,
    });
  };
  const rect = (at: Point, w: number, h: number, color: Color = FLOOR) => {
    const [x, y] = to([at[0], at[1] + h]);
    page.drawRectangle({ x, y, width: w * k, height: h * k, color });
  };

  switch (prop.kind) {
    case 'ground':
      line([prop.from ?? 14, prop.y ?? 126], [prop.to ?? 186, prop.y ?? 126], 3);
      break;
    case 'barbell': {
      const half = (prop.width ?? 52) / 2;
      const [x, y] = prop.at;
      line([x - half, y], [x + half, y], 4, GEAR);
      rect([x - half - 3, y - 11], 6, 22, GEAR);
      rect([x + half - 3, y - 11], 6, 22, GEAR);
      break;
    }
    case 'dumbbell': {
      const [x, y] = prop.at;
      const vertical = (prop.angle ?? 0) >= 45;
      if (vertical) {
        line([x, y - 8], [x, y + 8], 3.5, GEAR);
        rect([x - 7, y - 12], 14, 5.5, GEAR);
        rect([x - 7, y + 6.5], 14, 5.5, GEAR);
      } else {
        line([x - 8, y], [x + 8, y], 3.5, GEAR);
        rect([x - 12, y - 7], 5.5, 14, GEAR);
        rect([x + 6.5, y - 7], 5.5, 14, GEAR);
      }
      break;
    }
    case 'bench': {
      const half = (prop.width ?? 92) / 2;
      rect([prop.at[0] - half, prop.at[1]], half * 2, 7);
      break;
    }
    case 'box':
      rect([prop.at[0] - (prop.width ?? 44) / 2, prop.at[1]], prop.width ?? 44, prop.height ?? 30);
      break;
    case 'rig': {
      const half = (prop.width ?? 62) / 2;
      const [x, y] = prop.at;
      const drop = prop.drop ?? 26;
      line([x - half, y], [x + half, y], 4);
      line([x - half, y], [x - half, y - drop], 4);
      line([x + half, y], [x + half, y - drop], 4);
      break;
    }
    case 'cable': {
      if (prop.tower !== false) {
        rect([prop.from[0] - 9, prop.from[1] - 4], 18, Math.max(10, 126 - prop.from[1]));
      }
      line(prop.from, prop.to, 2.5, GEAR);
      break;
    }
    case 'band':
      line(prop.from, prop.to, 3, GEAR);
      break;
    case 'cone': {
      const [x, y] = prop.at;
      line([x, y - 14], [x, y], 6, GEAR);
      break;
    }
    case 'wheel': {
      const [cx, cy] = to(prop.at);
      page.drawCircle({ x: cx, y: cy, size: (prop.r ?? 14) * k, borderColor: FLOOR, borderWidth: 4 * k });
      break;
    }
    case 'line':
      line(prop.from, prop.to, 4, FLOOR, prop.dashed);
      break;
    case 'arrow':
      // En papel las flechas de ayuda sobran: restan legibilidad y gastan tinta.
      break;
    default:
      break;
  }
}

function drawFigure(page: PDFPage, figureKey: string | null, category: ExerciseCategory, box: FigureBox): void {
  const pose = poseFor(figureKey, category);
  const k = box.width / 200;
  const to = ([x, y]: Point): Point => [box.x + x * k, box.top - y * k];
  const limb = (points: readonly Point[] | undefined, color: Color) => {
    if (!points || points.length < 2) return;
    for (let i = 0; i < points.length - 1; i += 1) {
      const [x1, y1] = to(points[i]);
      const [x2, y2] = to(points[i + 1]);
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 6 * k, color, lineCap: 1 });
    }
  };

  for (const prop of pose.props ?? []) drawProp(page, prop, to, k);
  limb(pose.armFar, LIMB_FAR);
  limb(pose.legFar, LIMB_FAR);
  limb(pose.spine, LIMB_NEAR);
  const [hx, hy] = to(pose.head);
  page.drawCircle({ x: hx, y: hy, size: 9 * k, color: LIMB_NEAR });
  limb(pose.legNear, LIMB_NEAR);
  limb(pose.armNear, LIMB_NEAR);
  for (const prop of pose.propsFront ?? []) drawProp(page, prop, to, k);
}

/* ------------------------------ Documento --------------------------------- */

export async function buildWorkoutPdf(input: WorkoutPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(safe(input.title));
  pdf.setCreator('LORDGYM');
  pdf.setProducer('LORDGYM');

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([A4.width, A4.height]);
  let y = A4.height - MARGIN;
  let pageNumber = 1;

  const text = (value: string, options: { x?: number; size?: number; font?: PDFFont; color?: Color }) => {
    page.drawText(safe(value), {
      x: options.x ?? MARGIN,
      y,
      size: options.size ?? 10,
      font: options.font ?? regular,
      color: options.color ?? INK,
    });
  };

  function footer() {
    page.drawText(safe(`LORDGYM  ${DOT}  Entrena. Progresa. Domina.`), {
      x: MARGIN,
      y: MARGIN - 18,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
    const label = String(pageNumber);
    page.drawText(label, {
      x: A4.width - MARGIN - regular.widthOfTextAtSize(label, 7.5),
      y: MARGIN - 18,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
  }

  function newPage() {
    footer();
    page = pdf.addPage([A4.width, A4.height]);
    pageNumber += 1;
    y = A4.height - MARGIN;
  }

  /** Reserva `needed` puntos; si no caben, salta de página. */
  function reserve(needed: number) {
    if (y - needed < MARGIN + 10) newPage();
  }

  // --- Cabecera ------------------------------------------------------------
  page.drawRectangle({ x: MARGIN, y: y - 4, width: 26, height: 3, color: ACCENT });
  y -= 22;
  text('LORDGYM', { size: 11, font: bold });
  y -= 26;
  text(input.title.toUpperCase(), { size: 21, font: bold });
  y -= 16;
  if (input.meta.length > 0) {
    text(input.meta.join(`  ${DOT}  `), { size: 9.5, color: MUTED });
    y -= 14;
  }
  if (input.tags.length > 0) {
    text(input.tags.join(`  ${DOT}  `), { size: 9, color: MUTED });
    y -= 14;
  }
  y -= 4;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: A4.width - MARGIN, y }, thickness: 0.8, color: HAIRLINE });
  y -= 20;

  if (input.notes) {
    for (const line of wrap(input.notes, regular, 9.5, CONTENT)) {
      reserve(14);
      text(line, { size: 9.5, color: MUTED });
      y -= 13;
    }
    y -= 8;
  }

  // --- Ejercicios ----------------------------------------------------------
  const FIG_W = 108;
  const FIG_H = FIG_W * 0.7;
  const ROW_H = 19;

  const cols = input.withResults
    ? [
        { label: 'Serie', width: 54 },
        { label: 'Objetivo', width: 152 },
        { label: 'Realizado', width: 152 },
        { label: 'RPE', width: 50 },
        { label: 'Descanso', width: 103 },
      ]
    : [
        { label: 'Serie', width: 54 },
        { label: 'Objetivo', width: 152 },
        { label: 'Kg', width: 76 },
        { label: 'Reps', width: 76 },
        { label: 'RPE', width: 50 },
        { label: 'Descanso', width: 103 },
      ];

  for (const [index, exercise] of input.exercises.entries()) {
    const techniqueLines = exercise.technique
      ? wrap(exercise.technique, regular, 8.5, CONTENT - FIG_W - 16)
      : [];
    const noteLines = exercise.notes ? wrap(exercise.notes, regular, 8.5, CONTENT - FIG_W - 16) : [];
    const headHeight = Math.max(FIG_H, 27 + (noteLines.length + techniqueLines.length) * 11);
    reserve(headHeight + 14 + ROW_H * (exercise.sets.length + 1) + 26);

    const blockTop = y;
    drawFigure(page, exercise.figureKey, exercise.category, { x: MARGIN, top: blockTop, width: FIG_W });

    const textX = MARGIN + FIG_W + 16;
    y = blockTop - 12;
    text(`${index + 1}. ${exercise.name}`, { x: textX, size: 13, font: bold });
    y -= 15;
    for (const line of noteLines) {
      text(line, { x: textX, size: 8.5, color: INK });
      y -= 11;
    }
    if (noteLines.length > 0) y -= 2;
    for (const line of techniqueLines) {
      text(line, { x: textX, size: 8.5, color: MUTED });
      y -= 11;
    }

    y = Math.min(y, blockTop - FIG_H) - 12;

    // Cabecera de la tabla de series.
    let x = MARGIN;
    for (const col of cols) {
      page.drawText(safe(col.label.toUpperCase()), { x: x + 4, y: y - 9, size: 7, font: bold, color: MUTED });
      x += col.width;
    }
    y -= 13;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: A4.width - MARGIN, y }, thickness: 0.8, color: HAIRLINE });

    for (const set of exercise.sets) {
      y -= ROW_H;
      const rest = set.restSeconds ? `${set.restSeconds}s` : '-';
      const values: (string | null)[] = input.withResults
        ? [
            set.label,
            set.target,
            set.actual ?? '-',
            set.actualRpe === null || set.actualRpe === undefined ? '-' : String(set.actualRpe),
            rest,
          ]
        : [set.label, set.target, null, null, null, rest];

      let cx = MARGIN;
      values.forEach((value, i) => {
        const col = cols[i];
        if (value === null) {
          // Casilla en blanco para rellenar a mano.
          page.drawRectangle({
            x: cx + 4,
            y: y + 1,
            width: col.width - 12,
            height: 13,
            borderColor: BOX,
            borderWidth: 0.7,
          });
        } else {
          page.drawText(safe(value), {
            x: cx + 4,
            y: y + 4,
            size: 9,
            font: i === 0 ? bold : regular,
            color: INK,
          });
        }
        cx += col.width;
      });
      page.drawLine({
        start: { x: MARGIN, y: y - 3 },
        end: { x: A4.width - MARGIN, y: y - 3 },
        thickness: 0.4,
        color: HAIRLINE,
      });
    }
    y -= 26;
  }

  footer();
  return pdf.save();
}
