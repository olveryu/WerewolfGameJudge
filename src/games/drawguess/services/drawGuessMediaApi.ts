/**
 * 你画我猜媒体服务：笔画渲染、终稿 PNG 导出与 Worker 媒体路由上传/读取。
 *
 * 渲染部分从接龙版 `src/games/pictionary/services/renderPictionaryDrawing.ts` 复制并改名，
 * 上传/读取部分从接龙版 `src/games/pictionary/services/pictionaryMediaApi.ts` 复制并改名
 *（游戏间禁止互相 import）。
 */

import {
  DRAWGUESS_STATE_CODEC,
  type DrawGuessState,
} from '@game-judge/game-engine/games/drawguess/public';
import {
  parseRoomCommandResult,
  RoomCommandProtocolError,
  type RoomCommandResult,
} from '@game-judge/game-engine/platform/protocol/commandResult';
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

import { cfGetBinary, cfPutBinary } from '@/services/cloudflare/cfFetch';
import { PICTIONARY_CANVAS_BACKGROUND as DRAWGUESS_CANVAS_BACKGROUND } from '@/theme/colors';

export { DRAWGUESS_CANVAS_BACKGROUND };

import type {
  DrawingColor,
  DrawingElement,
  DrawingFillElement,
  DrawingPoint,
  DrawingWidth,
} from '@/features/drawing/model/drawing';

import { createDrawGuessFillRectangles } from './drawGuessFloodFill';

/** 终稿画作规格：固定 1024×768 PNG，单文件最大 2 MiB（设计 §8.3）。 */
const DRAWGUESS_EXPORT_WIDTH = 1024;
const DRAWGUESS_EXPORT_HEIGHT = 768;
const DRAWGUESS_EXPORT_MAX_BYTES = 2 * 1024 * 1024;

const PNG_CONTENT_TYPE = 'image/png';

function createDrawGuessStrokePath(
  points: readonly DrawingPoint[],
  width: number,
  height: number,
): SkPath {
  const firstPoint = points[0];
  if (firstPoint === undefined) {
    throw new Error('[FAIL-FAST] DrawGuess stroke requires at least one point');
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
      return createDrawGuessStrokePath(element.points, width, height);
    case 'line':
      return createDrawGuessStrokePath([element.start, element.end], width, height);
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
  width: DrawingWidth,
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
    width,
    rectangles: createDrawGuessFillRectangles(
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

// ─── Worker 媒体路由 ───────────────────────────────────────────────────────────

function encodePathSegment(value: string): string {
  if (value.length === 0) throw new Error('[FAIL-FAST] DrawGuess media path segment is empty');
  return encodeURIComponent(value);
}

function controlledSeatQuery(controlledSeat: number | null): string {
  if (controlledSeat === null) return '';
  if (!Number.isSafeInteger(controlledSeat) || controlledSeat < 0) {
    throw new Error(`[FAIL-FAST] Invalid controlled DrawGuess seat: ${controlledSeat}`);
  }
  return `?controlledSeat=${controlledSeat}`;
}

function parseUploadResponse(
  value: unknown,
  expectedCommandId: string,
): RoomCommandResult<DrawGuessState> {
  const result = parseRoomCommandResult(value, DRAWGUESS_STATE_CODEC);
  if (result.commandId !== expectedCommandId) {
    throw new RoomCommandProtocolError(
      `DrawGuess media commandId mismatch: expected ${expectedCommandId}, received ${result.commandId}`,
    );
  }
  return result;
}

/**
 * 上传已预留的画作。返回的权威快照也会由房间 DO 广播。
 *
 * @throws {CloudflareHttpError} 预留过期、无效或上传失败时抛出。
 */
export async function uploadDrawGuessDrawing(
  roomCode: string,
  submissionId: string,
  png: Blob,
  controlledSeat: number | null,
  signal?: AbortSignal,
): Promise<RoomCommandResult<DrawGuessState>> {
  const commandId = `drawguess-media-commit:${submissionId}`;
  return cfPutBinary(
    `/api/games/drawguess/rooms/${encodePathSegment(roomCode)}/submissions/${encodePathSegment(submissionId)}${controlledSeatQuery(controlledSeat)}`,
    png,
    PNG_CONTENT_TYPE,
    (value) => parseUploadResponse(value, commandId),
    { signal },
  );
}

function encodeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 32_768;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return globalThis.btoa(binary);
}

/**
 * 读取受保护的画作，转为 React Native Image 可用的 data URI。
 *
 * @throws {CloudflareHttpError} 无权访问或媒体缺失时抛出。
 */
export async function readDrawGuessDrawingDataUri(
  roomCode: string,
  entryId: string,
  controlledSeat: number | null,
  signal?: AbortSignal,
): Promise<string> {
  const bytes = await cfGetBinary(
    `/api/games/drawguess/rooms/${encodePathSegment(roomCode)}/media/${encodePathSegment(entryId)}${controlledSeatQuery(controlledSeat)}`,
    PNG_CONTENT_TYPE,
    { signal },
  );
  return `data:${PNG_CONTENT_TYPE};base64,${encodeBase64(bytes)}`;
}
