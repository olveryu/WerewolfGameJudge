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
 * Wall-clock spacing between samples. 30 samples per animated second keeps linear segments
 * invisible for the sinusoidal / circular trajectories used by seat flairs and still resolves
 * sub-second flashes inside long cycles (e.g. a 1.2 s pulse in an 8 s loop).
 */
const LOOP_SAMPLE_INTERVAL_MS = 1000 / 30;

function sampleCountFor(durationMs: number): number {
  if (!(durationMs > 0)) {
    throw new Error(`Loop duration must be positive, received ${durationMs}`);
  }
  return Math.ceil(durationMs / LOOP_SAMPLE_INTERVAL_MS);
}

/**
 * Evaluates `sample` at `t = i / count` for `i ∈ [0, count]` — `count + 1` samples, the last at
 * `t = 1`. Returning `sample(1)` (rather than re-using `sample(0)`) at `100%` matters for
 * trajectories whose end state only *looks* like the start (a wave translated by one period, a
 * rotation that does not close): the browser restarts an iteration instantly, so interpolating
 * back to frame 0 would play a one-sample rewind every loop.
 */
function sampleLoop<G>(sample: LoopSampler<G>, size: number, count: number): G[] {
  return Array.from({ length: count + 1 }, (_, i) => sample(i / count, size));
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
 * Builds a shared keyframes rule from uniformly spaced frames: frame `i` of `n` sits at
 * `t = i / (n - 1)`, so the last frame is the `100%` keyframe (see `sampleLoop`).
 */
function buildLoopRule(frames: readonly LoopFrame[]): CSSKeyframesRule {
  if (frames.length < 2) {
    throw new Error(`buildLoopRule requires at least two frames, received ${frames.length}`);
  }
  const lastIndex = frames.length - 1;
  const keyframes: CSSAnimationKeyframes = {};
  frames.forEach((frame, i) => {
    keyframes[`${(i / lastIndex) * 100}%`] = toKeyframeBlock(frame);
  });
  return css.keyframes(keyframes);
}

/** A built rule plus the static layout the primitive needs to position its node. */
export interface LoopRule<L> {
  rule: CSSKeyframesRule;
  layout: L;
}

/**
 * Memoises `derive(samples)` per `(sampler, size, durationMs)`. `derive` receives the sampled
 * geometry and returns the frames to animate plus any layout derived from them (e.g. the max
 * radius that sizes a dot's box).
 */
export function createLoopRuleCache<G, L>(
  derive: (samples: readonly G[]) => { frames: LoopFrame[]; layout: L },
): (sample: LoopSampler<G>, size: number, durationMs: number) => LoopRule<L> {
  const cache = new WeakMap<LoopSampler<G>, Map<string, LoopRule<L>>>();
  return (sample, size, durationMs) => {
    let byKey = cache.get(sample);
    if (!byKey) {
      byKey = new Map();
      cache.set(sample, byKey);
    }
    const key = `${size}:${durationMs}`;
    const hit = byKey.get(key);
    if (hit) return hit;
    const { frames, layout } = derive(sampleLoop(sample, size, sampleCountFor(durationMs)));
    const entry: LoopRule<L> = { rule: buildLoopRule(frames), layout };
    byKey.set(key, entry);
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
