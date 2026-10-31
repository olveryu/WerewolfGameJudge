/**
 * LoopLine — a round-capped segment following a looping `(t, size) => {x1, y1, x2, y2, …}` path.
 *
 * Boundary: presentation only. The segment is a static horizontal bar; per-frame length maps to
 * `scaleX`, stroke width to `scaleY`, position / angle to `translate` + `rotate`. Sampled once
 * per `(sample, size)` into a shared compositor keyframes rule. `sample` must be a module-level
 * pure function — it is the cache key.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  createLoopRuleCache,
  loopAnimationProps,
  type LoopFrame,
  type LoopSampler,
  unwrapDegrees,
} from './loopKeyframes';

/** Segment geometry at loop progress `t`, in the tile's pixel space. */
export interface LineFrame {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
  opacity: number;
}

export type LineSampler = LoopSampler<LineFrame>;

export interface LoopLineProps {
  sample: LineSampler;
  /** Tile pixel size forwarded to `sample`. */
  size: number;
  /** Loop length in ms. */
  durationMs: number;
  /** Cycle offset in `[0, 1)`; defaults to 0. */
  phase?: number;
  color: string;
}

const RAD_TO_DEG = 180 / Math.PI;

const getRule = createLoopRuleCache<LineFrame, { lengthMax: number; strokeMax: number }>(
  (lines) => {
    const lengths = lines.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
    const lengthMax = Math.max(...lengths);
    const strokeMax = Math.max(...lines.map((l) => l.strokeWidth));
    if (!(lengthMax > 0) || !(strokeMax > 0)) {
      throw new Error('LoopLine sampler must produce a visible segment at some point of the loop');
    }
    // Zero-length segments have no direction; they inherit the neighbouring angle so the
    // line does not swing while it is invisible.
    const angles = unwrapDegrees(
      lines.map((l, i) =>
        lengths[i]! > 0 ? Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * RAD_TO_DEG : null,
      ),
    );
    const frames: LoopFrame[] = lines.map((l, i) => ({
      translateX: (l.x1 + l.x2) / 2 - lengthMax / 2,
      translateY: (l.y1 + l.y2) / 2 - strokeMax / 2,
      rotateDeg: angles[i]!,
      scaleX: lengths[i]! / lengthMax,
      scaleY: l.strokeWidth / strokeMax,
      opacity: l.opacity,
    }));
    return { frames, layout: { lengthMax, strokeMax } };
  },
);

export const LoopLine = memo<LoopLineProps>(({ sample, size, durationMs, phase = 0, color }) => {
  const { rule, layout } = getRule(sample, size, durationMs);
  return (
    <Animated.View
      style={[
        styles.node,
        {
          width: layout.lengthMax,
          height: layout.strokeMax,
          borderRadius: layout.strokeMax / 2,
          backgroundColor: color,
        },
        loopAnimationProps(rule, durationMs, phase),
      ]}
    />
  );
});
LoopLine.displayName = 'LoopLine';

const styles = StyleSheet.create({
  node: { position: 'absolute', top: 0, left: 0 },
});
