/**
 * 你画我猜媒体服务：笔画渲染与终稿 PNG 导出。
 *
 * 渲染部分从接龙版 `src/games/pictionary/services/renderPictionaryDrawing.ts` 演化；
 * 上传/读取已迁共享工厂（`drawGuessMediaTransport.ts`）。
 */

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

import { PICTIONARY_CANVAS_BACKGROUND as DRAWGUESS_CANVAS_BACKGROUND } from '@/theme/colors';

export { DRAWGUESS_CANVAS_BACKGROUND };

import type {
  DrawingColor,
  DrawingElement,
  DrawingFillElement,
  DrawingPoint,
} from '@/features/drawing/model/drawing';
import { FILL_STROKE_WIDTH } from '@/features/drawing/model/drawing';
import { createFillRectangles } from '@/features/drawing/services/floodFill';
import { createStrokePath } from '@/features/drawing/services/strokePath';

/** 终稿画作规格：固定 1024×768 PNG，单文件最大 2 MiB（设计 §8.3）。 */
const DRAWGUESS_EXPORT_WIDTH = 1024;
const DRAWGUESS_EXPORT_HEIGHT = 768;
const DRAWGUESS_EXPORT_MAX_BYTES = 2 * 1024 * 1024;

function getShapeBounds(
  start: DrawingPoint,
  end: DrawingPoint,
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

/** 交互画布与终稿 PNG 导出共用同一套路径构造。 */
export function createDrawGuessElementPath(
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
      const scaleX = width / DRAWGUESS_EXPORT_WIDTH;
      const scaleY = height / DRAWGUESS_EXPORT_HEIGHT;
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

function drawDrawGuessElements(
  canvas: SkCanvas,
  elements: readonly DrawingElement[],
  width: number,
  height: number,
): void {
  canvas.drawColor(Skia.Color(DRAWGUESS_CANVAS_BACKGROUND));
  const displayScale = width / DRAWGUESS_EXPORT_WIDTH;
  for (const element of elements) {
    const paint = Skia.Paint();
    const isFill = element.kind === 'fill';
    paint.setAntiAlias(!isFill);
    paint.setStyle(isFill ? PaintStyle.Fill : PaintStyle.Stroke);
    paint.setColor(
      Skia.Color(element.kind === 'eraser' ? DRAWGUESS_CANVAS_BACKGROUND : element.color),
    );
    if (!isFill) {
      paint.setStrokeCap(StrokeCap.Round);
      paint.setStrokeJoin(StrokeJoin.Round);
      paint.setStrokeWidth(element.width * displayScale);
    }
    canvas.drawPath(createDrawGuessElementPath(element, width, height), paint);
  }
}

function renderCanonicalPixels(elements: readonly DrawingElement[]): Uint8Array {
  const surface = Skia.Surface.MakeOffscreen(DRAWGUESS_EXPORT_WIDTH, DRAWGUESS_EXPORT_HEIGHT);
  if (surface === null) {
    throw new Error('无法创建填充计算画布');
  }
  try {
    drawDrawGuessElements(
      surface.getCanvas(),
      elements,
      DRAWGUESS_EXPORT_WIDTH,
      DRAWGUESS_EXPORT_HEIGHT,
    );
    surface.flush();
    const image = surface.makeImageSnapshot();
    try {
      const pixels = image.readPixels(0, 0, {
        width: DRAWGUESS_EXPORT_WIDTH,
        height: DRAWGUESS_EXPORT_HEIGHT,
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
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return [red, green, blue, 255];
}

/** 在标准像素精度上创建一次可撤销的四连通填充操作。 */
export function createDrawGuessFillElement(
  elements: readonly DrawingElement[],
  point: DrawingPoint,
  color: DrawingColor,
): DrawingFillElement | null {
  const pixels = renderCanonicalPixels(elements);
  const seedX = Math.min(DRAWGUESS_EXPORT_WIDTH - 1, Math.floor(point.x * DRAWGUESS_EXPORT_WIDTH));
  const seedY = Math.min(
    DRAWGUESS_EXPORT_HEIGHT - 1,
    Math.floor(point.y * DRAWGUESS_EXPORT_HEIGHT),
  );
  const seedIndex = seedY * DRAWGUESS_EXPORT_WIDTH + seedX;
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
    rectangles: createFillRectangles(
      pixels,
      DRAWGUESS_EXPORT_WIDTH,
      DRAWGUESS_EXPORT_HEIGHT,
      seedIndex,
      targetColor,
    ),
  };
}

/**
 * 生成 Worker 媒体路由接受的不可变 PNG。
 *
 * @throws Skia 无法分配离屏画布，或 PNG 超过 2 MiB 时抛出。
 */
export function renderDrawGuessDrawing(elements: readonly DrawingElement[]): Blob {
  if (elements.length === 0) {
    throw new Error('[FAIL-FAST] Cannot export an empty DrawGuess drawing');
  }
  const surface = Skia.Surface.MakeOffscreen(DRAWGUESS_EXPORT_WIDTH, DRAWGUESS_EXPORT_HEIGHT);
  if (surface === null) {
    throw new Error('无法创建画作导出画布');
  }
  try {
    drawDrawGuessElements(
      surface.getCanvas(),
      elements,
      DRAWGUESS_EXPORT_WIDTH,
      DRAWGUESS_EXPORT_HEIGHT,
    );
    surface.flush();
    const image = surface.makeImageSnapshot();
    try {
      const pngBytes = image.encodeToBytes(ImageFormat.PNG, 100);
      if (pngBytes.byteLength > DRAWGUESS_EXPORT_MAX_BYTES) {
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
