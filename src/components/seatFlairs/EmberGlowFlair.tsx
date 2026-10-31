/**
 * EmberGlowFlair — Ember Glow
 *
 * 6 orange/amber dots slowly rise from the bottom, fading as they ascend, then reset.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 4000;
const PARTICLE_COUNT = 6;
const COLORS = [
  [255, 140, 0],
  [255, 180, 50],
  [255, 100, 20],
  [255, 160, 30],
  [255, 200, 80],
  [255, 120, 10],
] as const;

const EMBER_SEEDS = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  xFrac: 0.15 + (i * 0.7) / (PARTICLE_COUNT - 1),
  phase: i / PARTICLE_COUNT,
  rFrac: 0.02 + (i % 3) * 0.008,
  ci: i % COLORS.length,
}));

const EMBER_SAMPLERS: readonly DotSampler[] = EMBER_SEEDS.map((seed) => (t, size) => {
  const y = size * (1 - t);
  const x = seed.xFrac * size + Math.sin(t * Math.PI * 2) * size * 0.04;
  const r = seed.rFrac * size;
  const alpha = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1;
  return { cx: x, cy: y, r, opacity: alpha * 0.8 };
});

function emberColor(ci: number): string {
  const [cr, cg, cb] = COLORS[ci]!;
  return `rgb(${cr},${cg},${cb})`;
}

export const EmberGlowFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {EMBER_SEEDS.map((seed, i) => (
      <LoopDot
        key={`ember-${seed.xFrac}`}
        sample={EMBER_SAMPLERS[i]!}
        size={size}
        durationMs={LOOP_MS}
        phase={seed.phase}
        color={emberColor(seed.ci)}
      />
    ))}
  </View>
));
EmberGlowFlair.displayName = 'EmberGlowFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
