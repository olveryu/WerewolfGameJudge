/** DrawGuess drawing canvas — thin wrapper over shared DrawingCanvas. */

import type React from 'react';

import { DrawingCanvas } from '@/features/drawing/components/DrawingCanvas';
import type {
  DrawingColor,
  DrawingElement,
  DrawingPoint,
  DrawingTool,
  DrawingWidth,
} from '@/features/drawing/model/drawing';

import {
  createDrawGuessElementPath,
  DRAWGUESS_CANVAS_BACKGROUND,
} from '../../services/drawGuessMediaApi';

interface DrawGuessDrawingCanvasProps {
  readonly elements: readonly DrawingElement[];
  readonly tool: DrawingTool;
  readonly color: DrawingColor;
  readonly strokeWidth: DrawingWidth;
  readonly isEnabled: boolean;
  readonly onElementChange: (element: DrawingElement) => void;
  readonly onElementComplete: (element: DrawingElement) => void;
  readonly onFill: (point: DrawingPoint) => void;
}

export const DrawGuessDrawingCanvas: React.FC<DrawGuessDrawingCanvasProps> = (props) => (
  <DrawingCanvas
    {...props}
    createElementPath={createDrawGuessElementPath}
    canvasBackground={DRAWGUESS_CANVAS_BACKGROUND}
    gameName="DrawGuess"
    testID="drawguess-drawing-canvas"
    accessibilityLabel="绘画画布"
  />
);
