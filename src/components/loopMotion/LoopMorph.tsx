/**
 * LoopMorph — a shape whose geometry changes over the loop, rendered as K static variants.
 *
 * Boundary: presentation only. CSS animations cannot interpolate SVG path data, so the morph
 * is discretised: `renderVariant(k)` draws the shape at loop progress `k / variantCount`, and
 * each variant's opacity follows a window around its own phase. `'crossfade'` windows are
 * triangular and form a partition of unity, so the blend tracks `sample(t).opacity`;
 * `'step'` windows are box functions for shapes that should snap (lightning, sparks).
 * Everything is compositor-only; see `loopKeyframes.ts`. `sample` must be a module-level pure
 * function — together with `variantCount` and `mode` it is the cache key.
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

/** Base opacity at loop progress `t`; variant windows multiply into it. */
export interface MorphFrame {
  opacity: number;
}

export type MorphSampler = LoopSampler<MorphFrame>;

export type MorphMode = 'crossfade' | 'step';

export interface LoopMorphProps {
  sample: MorphSampler;
  /** Tile pixel size: box edge and the value forwarded to `sample` / `renderVariant`. */
  size: number;
  /** Loop length in ms. */
  durationMs: number;
  /** Cycle offset in `[0, 1)`; defaults to 0. */
  phase?: number;
  /** Number of static variants; variant `k` is the shape at `t = k / variantCount`. */
  variantCount: number;
  mode: MorphMode;
  /** Draws the static shape for variant `k` inside a `size × size` box. */
  renderVariant: (k: number, size: number) => ReactNode;
}

const IDENTITY = { translateX: 0, translateY: 0, rotateDeg: 0, scaleX: 1, scaleY: 1 } as const;

/** Signed distance from `t` to `centre` on the unit circle, in `[-0.5, 0.5]`. */
function wrappedDistance(t: number, centre: number): number {
  const d = t - centre;
  return d - Math.round(d);
}

function windowWeight(t: number, k: number, variantCount: number, mode: MorphMode): number {
  const d = wrappedDistance(t, k / variantCount);
  if (mode === 'step') {
    return d >= 0 && d < 1 / variantCount ? 1 : 0;
  }
  return Math.max(0, 1 - Math.abs(d) * variantCount);
}

/**
 * Per-variant samplers derived from the base sampler. Memoised so each `(sample, count, mode)`
 * yields stable function references for the keyframes cache.
 */
const variantSamplerCache = new WeakMap<MorphSampler, Map<string, MorphSampler[]>>();

function getVariantSamplers(
  sample: MorphSampler,
  variantCount: number,
  mode: MorphMode,
): MorphSampler[] {
  let byKey = variantSamplerCache.get(sample);
  if (!byKey) {
    byKey = new Map();
    variantSamplerCache.set(sample, byKey);
  }
  const key = `${variantCount}:${mode}`;
  const hit = byKey.get(key);
  if (hit) return hit;
  const samplers = Array.from({ length: variantCount }, (_, k): MorphSampler => {
    return (t, size) => ({
      opacity: sample(t, size).opacity * windowWeight(t, k, variantCount, mode),
    });
  });
  byKey.set(key, samplers);
  return samplers;
}

const getRule = createLoopRuleCache<MorphFrame, null>((samples) => {
  const frames: LoopFrame[] = samples.map((s) => ({ ...IDENTITY, opacity: s.opacity }));
  return { frames, layout: null };
});

export const LoopMorph = memo<LoopMorphProps>(
  ({ sample, size, durationMs, phase = 0, variantCount, mode, renderVariant }) => {
    if (!Number.isInteger(variantCount) || variantCount < 2) {
      throw new Error(`LoopMorph requires an integer variantCount >= 2, received ${variantCount}`);
    }
    const samplers = getVariantSamplers(sample, variantCount, mode);
    return (
      <>
        {samplers.map((variantSampler, k) => (
          <Animated.View
            key={`variant-${k}`}
            style={[
              styles.node,
              { width: size, height: size },
              loopAnimationProps(getRule(variantSampler, size, durationMs).rule, durationMs, phase),
            ]}
          >
            {renderVariant(k, size)}
          </Animated.View>
        ))}
      </>
    );
  },
);
LoopMorph.displayName = 'LoopMorph';

const styles = StyleSheet.create({
  node: { position: 'absolute', top: 0, left: 0 },
});
