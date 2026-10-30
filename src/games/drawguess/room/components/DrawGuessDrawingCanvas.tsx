/** DrawGuess drawing canvas — thin wrapper over shared DrawingCanvas. */

import type React from 'react';

import {
  DrawingCanvas,
  type DrawingCanvasGameProps,
} from '@/features/drawing/components/DrawingCanvas';

import {
  createDrawGuessElementPath,
  DRAWGUESS_CANVAS_BACKGROUND,
} from '../../services/drawGuessMediaApi';

export const DrawGuessDrawingCanvas: React.FC<DrawingCanvasGameProps> = (props) => (
  <DrawingCanvas
    {...props}
    createElementPath={createDrawGuessElementPath}
    canvasBackground={DRAWGUESS_CANVAS_BACKGROUND}
    gameName="DrawGuess"
    testID="drawguess-drawing-canvas"
    accessibilityLabel="绘画画布"
  />
);
