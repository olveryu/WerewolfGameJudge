/** Render normalized Pictionary strokes to the canonical 1024x768 PNG payload. */

import {
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_MAX_BYTES,
  PICTIONARY_DRAWING_WIDTH,
} from '@game-judge/game-engine/games/pictionary/public';
import {
  ImageFormat,
  PaintStyle,
  Skia,
  type SkPath,
  StrokeCap,
  StrokeJoin,
} from '@shopify/react-native-skia';

import { PICTIONARY_CANVAS_BACKGROUND } from '@/theme';

import type { PictionaryDrawingPoint, PictionaryDrawingStroke } from '../model/pictionaryDrawing';

export function createPictionaryStrokePath(
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

/**
 * Produce the immutable PNG body accepted by the Worker media route.
 *
 * @throws When Skia cannot allocate the offscreen surface or the PNG exceeds 2 MiB.
 */
export function renderPictionaryDrawing(strokes: readonly PictionaryDrawingStroke[]): Blob {
  if (strokes.length === 0) {
    throw new Error('[FAIL-FAST] Cannot export an empty Pictionary drawing');
  }
  const surface = Skia.Surface.MakeOffscreen(PICTIONARY_DRAWING_WIDTH, PICTIONARY_DRAWING_HEIGHT);
  if (surface === null) {
    throw new Error('无法创建画作导出画布');
  }

  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color(PICTIONARY_CANVAS_BACKGROUND));
  for (const stroke of strokes) {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeCap(StrokeCap.Round);
    paint.setStrokeJoin(StrokeJoin.Round);
    paint.setStrokeWidth(stroke.width);
    paint.setColor(
      Skia.Color(stroke.tool === 'eraser' ? PICTIONARY_CANVAS_BACKGROUND : stroke.color),
    );
    canvas.drawPath(
      createPictionaryStrokePath(
        stroke.points,
        PICTIONARY_DRAWING_WIDTH,
        PICTIONARY_DRAWING_HEIGHT,
      ),
      paint,
    );
  }
  surface.flush();
  const pngBytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG, 100);
  if (pngBytes.byteLength > PICTIONARY_DRAWING_MAX_BYTES) {
    throw new Error('画作超过 2 MiB，请撤销部分笔画后重试');
  }
  const pngBuffer = new ArrayBuffer(pngBytes.byteLength);
  new Uint8Array(pngBuffer).set(pngBytes);
  return new Blob([pngBuffer], { type: 'image/png' });
}
