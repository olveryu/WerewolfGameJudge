/** Render Pictionary elements and compute canonical connected-region fills. */

import {
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_MAX_BYTES,
  PICTIONARY_DRAWING_WIDTH,
} from '@game-judge/game-engine/games/pictionary/public';
import {
  AlphaType,
  ColorType,
  ImageFormat,
  PaintStyle,
  type SkCanvas,
  Skia,
  type SkPath,
  StrokeCap,
  StrokeJoin,
} from '@shopify/react-native-skia';

import { PICTIONARY_CANVAS_BACKGROUND } from '@/theme/colors';

import type {
  PictionaryDrawingColor,
  PictionaryDrawingElement,
  PictionaryDrawingFillElement,
  PictionaryDrawingPoint,
} from '../model/pictionaryDrawing';
import { createPictionaryFillRectangles } from './pictionaryFloodFill';

function createPictionaryStrokePath(
  points: readonly PictionaryDrawingPoint[],
  width: number,
  height: number,
): SkPath {
  const firstPoint = points[0];
  if (firstPoint === undefined) {
    throw new Error('[FAIL-FAST] Pictionary stroke requires at least one point');
  }
  const path = Skia.Path.Make();
  path.moveTo(firstPoint.x * width, firstPoint.y * height);
  if (points.length === 1) {
    path.lineTo(firstPoint.x * width + Number.EPSILON, firstPoint.y * height);
    return path;
  }
  for (const point of points.slice(1)) {
    path.lineTo(point.x * width, point.y * height);
  }
  return path;
}

function getShapeBounds(
  start: PictionaryDrawingPoint,
  end: PictionaryDrawingPoint,
  width: number,
  height: number,
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const startX = start.x * width;
  const startY = start.y * height;
  const endX = end.x * width;
  const endY = end.y * height;
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}

/** Build the path used by both the interactive canvas and final PNG export. */
export function createPictionaryElementPath(
  element: PictionaryDrawingElement,
  width: number,
  height: number,
): SkPath {
  switch (element.kind) {
    case 'brush':
    case 'eraser':
      return createPictionaryStrokePath(element.points, width, height);
    case 'line':
      return createPictionaryStrokePath([element.start, element.end], width, height);
    case 'rectangle': {
      const bounds = getShapeBounds(element.start, element.end, width, height);
      const path = Skia.Path.Make();
      path.addRect(Skia.XYWHRect(bounds.x, bounds.y, bounds.width, bounds.height));
      return path;
    }
    case 'ellipse': {
      const bounds = getShapeBounds(element.start, element.end, width, height);
      const path = Skia.Path.Make();
      path.addOval(Skia.XYWHRect(bounds.x, bounds.y, bounds.width, bounds.height));
      return path;
    }
    case 'fill': {
      const scaleX = width / PICTIONARY_DRAWING_WIDTH;
      const scaleY = height / PICTIONARY_DRAWING_HEIGHT;
      const path = Skia.Path.Make();
      for (const rectangle of element.rectangles) {
        path.addRect(
          Skia.XYWHRect(
            rectangle.x * scaleX,
            rectangle.y * scaleY,
            rectangle.width * scaleX,
            rectangle.height * scaleY,
          ),
        );
      }
      return path;
    }
  }
}

function drawPictionaryElements(
  canvas: SkCanvas,
  elements: readonly PictionaryDrawingElement[],
  width: number,
  height: number,
): void {
  canvas.drawColor(Skia.Color(PICTIONARY_CANVAS_BACKGROUND));
  const displayScale = width / PICTIONARY_DRAWING_WIDTH;
  for (const element of elements) {
    const paint = Skia.Paint();
    const isFill = element.kind === 'fill';
    paint.setAntiAlias(!isFill);
    paint.setStyle(isFill ? PaintStyle.Fill : PaintStyle.Stroke);
    paint.setColor(
      Skia.Color(element.kind === 'eraser' ? PICTIONARY_CANVAS_BACKGROUND : element.color),
    );
    if (!isFill) {
      paint.setStrokeCap(StrokeCap.Round);
      paint.setStrokeJoin(StrokeJoin.Round);
      paint.setStrokeWidth(element.width * displayScale);
    }
    canvas.drawPath(createPictionaryElementPath(element, width, height), paint);
  }
}

function renderCanonicalPixels(elements: readonly PictionaryDrawingElement[]): Uint8Array {
  const surface = Skia.Surface.MakeOffscreen(PICTIONARY_DRAWING_WIDTH, PICTIONARY_DRAWING_HEIGHT);
  if (surface === null) {
    throw new Error('无法创建填充计算画布');
  }
  try {
    drawPictionaryElements(
      surface.getCanvas(),
      elements,
      PICTIONARY_DRAWING_WIDTH,
      PICTIONARY_DRAWING_HEIGHT,
    );
    surface.flush();
    const image = surface.makeImageSnapshot();
    try {
      const pixels = image.readPixels(0, 0, {
        width: PICTIONARY_DRAWING_WIDTH,
        height: PICTIONARY_DRAWING_HEIGHT,
        alphaType: AlphaType.Unpremul,
        colorType: ColorType.RGBA_8888,
      });
      if (!(pixels instanceof Uint8Array)) {
        throw new Error('无法读取填充计算像素');
      }
      return pixels;
    } finally {
      image.dispose();
    }
  } finally {
    surface.dispose();
  }
}

function parseOpaqueHexColor(
  color: PictionaryDrawingColor,
): readonly [number, number, number, 255] {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return [red, green, blue, 255];
}

/** Create one undoable four-connected fill operation at canonical pixel precision. */
export function createPictionaryFillElement(
  elements: readonly PictionaryDrawingElement[],
  point: PictionaryDrawingPoint,
  color: PictionaryDrawingColor,
): PictionaryDrawingFillElement | null {
  const pixels = renderCanonicalPixels(elements);
  const seedX = Math.min(
    PICTIONARY_DRAWING_WIDTH - 1,
    Math.floor(point.x * PICTIONARY_DRAWING_WIDTH),
  );
  const seedY = Math.min(
    PICTIONARY_DRAWING_HEIGHT - 1,
    Math.floor(point.y * PICTIONARY_DRAWING_HEIGHT),
  );
  const seedIndex = seedY * PICTIONARY_DRAWING_WIDTH + seedX;
  const seedOffset = seedIndex * 4;
  const targetColor = [
    pixels[seedOffset]!,
    pixels[seedOffset + 1]!,
    pixels[seedOffset + 2]!,
    pixels[seedOffset + 3]!,
  ] as const;
  if (targetColor.every((channel, index) => channel === parseOpaqueHexColor(color)[index])) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    kind: 'fill',
    color,
    rectangles: createPictionaryFillRectangles(
      pixels,
      PICTIONARY_DRAWING_WIDTH,
      PICTIONARY_DRAWING_HEIGHT,
      seedIndex,
      targetColor,
    ),
  };
}

/**
 * Produce the immutable PNG body accepted by the Worker media route.
 *
 * @throws When Skia cannot allocate the offscreen surface or the PNG exceeds 2 MiB.
 */
export function renderPictionaryDrawing(elements: readonly PictionaryDrawingElement[]): Blob {
  if (elements.length === 0) {
    throw new Error('[FAIL-FAST] Cannot export an empty Pictionary drawing');
  }
  const surface = Skia.Surface.MakeOffscreen(PICTIONARY_DRAWING_WIDTH, PICTIONARY_DRAWING_HEIGHT);
  if (surface === null) {
    throw new Error('无法创建画作导出画布');
  }
  try {
    drawPictionaryElements(
      surface.getCanvas(),
      elements,
      PICTIONARY_DRAWING_WIDTH,
      PICTIONARY_DRAWING_HEIGHT,
    );
    surface.flush();
    const image = surface.makeImageSnapshot();
    try {
      const pngBytes = image.encodeToBytes(ImageFormat.PNG, 100);
      if (pngBytes.byteLength > PICTIONARY_DRAWING_MAX_BYTES) {
        throw new Error('画作超过 2 MiB，请撤销部分内容后重试');
      }
      const pngBuffer = new ArrayBuffer(pngBytes.byteLength);
      new Uint8Array(pngBuffer).set(pngBytes);
      return new Blob([pngBuffer], { type: 'image/png' });
    } finally {
      image.dispose();
    }
  } finally {
    surface.dispose();
  }
}
