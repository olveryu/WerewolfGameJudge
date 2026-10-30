/**
 * LoopDot — a filled circle following a looping `(t, size) => {cx, cy, r, opacity}` trajectory.
 *
 * Boundary: presentation only. The trajectory is sampled once per `(sample, size)` into a
 * shared compositor keyframes rule (see `loopKeyframes.ts`); the rendered node is a static
 * circle whose `transform` / `opacity` are animated by Reanimated CSS animations. `sample`
 * must be a module-level pure function — it is the cache key.
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

/** Circle geometry at loop progress `t`, in the tile's pixel space. */
export interface DotFrame {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

export type DotSampler = LoopSampler<DotFrame>;

export interface LoopDotProps {
  sample: DotSampler;
  /** Tile pixel size forwarded to `sample`. */
  size: number;
  /** Loop length in ms. */
  durationMs: number;
  /** Cycle offset in `[0, 1)`; defaults to 0. */
  phase?: number;
  color: string;
}

const getRule = createLoopRuleCache<DotFrame, { boxSize: number }>((dots) => {
  const rMax = Math.max(...dots.map((d) => d.r));
  if (!(rMax > 0)) {
    throw new Error('LoopDot sampler must produce a positive radius at some point of the loop');
  }
  const frames: LoopFrame[] = dots.map((d) => ({
    translateX: d.cx - rMax,
    translateY: d.cy - rMax,
    rotateDeg: 0,
    scaleX: d.r / rMax,
    scaleY: d.r / rMax,
    opacity: d.opacity,
  }));
  return { frames, layout: { boxSize: rMax * 2 } };
});

export const LoopDot = memo<LoopDotProps>(({ sample, size, durationMs, phase = 0, color }) => {
  const { rule, layout } = getRule(sample, size);
  return (
    <Animated.View
      style={[
        styles.node,
        {
          width: layout.boxSize,
          height: layout.boxSize,
          borderRadius: layout.boxSize / 2,
          backgroundColor: color,
        },
        loopAnimationProps(rule, durationMs, phase),
      ]}
    />
  );
});
LoopDot.displayName = 'LoopDot';

const styles = StyleSheet.create({
  node: { position: 'absolute', top: 0, left: 0 },
});
