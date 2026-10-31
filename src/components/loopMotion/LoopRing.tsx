/**
 * LoopRing — a stroked circle following a looping `(t, size) => {cx, cy, r, strokeWidth, …}` path.
 *
 * Boundary: presentation only. Radius maps to `scale` of a static bordered circle. Because
 * `scale` cannot change stroke thickness independently of radius, a varying `strokeWidth` is
 * rendered as two stacked rings (thinnest / thickest) with complementary opacity weights
 * `1 − w` / `w` — the blend reads as a breathing stroke while staying compositor-only. Ring
 * strokes in this codebase are translucent, where complementary weights stay within ~α²/4 of
 * the target; an opaque ring would dip to 75 % coverage mid-breath. Sampled once per `(sample, size)`
 * into shared keyframes rules. `sample` must be a module-level pure function — it is the cache key.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  createLoopRuleCache,
  loopAnimationProps,
  type LoopFrame,
  type LoopSampler,
} from './loopKeyframes';

/** Ring geometry at loop progress `t`, in the tile's pixel space. */
export interface RingFrame {
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  opacity: number;
}

export type RingSampler = LoopSampler<RingFrame>;

export interface LoopRingProps {
  sample: RingSampler;
  /** Tile pixel size forwarded to `sample`. */
  size: number;
  /** Loop length in ms. */
  durationMs: number;
  /** Cycle offset in `[0, 1)`; defaults to 0. */
  phase?: number;
  color: string;
}

interface RingLayout {
  rMax: number;
  strokeMin: number;
  strokeMax: number;
}

function ringFrames(
  rings: readonly RingFrame[],
  rMax: number,
  strokeWidth: number,
  opacityOf: (ring: RingFrame) => number,
): LoopFrame[] {
  const outer = rMax + strokeWidth / 2;
  return rings.map((ring) => ({
    translateX: ring.cx - outer,
    translateY: ring.cy - outer,
    rotateDeg: 0,
    scaleX: ring.r / rMax,
    scaleY: ring.r / rMax,
    opacity: opacityOf(ring),
  }));
}

function deriveLayout(rings: readonly RingFrame[]): RingLayout {
  const rMax = Math.max(...rings.map((r) => r.r));
  const strokeMin = Math.min(...rings.map((r) => r.strokeWidth));
  const strokeMax = Math.max(...rings.map((r) => r.strokeWidth));
  if (!(rMax > 0) || !(strokeMax > 0)) {
    throw new Error('LoopRing sampler must produce a visible ring at some point of the loop');
  }
  return { rMax, strokeMin, strokeMax };
}

/** Normalised position of the sampled stroke between the thinnest and thickest ring. */
function thickWeight(ring: RingFrame, layout: RingLayout): number {
  const span = layout.strokeMax - layout.strokeMin;
  return span > 0 ? (ring.strokeWidth - layout.strokeMin) / span : 0;
}

/** Thin ring: weight `1 − w`; carries the full opacity when the stroke does not vary. */
const getThinRule = createLoopRuleCache<RingFrame, RingLayout>((rings) => {
  const layout = deriveLayout(rings);
  return {
    frames: ringFrames(
      rings,
      layout.rMax,
      layout.strokeMin,
      (r) => r.opacity * (1 - thickWeight(r, layout)),
    ),
    layout,
  };
});

/** Thick ring: weight `w`. */
const getThickRule = createLoopRuleCache<RingFrame, RingLayout>((rings) => {
  const layout = deriveLayout(rings);
  return {
    frames: ringFrames(
      rings,
      layout.rMax,
      layout.strokeMax,
      (r) => r.opacity * thickWeight(r, layout),
    ),
    layout,
  };
});

function ringStyle(rMax: number, strokeWidth: number, color: string) {
  const outer = rMax + strokeWidth / 2;
  return {
    width: outer * 2,
    height: outer * 2,
    borderRadius: outer,
    borderWidth: strokeWidth,
    borderColor: color,
  };
}

export const LoopRing = memo<LoopRingProps>(({ sample, size, durationMs, phase = 0, color }) => {
  const thin = getThinRule(sample, size, durationMs);
  const { rMax, strokeMin, strokeMax } = thin.layout;
  const hasVaryingStroke = strokeMax > strokeMin;
  return (
    <>
      <Animated.View
        style={[
          styles.node,
          ringStyle(rMax, hasVaryingStroke ? strokeMin : strokeMax, color),
          loopAnimationProps(thin.rule, durationMs, phase),
        ]}
      />
      {hasVaryingStroke && (
        <Animated.View
          style={[
            styles.node,
            ringStyle(rMax, strokeMax, color),
            loopAnimationProps(getThickRule(sample, size, durationMs).rule, durationMs, phase),
          ]}
        />
      )}
    </>
  );
});
LoopRing.displayName = 'LoopRing';

const styles = StyleSheet.create({
  node: { position: 'absolute', top: 0, left: 0 },
});
