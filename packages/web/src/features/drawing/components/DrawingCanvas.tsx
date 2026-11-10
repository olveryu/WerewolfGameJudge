/** Shared interactive 4:3 Canvas 2D surface for normalized freehand, shape, and fill operations. */

import './DrawingCanvas.css';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import type {
  DrawingColor,
  DrawingElement,
  DrawingPoint,
  DrawingTool,
  DrawingWidth,
} from '../model/drawing';
import type { DrawingPainter } from '../services/createDrawingRenderer';

const MIN_POINT_DISTANCE_SQUARED = 0.000_001;
const PRIMARY_MOUSE_BUTTON = 0;

export interface DrawingCanvasProps {
  readonly elements: readonly DrawingElement[];
  readonly tool: DrawingTool;
  readonly color: DrawingColor;
  readonly strokeWidth: DrawingWidth;
  readonly isEnabled: boolean;
  /** Called on every pointer step so an interrupted stroke can still be collected. */
  readonly onElementChange: (element: DrawingElement) => void;
  readonly onElementComplete: (element: DrawingElement) => void;
  readonly onFill: (point: DrawingPoint) => void;
  /** Game-owned painter bound to its canonical size and background. */
  readonly painter: DrawingPainter;
  readonly testId: string;
  readonly ariaLabel: string;
}

/**
 * The props a game's canvas wrapper forwards unchanged: everything except
 * the game-owned constants (painter, test id, label).
 */
export type DrawingCanvasGameProps = Omit<DrawingCanvasProps, 'painter' | 'testId' | 'ariaLabel'>;

interface BackingSize {
  readonly width: number;
  readonly height: number;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isDistinctPoint(previous: DrawingPoint | undefined, next: DrawingPoint): boolean {
  if (previous === undefined) return true;
  const deltaX = next.x - previous.x;
  const deltaY = next.y - previous.y;
  return deltaX * deltaX + deltaY * deltaY >= MIN_POINT_DISTANCE_SQUARED;
}

function readBackingSize(entry: ResizeObserverEntry): BackingSize {
  // WebKit lacks device-pixel boxes; the CSS box times the ratio is the closest backing size.
  const devicePixelSize =
    'devicePixelContentBoxSize' in entry ? entry.devicePixelContentBoxSize.at(0) : undefined;
  if (devicePixelSize !== undefined) {
    return { width: devicePixelSize.inlineSize, height: devicePixelSize.blockSize };
  }
  return {
    width: Math.round(entry.contentRect.width * window.devicePixelRatio),
    height: Math.round(entry.contentRect.height * window.devicePixelRatio),
  };
}

/** Size a canvas backing store and map canonical drawing coordinates onto it. */
function prepareContext(
  canvas: HTMLCanvasElement,
  size: BackingSize,
  painter: DrawingPainter,
): CanvasRenderingContext2D {
  if (canvas.width !== size.width) canvas.width = size.width;
  if (canvas.height !== size.height) canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('[FAIL-FAST] Drawing canvas 2D context is unavailable');
  }
  context.setTransform(size.width / painter.width, 0, 0, size.height / painter.height, 0, 0);
  return context;
}

function paintActiveElement(
  canvas: HTMLCanvasElement | null,
  size: BackingSize | null,
  painter: DrawingPainter,
  element: DrawingElement | null,
): void {
  if (canvas === null || size === null) return;
  const context = prepareContext(canvas, size, painter);
  context.clearRect(0, 0, painter.width, painter.height);
  if (element !== null) painter.paintElement(context, element);
}

/**
 * Committed elements paint on a base canvas only when they change; the stroke in progress paints
 * on an overlay so each pointer step redraws one element. Pointer capture keeps a stroke alive
 * when it leaves the canvas, and `touch-action: none` stops touch drags from scrolling the page.
 */
export function DrawingCanvas({
  elements,
  tool,
  color,
  strokeWidth,
  isEnabled,
  onElementChange,
  onElementComplete,
  onFill,
  painter,
  testId,
  ariaLabel,
}: DrawingCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [backingSize, setBackingSize] = useState<BackingSize | null>(null);
  const activePointerId = useRef<number | null>(null);
  const activeElement = useRef<DrawingElement | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries.at(-1);
      if (entry === undefined) return;
      const next = readBackingSize(entry);
      setBackingSize((previous) =>
        previous !== null && previous.width === next.width && previous.height === next.height
          ? previous
          : next,
      );
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = baseCanvasRef.current;
    if (canvas === null || backingSize === null) return;
    painter.paintDrawing(prepareContext(canvas, backingSize, painter), elements);
    // Resizing clears the overlay's backing store too, so repaint the stroke in progress.
    paintActiveElement(overlayCanvasRef.current, backingSize, painter, activeElement.current);
  }, [backingSize, elements, painter]);

  function normalizedPoint(event: ReactPointerEvent<HTMLCanvasElement>): DrawingPoint {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      throw new Error('[FAIL-FAST] Drawing canvas pointer arrived before layout');
    }
    return {
      x: clampUnit((event.clientX - bounds.left) / bounds.width),
      y: clampUnit((event.clientY - bounds.top) / bounds.height),
    };
  }

  function showActiveElement(element: DrawingElement | null): void {
    activeElement.current = element;
    paintActiveElement(overlayCanvasRef.current, backingSize, painter, element);
  }

  function endActiveElement(shouldComplete: boolean): void {
    const element = activeElement.current;
    activePointerId.current = null;
    showActiveElement(null);
    if (shouldComplete && element !== null) onElementComplete(element);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (!isEnabled || activePointerId.current !== null) return;
    if (event.pointerType === 'mouse' && event.button !== PRIMARY_MOUSE_BUTTON) return;
    event.preventDefault();
    const point = normalizedPoint(event);
    if (tool === 'fill') {
      onFill(point);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerId.current = event.pointerId;
    const id = crypto.randomUUID();
    const element: DrawingElement =
      tool === 'line' || tool === 'rectangle' || tool === 'ellipse'
        ? { id, kind: tool, color, width: strokeWidth, start: point, end: point }
        : { id, kind: tool, color, width: strokeWidth, points: [point] };
    showActiveElement(element);
    onElementChange(element);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (event.pointerId !== activePointerId.current) return;
    const current = activeElement.current;
    if (current === null || current.kind === 'fill') return;
    if (!isEnabled) {
      endActiveElement(false);
      return;
    }
    const point = normalizedPoint(event);
    let next: DrawingElement;
    if ('points' in current) {
      if (!isDistinctPoint(current.points.at(-1), point)) return;
      next = { ...current, points: [...current.points, point] };
    } else {
      next = { ...current, end: point };
    }
    showActiveElement(next);
    onElementChange(next);
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (event.pointerId !== activePointerId.current) return;
    endActiveElement(isEnabled);
  }

  return (
    <div ref={frameRef} className="drawing-canvas">
      <canvas ref={baseCanvasRef} className="drawing-canvas__layer" aria-hidden />
      <canvas
        ref={overlayCanvasRef}
        className="drawing-canvas__layer drawing-canvas__input"
        role="img"
        aria-label={ariaLabel}
        aria-disabled={!isEnabled}
        data-testid={testId}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
      />
    </div>
  );
}
