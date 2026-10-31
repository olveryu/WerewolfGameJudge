/**
 * VenomDripFlair — venom drip
 *
 * 5 venom droplets drip from the top with 3-circle trails + a splash expansion ring on landing.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot, LoopRing, type RingSampler } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 3500;
const DROP_COUNT = 5;

const DROP_SEEDS = Array.from({ length: DROP_COUNT }, (_, i) => ({
  xFrac: 0.2 + (i * 0.6) / (DROP_COUNT - 1),
  phase: i / DROP_COUNT,
  speed: 0.9 + (i % 2) * 0.1,
}));

const MAIN_SAMPLERS: readonly DotSampler[] = DROP_SEEDS.map((seed) => (t, size) => {
  const y = t * seed.speed * size;
  const alpha = t > 0.85 ? (1 - t) / 0.15 : 0.7;
  return { cx: seed.xFrac * size, cy: y, r: size * 0.018, opacity: alpha };
});

const TRAIL1_SAMPLERS: readonly DotSampler[] = DROP_SEEDS.map((seed) => (t, size) => {
  const y = Math.max(0, t * seed.speed * size - size * 0.04);
  return { cx: seed.xFrac * size, cy: y, r: size * 0.012, opacity: 0.4 };
});

const TRAIL2_SAMPLERS: readonly DotSampler[] = DROP_SEEDS.map((seed) => (t, size) => {
  const y = Math.max(0, t * seed.speed * size - size * 0.08);
  return { cx: seed.xFrac * size, cy: y, r: size * 0.008, opacity: 0.2 };
});

const TRAIL3_SAMPLERS: readonly DotSampler[] = DROP_SEEDS.map((seed) => (t, size) => {
  const y = Math.max(0, t * seed.speed * size - size * 0.12);
  return { cx: seed.xFrac * size, cy: y, r: size * 0.005, opacity: 0.1 };
});

const SPLASH_SAMPLERS: readonly RingSampler[] = DROP_SEEDS.map((seed) => (t, size) => {
  const splashT = t > 0.85 ? (t - 0.85) / 0.15 : 0;
  return {
    cx: seed.xFrac * size,
    cy: size * 0.92,
    r: size * 0.03 * splashT,
    strokeWidth: 1,
    opacity: (1 - splashT) * 0.3,
  };
});

export const VenomDripFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {DROP_SEEDS.map((seed, i) => (
      <Fragment key={`drop-${seed.xFrac}`}>
        <LoopDot
          sample={TRAIL3_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(80,180,40)"
        />
        <LoopDot
          sample={TRAIL2_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(80,180,40)"
        />
        <LoopDot
          sample={TRAIL1_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(100,200,60)"
        />
        <LoopDot
          sample={MAIN_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(60,160,30)"
        />
        <LoopRing
          sample={SPLASH_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(80,180,40)"
        />
      </Fragment>
    ))}
  </View>
));
VenomDripFlair.displayName = 'VenomDripFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
