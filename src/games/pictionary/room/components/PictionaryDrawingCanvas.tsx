/** Pictionary drawing canvas — thin wrapper over shared DrawingCanvas. */

import type React from 'react';

import { DrawingCanvas } from '@/features/drawing/components/DrawingCanvas';
import type {
  DrawingColor,
  DrawingElement,
  DrawingPoint,
  DrawingTool,
  DrawingWidth,
} from '@/features/drawing/model/drawing';
import { TESTIDS } from '@/testids';
import { PICTIONARY_CANVAS_BACKGROUND } from '@/theme';

import { createPictionaryElementPath } from '../../services/renderPictionaryDrawing';

interface PictionaryDrawingCanvasProps {
  readonly elements: readonly DrawingElement[];
  readonly tool: DrawingTool;
  readonly color: DrawingColor;
  readonly strokeWidth: DrawingWidth;
  readonly isEnabled: boolean;
  readonly onElementChange: (element: DrawingElement) => void;
  readonly onElementComplete: (element: DrawingElement) => void;
  readonly onFill: (point: DrawingPoint) => void;
}

export const PictionaryDrawingCanvas: React.FC<PictionaryDrawingCanvasProps> = (props) => (
  <DrawingCanvas
    {...props}
    createElementPath={createPictionaryElementPath}
    canvasBackground={PICTIONARY_CANVAS_BACKGROUND}
    gameName="Pictionary"
    testID={TESTIDS.pictionaryDrawingCanvas}
    accessibilityLabel="绘画画布"
  />
);
