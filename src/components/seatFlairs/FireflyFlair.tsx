/**
 * FireflyFlair — firefly night
 *
 * 8 fireflies wander irregularly around the perimeter with staggered blink rhythms and a warm glow halo.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 5000;
const N = 8;

const FIREFLY_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle0: (i / N) * Math.PI * 2,
  dist: 0.32 + (i % 4) * 0.05,
  phase: i / N,
  wander: 0.15 + (i % 3) * 0.08,
}));

type FireflySeed = (typeof FIREFLY_SEEDS)[number];

/**
 * `seed.phase` offsets the wander / blink rhythms independently of the loop position, so it
 * stays inside the sampler rather than becoming an `animationDelay`.
 */
function createFireflySampler(seed: FireflySeed, rFrac: number, alphaMul: number): DotSampler {
  return (t, size) => {
    const cx = size / 2;
    const cy = size / 2;
    const angle =
      seed.angle0 +
      Math.sin((t * 1.5 + seed.phase * 7) * Math.PI) * seed.wander +
      t * Math.PI * 0.3;
    const dist = seed.dist * size + Math.sin((t * 2.5 + seed.phase * 5) * Math.PI) * size * 0.04;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const blink = Math.max(0, Math.sin((t * 4 + seed.phase * 8) * Math.PI));
    const alpha = 0.1 + blink * 0.7;
    return { cx: x, cy: y, r: size * rFrac, opacity: alpha * alphaMul };
  };
}

const HALO_SAMPLERS: readonly DotSampler[] = FIREFLY_SEEDS.map((seed) =>
  createFireflySampler(seed, 0.03, 0.25),
);
const CORE_SAMPLERS: readonly DotSampler[] = FIREFLY_SEEDS.map((seed) =>
  createFireflySampler(seed, 0.012, 0.9),
);

export const FireflyFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {FIREFLY_SEEDS.map((seed, i) => (
      <Fragment key={`firefly-${seed.phase}`}>
        <LoopDot
          sample={HALO_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          color="rgb(200,230,60)"
        />
        <LoopDot
          sample={CORE_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          color="rgb(230,255,100)"
        />
      </Fragment>
    ))}
  </View>
));
FireflyFlair.displayName = 'FireflyFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
