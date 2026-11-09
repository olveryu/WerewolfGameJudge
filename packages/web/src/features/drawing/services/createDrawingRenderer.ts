/** Shared Canvas 2D drawing, connected-region fill and PNG export; games own render specifications. */

import {
  type DrawingColor,
  type DrawingElement,
  type DrawingFillElement,
  type DrawingPoint,
  FILL_STROKE_WIDTH,
} from '../model/drawing';
import { createFillRectangles, type PixelColor } from './floodFill';
import { createStrokePath } from './strokePath';

const PNG_CONTENT_TYPE = 'image/png';

interface DrawingRenderConfig {
  /** Canonical export width in pixels; every element is painted in this coordinate space. */
  readonly width: number;
  readonly height: number;
  readonly maxBytes: number;
  readonly backgroundColor: string;
  readonly emptyDrawingMessage: string;
}

/**
 * Paints drawings in canonical coordinates. Callers scale the context to their backing store, so
 * the interactive canvas and the exported PNG rasterize the same geometry and stroke widths.
 */
export interface DrawingPainter {
  readonly width: number;
  readonly height: number;
  /** Paint the background and every element. */
  readonly paintDrawing: (
    context: CanvasRenderingContext2D,
    elements: readonly DrawingElement[],
  ) => void;
  /** Paint one element over whatever is already on the context. */
  readonly paintElement: (context: CanvasRenderingContext2D, element: DrawingElement) => void;
}

interface CanonicalSurface {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
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

function createElementPath(config: DrawingRenderConfig, element: DrawingElement): Path2D {
  const { width, height } = config;
  switch (element.kind) {
    case 'brush':
    case 'eraser':
      return createStrokePath(element.points, width, height);
    case 'line':
      return createStrokePath([element.start, element.end], width, height);
    case 'rectangle': {
      const bounds = getShapeBounds(element.start, element.end, width, height);
      const path = new Path2D();
      path.rect(bounds.x, bounds.y, bounds.width, bounds.height);
      return path;
    }
    case 'ellipse': {
      const bounds = getShapeBounds(element.start, element.end, width, height);
      const path = new Path2D();
      path.ellipse(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
        bounds.width / 2,
        bounds.height / 2,
        0,
        0,
        2 * Math.PI,
      );
      return path;
    }
    case 'fill': {
      // One path per fill so adjacent rectangles rasterize as a single region without seams.
      const path = new Path2D();
      for (const rectangle of element.rectangles) {
        path.rect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
      }
      return path;
    }
  }
}

function paintElement(
  config: DrawingRenderConfig,
  context: CanvasRenderingContext2D,
  element: DrawingElement,
): void {
  const path = createElementPath(config, element);
  if (element.kind === 'fill') {
    context.fillStyle = element.color;
    context.fill(path);
    return;
  }
  context.strokeStyle = element.kind === 'eraser' ? config.backgroundColor : element.color;
  context.lineWidth = element.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke(path);
}

function paintDrawing(
  config: DrawingRenderConfig,
  context: CanvasRenderingContext2D,
  elements: readonly DrawingElement[],
): void {
  context.fillStyle = config.backgroundColor;
  context.fillRect(0, 0, config.width, config.height);
  for (const element of elements) paintElement(config, context, element);
}

function createCanonicalSurface(
  config: DrawingRenderConfig,
  willReadFrequently: boolean,
  failureMessage: string,
): CanonicalSurface {
  const canvas = document.createElement('canvas');
  canvas.width = config.width;
  canvas.height = config.height;
  const context = canvas.getContext('2d', { willReadFrequently });
  if (context === null) {
    throw new Error(failureMessage);
  }
  return { canvas, context };
}

/** Zeroing the backing store returns its memory at once; WebKit caps total canvas memory. */
function releaseSurface(surface: CanonicalSurface): void {
  surface.canvas.width = 0;
  surface.canvas.height = 0;
}

function parseOpaqueHexColor(color: DrawingColor): PixelColor {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
    255,
  ];
}

function readPixel(pixels: Uint8Array, pixelIndex: number): PixelColor {
  const offset = pixelIndex * 4;
  const channels = pixels.subarray(offset, offset + 4);
  const [red, green, blue, alpha] = channels;
  if (red === undefined || green === undefined || blue === undefined || alpha === undefined) {
    throw new Error('[FAIL-FAST] Fill seed pixel is outside the canvas');
  }
  return [red, green, blue, alpha];
}

function createFillElement(
  config: DrawingRenderConfig,
  elements: readonly DrawingElement[],
  point: DrawingPoint,
  color: DrawingColor,
): DrawingFillElement | null {
  const surface = createCanonicalSurface(config, true, '无法创建填充计算画布');
  let pixels: Uint8Array;
  try {
    paintDrawing(config, surface.context, elements);
    const imageData = surface.context.getImageData(0, 0, config.width, config.height);
    pixels = new Uint8Array(
      imageData.data.buffer,
      imageData.data.byteOffset,
      imageData.data.byteLength,
    );
  } finally {
    releaseSurface(surface);
  }
  const seedX = Math.min(config.width - 1, Math.floor(point.x * config.width));
  const seedY = Math.min(config.height - 1, Math.floor(point.y * config.height));
  const seedIndex = seedY * config.width + seedX;
  const targetColor = readPixel(pixels, seedIndex);
  const fillColor = parseOpaqueHexColor(color);
  if (targetColor.every((channel, index) => channel === fillColor[index])) {
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

function encodePng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error('无法导出画作'));
        return;
      }
      resolve(blob);
    }, PNG_CONTENT_TYPE);
  });
}

async function renderDrawing(
  config: DrawingRenderConfig,
  elements: readonly DrawingElement[],
): Promise<Blob> {
  if (elements.length === 0) {
    throw new Error(config.emptyDrawingMessage);
  }
  const surface = createCanonicalSurface(config, false, '无法创建画作导出画布');
  let png: Blob;
  try {
    paintDrawing(config, surface.context, elements);
    png = await encodePng(surface.canvas);
  } finally {
    releaseSurface(surface);
  }
  if (png.size > config.maxBytes) {
    throw new Error(`画作超过 ${config.maxBytes / 1024 ** 2} MiB，请撤销部分内容后重试`);
  }
  return png;
}

/**
 * Binds game-owned specifications to shared canvas painting, fills and PNG export.
 * @throws Returned operations reject malformed strokes, canvas allocation/read failures or
 * oversized PNGs.
 */
export function createDrawingRenderer(config: DrawingRenderConfig) {
  const painter: DrawingPainter = {
    width: config.width,
    height: config.height,
    paintDrawing: (context, elements) => paintDrawing(config, context, elements),
    paintElement: (context, element) => paintElement(config, context, element),
  };
  return {
    painter,
    createFillElement: (
      elements: readonly DrawingElement[],
      point: DrawingPoint,
      color: DrawingColor,
    ) => createFillElement(config, elements, point, color),
    renderDrawing: (elements: readonly DrawingElement[]) => renderDrawing(config, elements),
  };
}
