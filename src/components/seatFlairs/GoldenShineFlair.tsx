/**
 * GoldenShineFlair — Golden Shine
 *
 * 10 golden light dots randomly bloom and fade around the avatar, simulating a sparkle effect.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 3000;
const N = 10;

const SPARKLE_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle: (i / N) * Math.PI * 2 + i * 0.3,
  dist: 0.32 + (i % 4) * 0.06,
  phase: i / N,
  rFrac: 0.012 + (i % 3) * 0.006,
}));

type SparkleSeed = (typeof SPARKLE_SEEDS)[number];

function sparkleFrame(seed: SparkleSeed, t: number, size: number) {
  const cx = size / 2;
  const cy = size / 2;
  const flash = Math.max(0, 1 - Math.abs(t - 0.3) * 5);
  const d = seed.dist * size * (0.9 + flash * 0.2);
  const x = cx + Math.cos(seed.angle) * d;
  const y = cy + Math.sin(seed.angle) * d;
  const r = seed.rFrac * size * (0.5 + flash);
  return { x, y, r, flash };
}

const GLOW_SAMPLERS: readonly DotSampler[] = SPARKLE_SEEDS.map((seed) => (t, size) => {
  const { x, y, r, flash } = sparkleFrame(seed, t, size);
  return { cx: x, cy: y, r: r * 2, opacity: flash < 0.01 ? 0 : flash * 0.3 };
});

const CORE_SAMPLERS: readonly DotSampler[] = SPARKLE_SEEDS.map((seed) => (t, size) => {
  const { x, y, r, flash } = sparkleFrame(seed, t, size);
  return { cx: x, cy: y, r, opacity: flash < 0.01 ? 0 : flash * 0.9 };
});

export const GoldenShineFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {SPARKLE_SEEDS.map((seed, i) => (
      <Fragment key={`shine-${seed.angle}`}>
        <LoopDot
          sample={GLOW_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(255,220,100)"
        />
        <LoopDot
          sample={CORE_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(255,200,50)"
        />
      </Fragment>
    ))}
  </View>
));
GoldenShineFlair.displayName = 'GoldenShineFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
