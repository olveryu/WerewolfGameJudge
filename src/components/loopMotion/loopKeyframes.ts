/**
 * loopKeyframes — turns a parametric `(t, size) => geometry` loop into a shared CSS keyframes rule.
 *
 * Boundary: pure, synchronous, no React. Output feeds Reanimated's CSS animations API
 * (`animationName` + `animationDuration` + `animationIterationCount: 'infinite'`). The web
 * renderer compiles the rule to a real `@keyframes` block driven by the compositor; the native
 * renderer runs it inside Reanimated core. Neither touches the JS thread per frame.
 *
 * Only compositor-friendly properties are emitted: `transform` (translate / rotate / scale) and
 * `opacity`. The Loop* primitives convert their geometry (`cx/cy/r`, `x1/y1/x2/y2`, …) into
 * `LoopFrame`s before calling `buildLoopRule`.
 *
 * Samplers must be module-level pure functions: `createLoopRuleCache` keys its cache on the
 * sampler reference and the pixel `size`, so every seat sharing a flair shares one rule.
 */
import {
  css,
  type CSSAnimationKeyframes,
  type CSSAnimationProperties,
  type CSSKeyframesRule,
} from 'react-native-reanimated';

/** Transform + opacity for one sampled instant of a loop. */
export interface LoopFrame {
  translateX: number;
  translateY: number;
  rotateDeg: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
}

/** Pure loop sampler: progress `t ∈ [0, 1)` and tile pixel `size` → geometry. */
export type LoopSampler<G> = (t: number, size: number) => G;

/**
 * Samples per loop cycle. 60 linear segments reproduce the sinusoidal / circular trajectories
 * used by seat flairs without visible faceting at cycle lengths of 3–10 s.
 */
export const LOOP_SAMPLE_COUNT = 60;

/** Evaluates `sample` at `t = i / LOOP_SAMPLE_COUNT` for `i ∈ [0, LOOP_SAMPLE_COUNT)`. */
export function sampleLoop<G>(sample: LoopSampler<G>, size: number): G[] {
  return Array.from({ length: LOOP_SAMPLE_COUNT }, (_, i) => sample(i / LOOP_SAMPLE_COUNT, size));
}

function toKeyframeBlock(frame: LoopFrame) {
  return {
    opacity: frame.opacity,
    transform: [
      { translateX: frame.translateX },
      { translateY: frame.translateY },
      { rotate: `${frame.rotateDeg}deg` },
      { scaleX: frame.scaleX },
      { scaleY: frame.scaleY },
    ],
  };
}

/**
 * Builds a shared keyframes rule from `LOOP_SAMPLE_COUNT` frames (frame `i` is
 * `t = i / LOOP_SAMPLE_COUNT`). `100%` re-uses frame 0 so the loop closes without a seam.
 */
export function buildLoopRule(frames: readonly LoopFrame[]): CSSKeyframesRule {
  if (frames.length !== LOOP_SAMPLE_COUNT) {
    throw new Error(`buildLoopRule expects ${LOOP_SAMPLE_COUNT} frames, received ${frames.length}`);
  }
  const keyframes: CSSAnimationKeyframes = {};
  frames.forEach((frame, i) => {
    keyframes[`${(i / LOOP_SAMPLE_COUNT) * 100}%`] = toKeyframeBlock(frame);
  });
  keyframes['100%'] = toKeyframeBlock(frames[0]!);
  return css.keyframes(keyframes);
}

/** A built rule plus the static layout the primitive needs to position its node. */
export interface LoopRule<L> {
  rule: CSSKeyframesRule;
  layout: L;
}

/**
 * Memoises `derive(samples)` per `(sampler, size)`. `derive` receives the sampled geometry and
 * returns the frames to animate plus any layout derived from them (e.g. the max radius that
 * sizes a dot's box).
 */
export function createLoopRuleCache<G, L>(
  derive: (samples: readonly G[]) => { frames: LoopFrame[]; layout: L },
): (sample: LoopSampler<G>, size: number) => LoopRule<L> {
  const cache = new WeakMap<LoopSampler<G>, Map<number, LoopRule<L>>>();
  return (sample, size) => {
    let bySize = cache.get(sample);
    if (!bySize) {
      bySize = new Map();
      cache.set(sample, bySize);
    }
    const hit = bySize.get(size);
    if (hit) return hit;
    const { frames, layout } = derive(sampleLoop(sample, size));
    const entry: LoopRule<L> = { rule: buildLoopRule(frames), layout };
    bySize.set(size, entry);
    return entry;
  };
}

/**
 * Infinite, linear CSS animation settings for a sampled loop.
 *
 * `phase ∈ [0, 1)` shifts the element into the cycle via a negative `animationDelay`, so
 * elements sharing one sampler share one keyframes rule while staying out of sync.
 */
export function loopAnimationProps(
  rule: CSSKeyframesRule,
  durationMs: number,
  phase: number,
): CSSAnimationProperties {
  return {
    animationName: rule,
    animationDuration: durationMs,
    animationDelay: -phase * durationMs,
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  };
}
