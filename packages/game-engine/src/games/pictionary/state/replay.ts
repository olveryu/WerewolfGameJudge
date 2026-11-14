import { z } from 'zod';

/** Canonical drawing canvas size; fill rectangles are integer pixels inside it. */
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 768;
const MAX_ELEMENTS = 2000;
const MAX_POINTS_PER_STROKE = 4096;
const MAX_TOTAL_POINTS = 50000;
const MAX_TOTAL_RECTANGLES = 50000;

const point = z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const base = {
  id: z.string().min(1).max(256),
  color: z.custom<`#${string}`>(
    (value) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value),
  ),
  width: z.union([z.literal(5), z.literal(14), z.literal(30)]),
};
const rectangle = z
  .strictObject({
    x: z
      .int()
      .nonnegative()
      .max(CANVAS_WIDTH - 1),
    y: z
      .int()
      .nonnegative()
      .max(CANVAS_HEIGHT - 1),
    width: z.int().positive().max(CANVAS_WIDTH),
    height: z.int().positive().max(CANVAS_HEIGHT),
  })
  .refine(
    (value) => value.x + value.width <= CANVAS_WIDTH && value.y + value.height <= CANVAS_HEIGHT,
  );
const element = z.union([
  z.strictObject({
    ...base,
    kind: z.enum(['brush', 'eraser']),
    points: z.array(point).min(1).max(MAX_POINTS_PER_STROKE).readonly(),
  }),
  z.strictObject({
    ...base,
    kind: z.enum(['line', 'rectangle', 'ellipse']),
    start: point,
    end: point,
  }),
  z.strictObject({
    ...base,
    kind: z.literal('fill'),
    rectangles: z.array(rectangle).min(1).max(MAX_TOTAL_RECTANGLES).readonly(),
  }),
]);

/**
 * Stroke replay of one Pictionary drawing (version 1), uploaded beside the
 * authoritative PNG so clients can animate the reveal. Elements mirror the
 * web drawing model in paint order: brush/eraser strokes carry at least one
 * normalized (0..1) point, line/rectangle/ellipse shapes carry normalized
 * start and end points, and fills carry at least one integer rectangle on
 * the canonical 1024×768 canvas. Colors are six-digit hex, widths are 5, 14
 * or 30, and element ids are unique. At most 2000 elements, 4096 points per
 * stroke, 50 000 points and 50 000 fill rectangles in total.
 */
export const PICTIONARY_DRAWING_REPLAY_SCHEMA = z
  .strictObject({
    version: z.literal(1),
    elements: z.array(element).min(1).max(MAX_ELEMENTS).readonly(),
  })
  .refine(
    (replay) => new Set(replay.elements.map((item) => item.id)).size === replay.elements.length,
    {
      message: 'Replay element ids must be unique',
    },
  )
  .refine(
    (replay) => {
      let points = 0;
      let rectangles = 0;
      for (const item of replay.elements) {
        if ('points' in item) points += item.points.length;
        if ('rectangles' in item) rectangles += item.rectangles.length;
      }
      return points <= MAX_TOTAL_POINTS && rectangles <= MAX_TOTAL_RECTANGLES;
    },
    { message: 'Replay exceeds aggregate point or rectangle limits' },
  );

/** A validated Pictionary drawing replay; see {@link PICTIONARY_DRAWING_REPLAY_SCHEMA}. */
export type PictionaryDrawingReplay = z.infer<typeof PICTIONARY_DRAWING_REPLAY_SCHEMA>;

/** Reveal animation length of a replay: 400 ms per element within 2000–8000 ms. */
export function getPictionaryReplayDuration(replay: PictionaryDrawingReplay): number {
  return Math.min(8000, Math.max(2000, replay.elements.length * 400));
}
