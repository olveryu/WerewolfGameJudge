/**
 * Pure loop geometry shared by the stage and its tests: sampler layouts, morph windows and dash
 * patterns. Ported from the React Native client's loopMotion (`LoopLine`, `LoopRing`,
 * `LoopPath`, `LoopMorph`, `LoopDashFlow`); no PixiJS.
 */
import type { LineFrame, LoopSampler, MorphMode, PathFrame, RingFrame } from '@/scene/decoration';

/**
 * Loop progress for a node at `timeMs`: the RN client shifted elements into the cycle with a
 * negative `animation-delay` of `phase × duration`, which this reproduces.
 */
export function loopProgress(timeMs: number, durationMs: number, phase: number): number {
  const progress = timeMs / durationMs + phase;
  return progress - Math.floor(progress);
}

/** CSS clamps opacity to `[0, 1]`; samplers rely on it (e.g. `0.2 + sin(…) × 0.35`). */
export function clampOpacity(opacity: number): number {
  return opacity < 0 ? 0 : opacity > 1 ? 1 : opacity;
}

/** loopMotion sampled 15 frames per animated second, at least 24, plus `t = 1`. */
const LAYOUT_SAMPLE_INTERVAL_MS = 1000 / 15;
const LAYOUT_MIN_SAMPLES = 24;

/** Samples a loop the way loopMotion did to size its static node (`count + 1` samples). */
export function sampleLoop<G>(sample: LoopSampler<G>, size: number, durationMs: number): G[] {
  if (!(durationMs > 0)) {
    throw new Error(`Loop duration must be positive, received ${durationMs}`);
  }
  if (!(size > 0)) {
    throw new Error(`Loop size must be positive, received ${size}`);
  }
  const count = Math.max(LAYOUT_MIN_SAMPLES, Math.ceil(durationMs / LAYOUT_SAMPLE_INTERVAL_MS));
  return Array.from({ length: count + 1 }, (_, i) => sample(i / count, size));
}

/** Static size of a line node: the bar is drawn at its longest and thickest, then scaled. */
export interface LineLayout {
  lengthMax: number;
  strokeMax: number;
  /** Direction of the first non-degenerate sample, carried into zero-length frames. */
  initialAngle: number;
}

export function deriveLineLayout(lines: readonly LineFrame[]): LineLayout {
  let lengthMax = 0;
  let strokeMax = 0;
  let initialAngle: number | null = null;
  for (const line of lines) {
    const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
    lengthMax = Math.max(lengthMax, length);
    strokeMax = Math.max(strokeMax, line.strokeWidth);
    if (initialAngle === null && length > 0) {
      initialAngle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
    }
  }
  if (!(lengthMax > 0) || !(strokeMax > 0) || initialAngle === null) {
    throw new Error('Line sampler must produce a visible segment at some point of the loop');
  }
  return { lengthMax, strokeMax, initialAngle };
}

/** Mutable placement written by `placeLine` so the stage allocates nothing per frame. */
export interface LinePlacement {
  x: number;
  y: number;
  /** Radians; a zero-length frame keeps the previous value. */
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/** Places the static bar for `line`; `out.rotation` must hold the previous frame's angle. */
export function placeLine(line: LineFrame, layout: LineLayout, out: LinePlacement): void {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const length = Math.hypot(dx, dy);
  out.x = (line.x1 + line.x2) / 2;
  out.y = (line.y1 + line.y2) / 2;
  if (length > 0) out.rotation = Math.atan2(dy, dx);
  out.scaleX = length / layout.lengthMax;
  out.scaleY = line.strokeWidth / layout.strokeMax;
}

/** Static stroke range of a ring or path node. */
export interface StrokeLayout {
  strokeMin: number;
  strokeMax: number;
}

export interface RingLayout extends StrokeLayout {
  rMax: number;
}

export function deriveRingLayout(rings: readonly RingFrame[]): RingLayout {
  const rMax = Math.max(...rings.map((ring) => ring.r));
  const strokeMin = Math.min(...rings.map((ring) => ring.strokeWidth));
  const strokeMax = Math.max(...rings.map((ring) => ring.strokeWidth));
  if (!(rMax > 0) || !(strokeMax > 0)) {
    throw new Error('Ring sampler must produce a visible ring at some point of the loop');
  }
  return { rMax, strokeMin, strokeMax };
}

export function derivePathLayout(paths: readonly PathFrame[]): StrokeLayout {
  const strokeMin = Math.min(...paths.map((path) => path.strokeWidth));
  const strokeMax = Math.max(...paths.map((path) => path.strokeWidth));
  if (!(strokeMax >= 0) || Number.isNaN(strokeMin)) {
    throw new Error('Path sampler must produce finite stroke widths');
  }
  return { strokeMin, strokeMax };
}

/** Whether the stroke varies, so a second (thickest) copy is drawn. */
export function hasVaryingStroke(layout: StrokeLayout): boolean {
  return layout.strokeMax > layout.strokeMin;
}

/**
 * A CSS border width as browsers paint it: whole device pixels, rounded down, at least one. The
 * previous client drew rings as bordered boxes, so hairline ring strokes stay visible.
 */
export function snapBorderWidth(width: number, resolution: number): number {
  return Math.max(1, Math.floor(width * resolution)) / resolution;
}

/**
 * Weight of the thickest copy for a sampled stroke width; the thinnest copy takes `1 − w`. Both
 * are translucent in practice, where complementary weights read as a breathing stroke.
 */
export function thickWeight(strokeWidth: number, layout: StrokeLayout): number {
  const span = layout.strokeMax - layout.strokeMin;
  return span > 0 ? (strokeWidth - layout.strokeMin) / span : 0;
}

/** Signed distance from `t` to `centre` on the unit circle, in `[-0.5, 0.5]`. */
function wrappedDistance(t: number, centre: number): number {
  const d = t - centre;
  return d - Math.round(d);
}

/**
 * Opacity window of morph variant `k` at cycle phase `cyclePhase`:
 * - `'crossfade'` — triangular windows forming a partition of unity (translucent artwork);
 * - `'stacked'` — the variant lower in stacking order holds weight 1 while the upper one fades,
 *   so coverage never drops (opaque artwork);
 * - `'step'` — box windows for shapes that snap.
 */
export function windowWeight(
  cyclePhase: number,
  k: number,
  variantCount: number,
  mode: MorphMode,
): number {
  if (mode === 'stacked') return stackedWeight(cyclePhase, k, variantCount);
  const d = wrappedDistance(cyclePhase, k / variantCount);
  if (mode === 'step') {
    return d >= 0 && d < 1 / variantCount ? 1 : 0;
  }
  return Math.max(0, 1 - Math.abs(d) * variantCount);
}

/**
 * Segment `[k₀/N, (k₀+1)/N)` blends variant `k₀` (outgoing) with `(k₀+1) mod N` (incoming). The
 * lower variant (drawn first) holds weight 1 while the upper one fades — in when it is the
 * incoming pose, out when it is the outgoing one (the wrap segment).
 */
function stackedWeight(cyclePhase: number, k: number, variantCount: number): number {
  const scaled = ((cyclePhase % 1) + 1) % 1;
  const outgoing = Math.floor(scaled * variantCount) % variantCount;
  const incoming = (outgoing + 1) % variantCount;
  const progress = scaled * variantCount - Math.floor(scaled * variantCount);
  if (k !== outgoing && k !== incoming) return 0;
  const lower = Math.min(outgoing, incoming);
  if (k === lower) return 1;
  return k === incoming ? progress : 1 - progress;
}

/** Validates morph parameters the way `LoopMorph` did. */
export function assertMorphShape(variantCount: number, cyclesPerLoop: number): void {
  if (!Number.isInteger(variantCount) || variantCount < 2) {
    throw new Error(`Morph requires an integer variantCount >= 2, received ${variantCount}`);
  }
  if (!Number.isInteger(cyclesPerLoop) || cyclesPerLoop < 1) {
    throw new Error(`Morph requires an integer cyclesPerLoop >= 1, received ${cyclesPerLoop}`);
  }
}

/**
 * Cycles of a sliding dash pattern per loop. Rounding keeps the loop seamless; it changes the
 * travelled distance by under half a period, so `travel` must cover at least half a period.
 */
export function dashFlowCycles(dashPeriod: number, travel: number): number {
  if (!(dashPeriod > 0) || !(travel > 0)) {
    throw new Error(
      `Dash flow requires positive dashPeriod and travel, received ${dashPeriod} / ${travel}`,
    );
  }
  const cycles = Math.round(travel / dashPeriod);
  if (cycles < 1) {
    throw new Error(
      `Dash flow travel ${travel} is under half a dash period (${dashPeriod}); the dashes would not move`,
    );
  }
  return cycles;
}

/** Dash offset of dash-flow variant `k`, as `LoopDashFlow` rendered it. */
export function dashFlowOffset(k: number, variantCount: number, dashPeriod: number): number {
  return -(k / variantCount) * dashPeriod;
}

/**
 * Splits a polyline (`[x0, y0, x1, y1, …]`) into the visible dashes of an SVG
 * `stroke-dasharray` / `stroke-dashoffset`, each dash as its own polyline.
 */
export function dashPolyline(
  points: readonly number[],
  closed: boolean,
  dashArray: readonly number[],
  dashOffset: number,
): number[][] {
  // SVG repeats an odd-length dash array to make it even.
  const pattern = dashArray.length % 2 === 1 ? [...dashArray, ...dashArray] : dashArray;
  const period = pattern.reduce((sum, length) => sum + length, 0);
  if (!(period > 0) || pattern.some((length) => !(length >= 0))) {
    throw new Error(`Invalid dash pattern ${dashArray.join(' ')}`);
  }
  const path = closed && points.length >= 4 ? [...points, points[0]!, points[1]!] : points;
  const dashes: number[][] = [];
  // Pattern position at the path start; SVG starts `dashOffset` into the pattern.
  let position = ((dashOffset % period) + period) % period;
  let index = 0;
  while (position >= pattern[index]!) {
    position -= pattern[index]!;
    index = (index + 1) % pattern.length;
  }
  let remaining = pattern[index]! - position;
  let current: number[] | null = index % 2 === 0 ? [path[0]!, path[1]!] : null;
  for (let i = 2; i + 1 < path.length; i += 2) {
    let x0 = path[i - 2]!;
    let y0 = path[i - 1]!;
    const x1 = path[i]!;
    const y1 = path[i + 1]!;
    let segment = Math.hypot(x1 - x0, y1 - y0);
    while (segment > remaining) {
      const ratio = remaining / segment;
      const x = x0 + (x1 - x0) * ratio;
      const y = y0 + (y1 - y0) * ratio;
      if (current) {
        current.push(x, y);
        dashes.push(current);
        current = null;
      } else {
        current = [x, y];
      }
      segment -= remaining;
      x0 = x;
      y0 = y;
      index = (index + 1) % pattern.length;
      remaining = pattern[index]!;
    }
    remaining -= segment;
    current?.push(x1, y1);
  }
  if (current && current.length >= 4) dashes.push(current);
  return dashes;
}
