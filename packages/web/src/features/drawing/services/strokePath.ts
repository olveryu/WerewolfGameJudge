/**
 * Shared Canvas 2D path builder for drawing strokes.
 *
 * Used by both the interactive canvas and PNG export so the two rasterize identical geometry.
 */

import type { DrawingPoint } from '@/features/drawing/model/drawing';

/**
 * Canvas 2D drops some zero-length segments, so a single tap extends by a sub-pixel amount to
 * keep its round cap visible as a dot.
 */
const SINGLE_POINT_EXTENT = 0.01;

/**
 * Build a stroke path from normalized drawing points.
 * Points are in 0-1 coordinate space; width/height scale to pixels.
 * @throws When the stroke has no points.
 */
export function createStrokePath(
  points: readonly DrawingPoint[],
  width: number,
  height: number,
): Path2D {
  const firstPoint = points[0];
  if (firstPoint === undefined) {
    throw new Error('[FAIL-FAST] Stroke requires at least one point');
  }
  const path = new Path2D();
  path.moveTo(firstPoint.x * width, firstPoint.y * height);
  if (points.length === 1) {
    path.lineTo(firstPoint.x * width + SINGLE_POINT_EXTENT, firstPoint.y * height);
    return path;
  }
  for (const point of points.slice(1)) {
    path.lineTo(point.x * width, point.y * height);
  }
  return path;
}
