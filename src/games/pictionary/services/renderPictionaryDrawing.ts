/** Bind Pictionary drawing specifications to shared rendering; media submission stays game-owned. */

import {
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_MAX_BYTES,
  PICTIONARY_DRAWING_WIDTH,
} from '@game-judge/game-engine/games/pictionary/public';

import { createDrawingRenderer } from '@/features/drawing/services/createDrawingRenderer';
import { PICTIONARY_CANVAS_BACKGROUND } from '@/theme/colors';

export const {
  createElementPath: createPictionaryElementPath,
  createFillElement: createPictionaryFillElement,
  renderDrawing: renderPictionaryDrawing,
} = createDrawingRenderer({
  width: PICTIONARY_DRAWING_WIDTH,
  height: PICTIONARY_DRAWING_HEIGHT,
  maxBytes: PICTIONARY_DRAWING_MAX_BYTES,
  backgroundColor: PICTIONARY_CANVAS_BACKGROUND,
  emptyDrawingMessage: '[FAIL-FAST] Cannot export an empty Pictionary drawing',
});
