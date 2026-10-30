/** Pictionary drawing canvas — thin wrapper over shared DrawingCanvas. */

import type React from 'react';

import {
  DrawingCanvas,
  type DrawingCanvasGameProps,
} from '@/features/drawing/components/DrawingCanvas';
import { TESTIDS } from '@/testids';
import { PICTIONARY_CANVAS_BACKGROUND } from '@/theme';

import { createPictionaryElementPath } from '../../services/renderPictionaryDrawing';

export const PictionaryDrawingCanvas: React.FC<DrawingCanvasGameProps> = (props) => (
  <DrawingCanvas
    {...props}
    createElementPath={createPictionaryElementPath}
    canvasBackground={PICTIONARY_CANVAS_BACKGROUND}
    gameName="Pictionary"
    testID={TESTIDS.pictionaryDrawingCanvas}
    accessibilityLabel="绘画画布"
  />
);
