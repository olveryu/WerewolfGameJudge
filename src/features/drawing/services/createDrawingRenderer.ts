/** Shared Skia drawing, connected-region fill and PNG export; games own render specifications. */

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

import {
  type DrawingColor,
  type DrawingElement,
  type DrawingFillElement,
  type DrawingPoint,
  FILL_STROKE_WIDTH,
} from '../model/drawing';
import { createFillRectangles } from './floodFill';
import { createStrokePath } from './strokePath';

interface DrawingRenderConfig {
  readonly width: number;
  readonly height: number;
  readonly maxBytes: number;
  readonly backgroundColor: string;
  readonly emptyDrawingMessage: string;
}

function getShapeBounds(start: DrawingPoint, end: DrawingPoint, width: number, height: number) {
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

function createElementPath(
  config: DrawingRenderConfig,
  element: DrawingElement,
  width: number,
  height: number,
): SkPath {
  switch (element.kind) {
    case 'brush':
    case 'eraser':
      return createStrokePath(element.points, width, height);
    case 'line':
      return createStrokePath([element.start, element.end], width, height);
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
      const scaleX = width / config.width;
      const scaleY = height / config.height;
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

function drawElements(
  config: DrawingRenderConfig,
  canvas: SkCanvas,
  elements: readonly DrawingElement[],
): void {
  canvas.drawColor(Skia.Color(config.backgroundColor));
  for (const element of elements) {
    const paint = Skia.Paint();
    const isFill = element.kind === 'fill';
    paint.setAntiAlias(!isFill);
    paint.setStyle(isFill ? PaintStyle.Fill : PaintStyle.Stroke);
    paint.setColor(Skia.Color(element.kind === 'eraser' ? config.backgroundColor : element.color));
    if (!isFill) {
      paint.setStrokeCap(StrokeCap.Round);
      paint.setStrokeJoin(StrokeJoin.Round);
      paint.setStrokeWidth(element.width);
    }
    canvas.drawPath(createElementPath(config, element, config.width, config.height), paint);
  }
}

function renderCanonicalPixels(
  config: DrawingRenderConfig,
  elements: readonly DrawingElement[],
): Uint8Array {
  const surface = Skia.Surface.MakeOffscreen(config.width, config.height);
  if (surface === null) {
    throw new Error('无法创建填充计算画布');
  }
  try {
    drawElements(config, surface.getCanvas(), elements);
    surface.flush();
    const image = surface.makeImageSnapshot();
    try {
      const pixels = image.readPixels(0, 0, {
        width: config.width,
        height: config.height,
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

function parseOpaqueHexColor(color: DrawingColor): readonly [number, number, number, 255] {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
    255,
  ];
}

function createFillElement(
  config: DrawingRenderConfig,
  elements: readonly DrawingElement[],
  point: DrawingPoint,
  color: DrawingColor,
): DrawingFillElement | null {
  const pixels = renderCanonicalPixels(config, elements);
  const seedX = Math.min(config.width - 1, Math.floor(point.x * config.width));
  const seedY = Math.min(config.height - 1, Math.floor(point.y * config.height));
  const seedIndex = seedY * config.width + seedX;
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
    width: FILL_STROKE_WIDTH,
    rectangles: createFillRectangles(pixels, config.width, config.height, seedIndex, targetColor),
  };
}

function renderDrawing(config: DrawingRenderConfig, elements: readonly DrawingElement[]): Blob {
  if (elements.length === 0) {
    throw new Error(config.emptyDrawingMessage);
  }
  const surface = Skia.Surface.MakeOffscreen(config.width, config.height);
  if (surface === null) {
    throw new Error('无法创建画作导出画布');
  }
  try {
    drawElements(config, surface.getCanvas(), elements);
    surface.flush();
    const image = surface.makeImageSnapshot();
    try {
      const pngBytes = image.encodeToBytes(ImageFormat.PNG, 100);
      if (pngBytes.byteLength > config.maxBytes) {
        throw new Error(`画作超过 ${config.maxBytes / 1024 ** 2} MiB，请撤销部分内容后重试`);
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

/**
 * Binds game-owned specifications to shared canvas paths, fills and PNG export.
 * @throws Returned operations reject malformed strokes, allocation/read failures or oversized PNGs.
 */
export function createDrawingRenderer(config: DrawingRenderConfig) {
  return {
    createElementPath: (element: DrawingElement, width: number, height: number) =>
      createElementPath(config, element, width, height),
    createFillElement: (
      elements: readonly DrawingElement[],
      point: DrawingPoint,
      color: DrawingColor,
    ) => createFillElement(config, elements, point, color),
    renderDrawing: (elements: readonly DrawingElement[]) => renderDrawing(config, elements),
  };
}
