/** Bind DrawGuess drawing specifications to shared rendering; transport and stroke sync stay game-owned. */

import { createDrawingRenderer } from '@/features/drawing/services/createDrawingRenderer';
import { PICTIONARY_CANVAS_BACKGROUND as DRAWGUESS_CANVAS_BACKGROUND } from '@/theme/colors';

export { DRAWGUESS_CANVAS_BACKGROUND };

const DRAWGUESS_EXPORT_WIDTH = 1024;
const DRAWGUESS_EXPORT_HEIGHT = 768;
const DRAWGUESS_EXPORT_MAX_BYTES = 2 * 1024 * 1024;

export const {
  createElementPath: createDrawGuessElementPath,
  createFillElement: createDrawGuessFillElement,
  renderDrawing: renderDrawGuessDrawing,
} = createDrawingRenderer({
  width: DRAWGUESS_EXPORT_WIDTH,
  height: DRAWGUESS_EXPORT_HEIGHT,
  maxBytes: DRAWGUESS_EXPORT_MAX_BYTES,
  backgroundColor: DRAWGUESS_CANVAS_BACKGROUND,
  emptyDrawingMessage: '[FAIL-FAST] Cannot export an empty DrawGuess drawing',
});
