/**
 * Ported from the React Native client's loopMotion tests (`LoopMorph.test.ts`,
 * `loopKeyframes.test.ts`): morph windows verbatim; keyframe sampling, phase delay and angle
 * unwrapping re-expressed against the per-frame model.
 */
import type { LineFrame } from '@/scene/decoration';
import {
  clampOpacity,
  dashFlowCycles,
  dashPolyline,
  deriveLineLayout,
  deriveRingLayout,
  type LinePlacement,
  loopProgress,
  placeLine,
  sampleLoop,
  snapBorderWidth,
  thickWeight,
  windowWeight,
} from '@/scene/loopGeometry';

const N = 4;
const weightsAt = (phase: number, mode: 'crossfade' | 'stacked' | 'step') =>
  Array.from({ length: N }, (_, k) => windowWeight(phase, k, N, mode));

describe('windowWeight', () => {
  it('crossfade weights form a partition of unity', () => {
    for (const phase of [0, 0.1, 0.125, 0.3, 0.6, 0.99]) {
      const sum = weightsAt(phase, 'crossfade').reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it('stacked keeps the lower variant opaque and fades the upper one', () => {
    // Segment 1 → 2: variant 1 (lower) stays 1, variant 2 fades in.
    expect(weightsAt(0.25, 'stacked')).toEqual([0, 1, 0, 0]);
    expect(weightsAt(0.375, 'stacked')).toEqual([0, 1, 0.5, 0]);
    // Wrap segment 3 → 0: incoming 0 is lower, so it holds 1 and 3 fades out.
    expect(weightsAt(0.75, 'stacked')).toEqual([1, 0, 0, 1]);
    expect(weightsAt(0.875, 'stacked')).toEqual([1, 0, 0, 0.5]);
  });

  it('stacked always has at least one variant at full weight', () => {
    for (let i = 0; i < 40; i += 1) {
      expect(Math.max(...weightsAt(i / 40, 'stacked'))).toBe(1);
    }
  });

  it('step shows exactly one variant', () => {
    expect(weightsAt(0.3, 'step')).toEqual([0, 1, 0, 0]);
    expect(weightsAt(0.99, 'step')).toEqual([0, 0, 0, 1]);
  });
});

/** A wave translated by one full period per loop: `sample(1)` differs from `sample(0)`. */
const travelling = (t: number, size: number) => ({ x: t * size, opacity: 1 });

describe('sampleLoop', () => {
  it('samples 15/s with a floor of 24 and ends at sample(1)', () => {
    // 4000 ms / (1000/15) = 60 intervals → 61 samples including t = 1
    const samples = sampleLoop(travelling, 100, 4000);
    expect(samples).toHaveLength(61);
    expect(samples[0]?.x).toBe(0);
    expect(samples[60]?.x).toBe(100);
    expect(sampleLoop(travelling, 100, 300)).toHaveLength(25);
  });

  it('rejects non-positive durations and sizes', () => {
    expect(() => sampleLoop(travelling, 80, 0)).toThrow('Loop duration must be positive');
    expect(() => sampleLoop(travelling, 0, 2000)).toThrow('Loop size must be positive');
  });
});

describe('loopProgress', () => {
  it('shifts a node into its cycle like a negative delay of phase × duration', () => {
    expect(loopProgress(0, 2000, 0.25)).toBe(0.25);
    expect(loopProgress(500, 2000, 0)).toBe(0.25);
    expect(loopProgress(1500, 2000, 0.75)).toBe(0.5);
    expect(loopProgress(4000, 2000, 0)).toBe(0);
  });
});

describe('placeLine', () => {
  const line = (x2: number, y2: number, strokeWidth = 2): LineFrame => ({
    x1: 0,
    y1: 0,
    x2,
    y2,
    strokeWidth,
    opacity: 1,
  });

  it('scales the longest, thickest bar to each frame', () => {
    const layout = deriveLineLayout([line(10, 0, 2), line(0, 20, 4)]);
    expect(layout).toEqual({ lengthMax: 20, strokeMax: 4, initialAngle: 0 });
    const out: LinePlacement = { x: 0, y: 0, rotation: layout.initialAngle, scaleX: 1, scaleY: 1 };
    placeLine(line(0, 10, 2), layout, out);
    expect(out).toEqual({ x: 0, y: 5, rotation: Math.PI / 2, scaleX: 0.5, scaleY: 0.5 });
  });

  it('carries the previous angle through zero-length frames', () => {
    const layout = deriveLineLayout([line(0, 0), line(0, 10)]);
    expect(layout.initialAngle).toBe(Math.PI / 2);
    const out: LinePlacement = { x: 0, y: 0, rotation: layout.initialAngle, scaleX: 1, scaleY: 1 };
    placeLine(line(0, 0), layout, out);
    expect(out.rotation).toBe(Math.PI / 2);
    expect(out.scaleX).toBe(0);
  });

  it('rejects a sampler that never draws a segment', () => {
    expect(() => deriveLineLayout([line(0, 0), line(0, 0)])).toThrow('visible segment');
  });
});

describe('ring and path strokes', () => {
  it('weights the thickest copy by the sampled stroke width', () => {
    const layout = deriveRingLayout([
      { cx: 0, cy: 0, r: 4, strokeWidth: 1, opacity: 1 },
      { cx: 0, cy: 0, r: 8, strokeWidth: 3, opacity: 1 },
    ]);
    expect(layout).toEqual({ rMax: 8, strokeMin: 1, strokeMax: 3 });
    expect(thickWeight(2, layout)).toBe(0.5);
    expect(thickWeight(2, { strokeMin: 2, strokeMax: 2 })).toBe(0);
  });

  it('clamps opacity like CSS', () => {
    expect([clampOpacity(-0.2), clampOpacity(0.4), clampOpacity(1.3)]).toEqual([0, 0.4, 1]);
  });

  it('paints ring strokes like CSS borders: whole device pixels, at least one', () => {
    expect([0.3, 1.5, 1.6].map((width) => snapBorderWidth(width, 2))).toEqual([0.5, 1.5, 1.5]);
    expect(snapBorderWidth(1.5, 1)).toBe(1);
  });
});

describe('dash flow', () => {
  it('rounds the travel to whole dash periods and rejects motionless flows', () => {
    expect(dashFlowCycles(14, 180)).toBe(13);
    expect(() => dashFlowCycles(14, 6)).toThrow('would not move');
  });

  it('splits a polyline into SVG dashes from the dash offset', () => {
    const horizontal = [0, 0, 10, 0];
    expect(dashPolyline(horizontal, false, [3, 2], 0)).toEqual([
      [0, 0, 3, 0],
      [5, 0, 8, 0],
    ]);
    // A negative offset slides the pattern forward along the path.
    expect(dashPolyline(horizontal, false, [3, 2], -1)).toEqual([
      [1, 0, 4, 0],
      [6, 0, 9, 0],
    ]);
  });
});
