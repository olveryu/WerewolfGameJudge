/** Paint completed strokes once and reveal only the active stroke on each animation frame. */

import './DrawingReplayCanvas.css';

import { useEffect, useRef } from 'react';

import type { DrawingElement } from '../model/drawing';
import type { DrawingPainter } from '../services/createDrawingRenderer';
import { createDrawingReplayTimeline, getDrawingReplayFrame } from '../services/drawingReplay';

function createReplaySurface(
  canvas: HTMLCanvasElement,
  elements: readonly DrawingElement[],
  painter: DrawingPainter,
) {
  const context = canvas.getContext('2d');
  const completed = document.createElement('canvas');
  completed.width = painter.width;
  completed.height = painter.height;
  const completedContext = completed.getContext('2d');
  if (context === null || completedContext === null)
    throw new Error('Canvas 2D is unavailable for drawing replay');
  const timeline = createDrawingReplayTimeline(elements, painter.width, painter.height);
  painter.paintDrawing(completedContext, []);
  let paintedCount = 0;
  return {
    paint(progress: number) {
      const frame = getDrawingReplayFrame(timeline, progress);
      if (frame.completedCount < paintedCount) {
        painter.paintDrawing(completedContext, []);
        paintedCount = 0;
      }
      while (paintedCount < frame.completedCount) {
        painter.paintElement(completedContext, elements[paintedCount]!);
        paintedCount += 1;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(completed, 0, 0);
      if (frame.current === null || frame.elementProgress <= 0) return;
      const { element, pathLength } = frame.current;
      if (element.kind === 'fill') return;
      context.save();
      const length = Math.max(0.01, pathLength);
      context.setLineDash([length, length]);
      context.lineDashOffset = length * (1 - frame.elementProgress);
      painter.paintElement(context, element);
      context.restore();
    },
    dispose() {
      completed.width = 0;
      completed.height = 0;
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

/** Canvas is intentionally non-interactive until the full PNG replaces it after playback. */
export function DrawingReplayCanvas({
  elements,
  painter,
  progress,
  label,
  onUnavailable,
}: {
  readonly elements: readonly DrawingElement[];
  readonly painter: DrawingPainter;
  readonly progress: number;
  readonly label: string;
  readonly onUnavailable: (error: unknown) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<ReturnType<typeof createReplaySurface> | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) throw new Error('Drawing replay canvas is missing');
    canvas.width = painter.width;
    canvas.height = painter.height;
    try {
      surfaceRef.current = createReplaySurface(canvas, elements, painter);
    } catch (error: unknown) {
      onUnavailable(error);
    }
    return () => {
      surfaceRef.current?.dispose();
      surfaceRef.current = null;
    };
  }, [elements, onUnavailable, painter]);
  useEffect(() => {
    try {
      surfaceRef.current?.paint(progress);
    } catch (error: unknown) {
      onUnavailable(error);
    }
  }, [elements, onUnavailable, painter, progress]);
  return <canvas ref={canvasRef} className="drawing-replay-canvas" role="img" aria-label={label} />;
}
