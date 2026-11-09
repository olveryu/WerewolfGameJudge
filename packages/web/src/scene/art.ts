/**
 * Drawing helpers for decoration art: SVG path data, viewBox scaling and dashed strokes, which
 * the React Native client drew with react-native-svg.
 */
import { type GraphicsContext, GraphicsPath, Polygon, type StrokeInput } from 'pixi.js';

import { dashPolyline } from '@/scene/loopGeometry';

/** Parses SVG path data (`d`). */
export function svgPath(d: string): GraphicsPath {
  return new GraphicsPath(d);
}

/**
 * Maps a square `viewBox` (`0 0 viewBox viewBox`, or centred when `centred`) onto `size` pixels
 * for the shapes drawn after it. PixiJS transforms shape points but not stroke widths, so
 * strokes authored in viewBox units are multiplied by the returned unit.
 */
export function applyViewBox(
  context: GraphicsContext,
  size: number,
  viewBox: number,
  centred = false,
): number {
  const unit = size / viewBox;
  context.setTransform(unit, 0, 0, unit, centred ? size / 2 : 0, centred ? size / 2 : 0);
  return unit;
}

/** Polylines (`[x0, y0, x1, y1, …]`) of each subpath of SVG path data, curves flattened. */
export function flattenPath(d: string): { points: number[]; closed: boolean }[] {
  return svgPath(d).shapePath.shapePrimitives.map(({ shape }) => {
    if (!(shape instanceof Polygon)) {
      throw new Error(`Cannot dash a ${shape.type} subpath of "${d}"`);
    }
    return { points: shape.points, closed: shape.closePath };
  });
}

/** Polyline of a full circle, starting at 3 o'clock and running clockwise like SVG. */
export function circlePolyline(cx: number, cy: number, r: number, segments = 96): number[] {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const angle = (i / segments) * Math.PI * 2;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  }).flat();
}

/** Strokes the visible dashes of `polylines` (SVG `stroke-dasharray` / `stroke-dashoffset`). */
export function strokeDashed(
  context: GraphicsContext,
  polylines: readonly { points: readonly number[]; closed: boolean }[],
  dashArray: readonly number[],
  dashOffset: number,
  style: StrokeInput,
): void {
  for (const { points, closed } of polylines) {
    for (const dash of dashPolyline(points, closed, dashArray, dashOffset)) {
      context.moveTo(dash[0]!, dash[1]!);
      for (let i = 2; i + 1 < dash.length; i += 2) context.lineTo(dash[i]!, dash[i + 1]!);
    }
  }
  context.stroke(style);
}
