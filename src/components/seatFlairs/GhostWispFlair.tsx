/**
 * GhostWispFlair — Ghost Wisps
 *
 * 5 blue-white ghost wisps drift erratically around the perimeter, each with a 3-segment trail and glow halo.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 5000;
const N = 5;

const WISP_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle: (i / N) * Math.PI * 2,
  phase: i / N,
  orbitR: 0.3 + (i % 3) * 0.06,
}));

type WispSeed = (typeof WISP_SEEDS)[number];

/** Trail segments behind the core: segment `k` sits `k * 0.15` rad back and `k * 2` px inward. */
const TAILS = [
  { k: 1, rFrac: 0.011, alphaMul: 0.3 },
  { k: 2, rFrac: 0.008, alphaMul: 0.2 },
  { k: 3, rFrac: 0.005, alphaMul: 0.1 },
] as const;

/**
 * `seed.phase` offsets the drift / pulse rhythms independently of the loop position, so it
 * stays inside the sampler rather than becoming an `animationDelay`.
 */
function wispFrame(seed: WispSeed, t: number, size: number) {
  const cx = size / 2;
  const cy = size / 2;
  const angle = seed.angle + t * Math.PI * 1.5 + Math.sin(t * Math.PI * 4 + seed.phase * 10) * 0.3;
  const dist = seed.orbitR * size + Math.sin(t * Math.PI * 3 + seed.phase * 8) * size * 0.04;
  const pulse = 0.35 + 0.65 * Math.abs(Math.sin((t * 2.5 + seed.phase * 6) * Math.PI));
  return { cx, cy, angle, dist, pulse };
}

const GLOW_SAMPLERS: readonly DotSampler[] = WISP_SEEDS.map((seed) => (t, size) => {
  const { cx, cy, angle, dist, pulse } = wispFrame(seed, t, size);
  const x = cx + Math.cos(angle) * dist;
  const y = cy + Math.sin(angle) * dist;
  return { cx: x, cy: y, r: size * 0.04, opacity: pulse * 0.25 };
});

const CORE_SAMPLERS: readonly DotSampler[] = WISP_SEEDS.map((seed) => (t, size) => {
  const { cx, cy, angle, dist, pulse } = wispFrame(seed, t, size);
  const x = cx + Math.cos(angle) * dist;
  const y = cy + Math.sin(angle) * dist;
  return { cx: x, cy: y, r: size * 0.018, opacity: pulse * 0.9 };
});

const TAIL_SAMPLERS: readonly (readonly DotSampler[])[] = WISP_SEEDS.map((seed) =>
  TAILS.map(
    (tail): DotSampler =>
      (t, size) => {
        const { cx, cy, angle, dist, pulse } = wispFrame(seed, t, size);
        const ta = angle - tail.k * 0.15;
        const td = dist - tail.k * 2;
        return {
          cx: cx + Math.cos(ta) * td,
          cy: cy + Math.sin(ta) * td,
          r: size * tail.rFrac,
          opacity: Math.max(0, pulse * tail.alphaMul),
        };
      },
  ),
);

export const GhostWispFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {WISP_SEEDS.map((seed, i) => (
      <Fragment key={`wisp-${seed.phase}`}>
        <LoopDot
          sample={GLOW_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          color="rgb(100,200,255)"
        />
        <LoopDot
          sample={CORE_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          color="rgb(180,230,255)"
        />
        {TAILS.map((tail, k) => (
          <LoopDot
            key={`tail-${tail.k}`}
            sample={TAIL_SAMPLERS[i]![k]!}
            size={size}
            durationMs={LOOP_MS}
            color="rgb(100,200,255)"
          />
        ))}
      </Fragment>
    ))}
  </View>
));
GhostWispFlair.displayName = 'GhostWispFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
