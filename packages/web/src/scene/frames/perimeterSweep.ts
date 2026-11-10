/**
 * A short highlight travelling around the frame's rounded-rect border, drawn as a chain of line
 * chords on an analytic arc-length parametrisation of the rounded rect (0–100 viewBox units,
 * corner radius `rx`), so it follows the corners. Arc length 0 is the top centre `(50, 0)`,
 * increasing clockwise.
 */
import type { LineNode, LineSampler } from '@/scene/decoration';

import { FRAME_VIEWBOX_SIZE, frameRx, frameUnitsToPx } from './frameBox';

/** Chord length in viewBox units; short enough that corners read as curves. */
const SEGMENT_LENGTH = 6;
const FRAME_SIDE = 100;

interface PerimeterPoint {
  x: number;
  y: number;
}

function cornerRadius(rx: number): number {
  return Math.min(rx, FRAME_SIDE / 2);
}

function roundedRectPerimeter(rx: number): number {
  return FRAME_SIDE * 4 - (8 - 2 * Math.PI) * cornerRadius(rx);
}

function cornerPoint(cx: number, cy: number, r: number, angle: number): PerimeterPoint {
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

/** Point at arc length `s` (wrapped) on the rounded rect, in viewBox units. */
function pointAt(s: number, rx: number): PerimeterPoint {
  const r = cornerRadius(rx);
  const perimeter = roundedRectPerimeter(rx);
  const straight = FRAME_SIDE - 2 * r;
  const arc = (Math.PI * r) / 2;
  let d = ((s % perimeter) + perimeter) % perimeter;

  // Top edge from centre to the top-right corner.
  if (d <= straight / 2) return { x: FRAME_SIDE / 2 + d, y: 0 };
  d -= straight / 2;
  if (d <= arc) return cornerPoint(FRAME_SIDE - r, r, r, -Math.PI / 2 + d / r);
  d -= arc;
  if (d <= straight) return { x: FRAME_SIDE, y: r + d };
  d -= straight;
  if (d <= arc) return cornerPoint(FRAME_SIDE - r, FRAME_SIDE - r, r, d / r);
  d -= arc;
  if (d <= straight) return { x: FRAME_SIDE - r - d, y: FRAME_SIDE };
  d -= straight;
  if (d <= arc) return cornerPoint(r, FRAME_SIDE - r, r, Math.PI / 2 + d / r);
  d -= arc;
  if (d <= straight) return { x: 0, y: FRAME_SIDE - r - d };
  d -= straight;
  if (d <= arc) return cornerPoint(r, r, r, Math.PI + d / r);
  d -= arc;
  return { x: r + d, y: 0 };
}

/**
 * Arc length of the dash's leading edge at loop progress `t`, plus the dash opacity. `perimeter`
 * is the lap length, which depends on the corner radius and so on the tile size.
 */
export type SweepSampler = (t: number, perimeter: number) => { arcLength: number; opacity: number };

interface PerimeterSweep {
  durationMs: number;
  sample: SweepSampler;
  /** Dash length in viewBox units. */
  dashLength: number;
  /** Number of dashes; defaults to 1. */
  dashCount?: number;
  /** Arc length between consecutive dashes; defaults to `perimeter / dashCount`. */
  dashSpacing?: number;
  color: string;
  /** Stroke width in viewBox units. */
  strokeWidth: number;
}

/** One line node per chord of every dash. */
export function perimeterSweepNodes(sweep: PerimeterSweep): LineNode[] {
  const { durationMs, sample, dashLength, color, strokeWidth } = sweep;
  const dashCount = sweep.dashCount ?? 1;
  const segments = Math.max(1, Math.ceil(dashLength / SEGMENT_LENGTH));
  const segmentLength = dashLength / segments;
  const nodes: LineNode[] = [];
  for (let dash = 0; dash < dashCount; dash += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const chord: LineSampler = (t, size) => {
        const rx = frameRx(size);
        const perimeter = roundedRectPerimeter(rx);
        const dashSpacing = sweep.dashSpacing ?? perimeter / dashCount;
        const { arcLength, opacity } = sample(t, perimeter);
        const tail = arcLength + dash * dashSpacing - dashLength + segment * segmentLength;
        const a = pointAt(tail, rx);
        const b = pointAt(tail + segmentLength, rx);
        return {
          x1: frameUnitsToPx(a.x, size),
          y1: frameUnitsToPx(a.y, size),
          x2: frameUnitsToPx(b.x, size),
          y2: frameUnitsToPx(b.y, size),
          strokeWidth: (strokeWidth * size) / FRAME_VIEWBOX_SIZE,
          opacity,
        };
      };
      nodes.push({ kind: 'line', sample: chord, durationMs, color });
    }
  }
  return nodes;
}
