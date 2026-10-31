/**
 * PerimeterSweep — a short highlight travelling around the frame's rounded-rect border.
 *
 * Replaces animated `strokeDashoffset` on the perimeter path. The dash is drawn as a chain of
 * `LoopLine` chords positioned on an analytic arc-length parametrisation of the rounded rect
 * (0–100 viewBox units, corner radius `rx`), so it follows the corners without per-frame
 * attribute writes. Arc length 0 is the top-centre `(50, 0)`, increasing clockwise — the same
 * start as the hand-written `M50 0 H… Q…` perimeter paths in the frames.
 *
 * Boundary: presentation only. `sample` must be a module-level pure function (cache key).
 */
import { Fragment, memo } from 'react';

import { type LineSampler, LoopLine } from '@/components/loopMotion';

import { FRAME_VIEWBOX_SIZE, frameUnitsToPx } from './frameViewBox';

/** Chord length in viewBox units; short enough that corners read as curves. */
const SEGMENT_LENGTH = 6;
const FRAME_SIDE = 100;
/**
 * Corner radii are quantised to this many viewBox units for the sampler cache: keyframes rules
 * are never removed from the web stylesheet, so the key space must be finite. 0.5 units is
 * well under a device pixel at every avatar size in use.
 */
const RX_QUANTUM = 0.5;

interface PerimeterPoint {
  x: number;
  y: number;
}

export function roundedRectPerimeter(rx: number): number {
  const r = Math.min(rx, FRAME_SIDE / 2);
  return FRAME_SIDE * 4 - (8 - 2 * Math.PI) * r;
}

/** Point at arc length `s` (wrapped) on the rounded rect, in viewBox units. */
function pointAt(s: number, rx: number): PerimeterPoint {
  const r = Math.min(rx, FRAME_SIDE / 2);
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

function cornerPoint(cx: number, cy: number, r: number, angle: number): PerimeterPoint {
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

/** Arc length of the dash's leading edge at loop progress `t`, plus the dash opacity. */
export interface SweepSampler {
  (t: number): { arcLength: number; opacity: number };
}

export interface PerimeterSweepProps {
  /** Frame SVG pixel size (viewBox `-8 -8 116 116`). */
  size: number;
  /** Corner radius in viewBox units. */
  rx: number;
  durationMs: number;
  /** Module-level pure sampler. */
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

interface ChordSpec {
  sample: SweepSampler;
  rx: number;
  dashLength: number;
  dashCount: number;
  dashSpacing: number;
  strokeWidth: number;
}

const chordSamplerCache = new WeakMap<SweepSampler, Map<string, LineSampler[]>>();

/**
 * One `LineSampler` per chord. Keyed on the sampler reference plus everything that changes the
 * geometry, so each distinct frame configuration gets stable sampler references (the keyframes
 * cache key).
 */
function getChordSamplers(rawSpec: ChordSpec): LineSampler[] {
  const spec: ChordSpec = {
    ...rawSpec,
    rx: Math.round(rawSpec.rx / RX_QUANTUM) * RX_QUANTUM,
    dashSpacing: Math.round(rawSpec.dashSpacing / RX_QUANTUM) * RX_QUANTUM,
  };
  let byKey = chordSamplerCache.get(spec.sample);
  if (!byKey) {
    byKey = new Map();
    chordSamplerCache.set(spec.sample, byKey);
  }
  const key = `${spec.rx}:${spec.dashLength}:${spec.dashCount}:${spec.dashSpacing}:${spec.strokeWidth}`;
  const hit = byKey.get(key);
  if (hit) return hit;
  const segments = Math.max(1, Math.ceil(spec.dashLength / SEGMENT_LENGTH));
  const segmentLength = spec.dashLength / segments;
  const samplers: LineSampler[] = [];
  for (let dash = 0; dash < spec.dashCount; dash += 1) {
    const dashOffset = dash * spec.dashSpacing;
    for (let seg = 0; seg < segments; seg += 1) {
      samplers.push((t, size) => {
        const { arcLength, opacity } = spec.sample(t);
        const tail = arcLength + dashOffset - spec.dashLength + seg * segmentLength;
        const a = pointAt(tail, spec.rx);
        const b = pointAt(tail + segmentLength, spec.rx);
        return {
          x1: frameUnitsToPx(a.x, size),
          y1: frameUnitsToPx(a.y, size),
          x2: frameUnitsToPx(b.x, size),
          y2: frameUnitsToPx(b.y, size),
          strokeWidth: (spec.strokeWidth * size) / FRAME_VIEWBOX_SIZE,
          opacity,
        };
      });
    }
  }
  byKey.set(key, samplers);
  return samplers;
}

export const PerimeterSweep = memo<PerimeterSweepProps>(
  ({
    size,
    rx,
    durationMs,
    sample,
    dashLength,
    dashCount = 1,
    dashSpacing = roundedRectPerimeter(rx) / dashCount,
    color,
    strokeWidth,
  }) => {
    const samplers = getChordSamplers({
      sample,
      rx,
      dashLength,
      dashCount,
      dashSpacing,
      strokeWidth,
    });
    return (
      <Fragment>
        {samplers.map((chord, i) => (
          <LoopLine
            key={`chord-${i}`}
            sample={chord}
            size={size}
            durationMs={durationMs}
            color={color}
          />
        ))}
      </Fragment>
    );
  },
);
PerimeterSweep.displayName = 'PerimeterSweep';
