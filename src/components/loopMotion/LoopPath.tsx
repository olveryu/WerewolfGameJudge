/**
 * LoopPath — a static SVG path whose opacity / stroke width breathe on a loop.
 *
 * Boundary: presentation only. The path geometry (`d`) is fixed; `sample` drives only
 * `opacity` and `strokeWidth`. A varying stroke width is rendered as two stacked copies
 * (thinnest / thickest) whose opacities cross-fade — compositor-only, no per-frame attribute
 * writes. The SVG canvas is `size × size`, so `d` is expressed in tile pixel space. Sampled once
 * per `(sample, size)` into shared keyframes rules. `sample` must be a module-level pure
 * function — it is the cache key.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { type Linecap, type Linejoin, Path } from 'react-native-svg';

import {
  createLoopRuleCache,
  loopAnimationProps,
  type LoopFrame,
  type LoopSampler,
} from './loopKeyframes';

/** Stroke state at loop progress `t`. */
export interface PathFrame {
  strokeWidth: number;
  opacity: number;
}

export type PathSampler = LoopSampler<PathFrame>;

export interface LoopPathProps {
  sample: PathSampler;
  /** Tile pixel size: SVG canvas edge and the value forwarded to `sample`. */
  size: number;
  /** Loop length in ms. */
  durationMs: number;
  /** Cycle offset in `[0, 1)`; defaults to 0. */
  phase?: number;
  /** Path data in tile pixel space. */
  d: string;
  stroke: string;
  /** Defaults to `'none'`. */
  fill?: string;
  strokeLinecap?: Linecap;
  strokeLinejoin?: Linejoin;
  strokeDasharray?: string;
}

interface PathLayout {
  strokeMin: number;
  strokeMax: number;
}

const IDENTITY = { translateX: 0, translateY: 0, rotateDeg: 0, scaleX: 1, scaleY: 1 } as const;

function deriveLayout(samples: readonly PathFrame[]): PathLayout {
  const strokeMin = Math.min(...samples.map((s) => s.strokeWidth));
  const strokeMax = Math.max(...samples.map((s) => s.strokeWidth));
  if (!(strokeMax >= 0) || Number.isNaN(strokeMin)) {
    throw new Error('LoopPath sampler must produce finite stroke widths');
  }
  return { strokeMin, strokeMax };
}

const getThinRule = createLoopRuleCache<PathFrame, PathLayout>((samples) => {
  const layout = deriveLayout(samples);
  const frames: LoopFrame[] = samples.map((s) => ({ ...IDENTITY, opacity: s.opacity }));
  return { frames, layout };
});

const getThickRule = createLoopRuleCache<PathFrame, PathLayout>((samples) => {
  const layout = deriveLayout(samples);
  const span = layout.strokeMax - layout.strokeMin;
  const frames: LoopFrame[] = samples.map((s) => ({
    ...IDENTITY,
    opacity: s.opacity * ((s.strokeWidth - layout.strokeMin) / span),
  }));
  return { frames, layout };
});

export const LoopPath = memo<LoopPathProps>(
  ({
    sample,
    size,
    durationMs,
    phase = 0,
    d,
    stroke,
    fill = 'none',
    strokeLinecap,
    strokeLinejoin,
    strokeDasharray,
  }) => {
    const thin = getThinRule(sample, size, durationMs);
    const { strokeMin, strokeMax } = thin.layout;
    const hasVaryingStroke = strokeMax > strokeMin;
    const pathProps = { d, stroke, fill, strokeLinecap, strokeLinejoin, strokeDasharray };
    return (
      <>
        <Animated.View
          style={[
            styles.node,
            { width: size, height: size },
            loopAnimationProps(thin.rule, durationMs, phase),
          ]}
        >
          <Svg width={size} height={size}>
            <Path {...pathProps} strokeWidth={hasVaryingStroke ? strokeMin : strokeMax} />
          </Svg>
        </Animated.View>
        {hasVaryingStroke && (
          <Animated.View
            style={[
              styles.node,
              { width: size, height: size },
              loopAnimationProps(getThickRule(sample, size, durationMs).rule, durationMs, phase),
            ]}
          >
            <Svg width={size} height={size}>
              <Path {...pathProps} strokeWidth={strokeMax} />
            </Svg>
          </Animated.View>
        )}
      </>
    );
  },
);
LoopPath.displayName = 'LoopPath';

const styles = StyleSheet.create({
  node: { position: 'absolute', top: 0, left: 0 },
});
