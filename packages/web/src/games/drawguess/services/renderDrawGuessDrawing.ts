/** Bind DrawGuess drawing specifications to shared rendering; transport and stroke sync stay game-owned. */

import { DRAWING_CANVAS_BACKGROUND } from '@/features/drawing/model/drawing';
import { createDrawingRenderer } from '@/features/drawing/services/createDrawingRenderer';

/** The fixed V1 drawing upload spec the media route enforces: a 1024×768 PNG of at most 2 MiB. */
const DRAWGUESS_EXPORT_WIDTH = 1024;
const DRAWGUESS_EXPORT_HEIGHT = 768;
const DRAWGUESS_EXPORT_MAX_BYTES = 2 * 1024 * 1024;

export const {
  painter: drawGuessDrawingPainter,
  createFillElement: createDrawGuessFillElement,
  renderDrawing: renderDrawGuessDrawing,
} = createDrawingRenderer({
  width: DRAWGUESS_EXPORT_WIDTH,
  height: DRAWGUESS_EXPORT_HEIGHT,
  maxBytes: DRAWGUESS_EXPORT_MAX_BYTES,
  backgroundColor: DRAWING_CANVAS_BACKGROUND,
  emptyDrawingMessage: '[FAIL-FAST] Cannot export an empty DrawGuess drawing',
});
