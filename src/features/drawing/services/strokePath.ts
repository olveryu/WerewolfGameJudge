/**
 * Shared Skia path builder for drawing strokes.
 *
 * Used by both Pictionary and DrawGuess for interactive canvas and PNG export.
 */

import { Skia, type SkPath } from '@shopify/react-native-skia';

import type { DrawingPoint } from '@/features/drawing/model/drawing';

/**
 * Build a Skia path from normalized drawing points.
 * Points are in 0-1 coordinate space; width/height scale to pixels.
 */
export function createStrokePath(
  points: readonly DrawingPoint[],
  width: number,
  height: number,
): SkPath {
  const firstPoint = points[0];
  if (firstPoint === undefined) {
    throw new Error('[FAIL-FAST] Stroke requires at least one point');
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
