/**
 * LoopLayer — any static content moved by a looping `(t, size) => {x, y, rotateDeg, …}` sampler.
 *
 * Boundary: presentation only. Escape hatch for shapes the dedicated primitives do not cover
 * (rotating SVG groups, translating glyphs, cross-faded path variants). The children render once;
 * the sampler positions the `width × height` box by its centre at `(x, y)` and applies rotation,
 * scale and opacity — compositor-only. Sampled once per `(sample, size)` into a shared keyframes
 * rule. `sample` must be a module-level pure function — it is the cache key.
 */
import { memo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  createLoopRuleCache,
  loopAnimationProps,
  type LoopFrame,
  type LoopSampler,
} from './loopKeyframes';

/** Box placement at loop progress `t`; `(x, y)` is the box centre in tile pixel space. */
export interface LayerFrame {
  x: number;
  y: number;
  rotateDeg: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
}

export type LayerSampler = LoopSampler<LayerFrame>;

export interface LoopLayerProps {
  sample: LayerSampler;
  /** Tile pixel size forwarded to `sample`. */
  size: number;
  /** Loop length in ms. */
  durationMs: number;
  /** Cycle offset in `[0, 1)`; defaults to 0. */
  phase?: number;
  /** Box width in px; the box is centred on the sampled `(x, y)`. */
  width: number;
  /** Box height in px. */
  height: number;
  children: ReactNode;
}

const getRule = createLoopRuleCache<LayerFrame, null>((layers) => {
  const frames: LoopFrame[] = layers.map((l) => ({
    translateX: l.x,
    translateY: l.y,
    rotateDeg: l.rotateDeg,
    scaleX: l.scaleX,
    scaleY: l.scaleY,
    opacity: l.opacity,
  }));
  return { frames, layout: null };
});

export const LoopLayer = memo<LoopLayerProps>(
  ({ sample, size, durationMs, phase = 0, width, height, children }) => {
    const { rule } = getRule(sample, size);
    return (
      <Animated.View
        style={[
          styles.node,
          { width, height, left: -width / 2, top: -height / 2 },
          loopAnimationProps(rule, durationMs, phase),
        ]}
      >
        {children}
      </Animated.View>
    );
  },
);
LoopLayer.displayName = 'LoopLayer';

const styles = StyleSheet.create({
  node: { position: 'absolute' },
});
