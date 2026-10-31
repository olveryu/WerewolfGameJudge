/**
 * NightGlowFlair — Glowworms
 *
 * 8 bioluminescent particles slowly drift around the avatar with a breathing pulse (halo + bright core).
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 6000;
const COUNT = 8;
const COLORS = [
  [0, 255, 180],
  [80, 255, 200],
  [0, 200, 160],
  [40, 255, 220],
  [0, 220, 180],
  [60, 240, 200],
  [20, 255, 160],
  [0, 200, 200],
] as const;

const GLOW_SEEDS = Array.from({ length: COUNT }, (_, i) => ({
  orbitR: 0.38 + (i % 3) * 0.05,
  angleOff: (i / COUNT) * Math.PI * 2,
  phase: i / COUNT,
  pulseSpeed: 2 + (i % 3),
  ci: i % COLORS.length,
}));

type GlowSeed = (typeof GLOW_SEEDS)[number];

function glowCentre(
  t: number,
  size: number,
  seed: GlowSeed,
): { x: number; y: number; pulse: number } {
  const cx = size / 2;
  const cy = size / 2;
  const angle = t * Math.PI * 2 * 0.3 + seed.angleOff;
  const pulse = 0.5 + Math.sin(t * Math.PI * 2 * seed.pulseSpeed) * 0.5;
  return {
    x: cx + Math.cos(angle) * seed.orbitR * size,
    y: cy + Math.sin(angle) * seed.orbitR * size,
    pulse,
  };
}

const HALO_SAMPLERS: readonly DotSampler[] = GLOW_SEEDS.map((seed) => (t, size) => {
  const { x, y, pulse } = glowCentre(t, size, seed);
  return {
    cx: x,
    cy: y,
    r: size * 0.03 * (0.5 + pulse * 0.5),
    opacity: pulse * 0.15,
  };
});

const CORE_SAMPLERS: readonly DotSampler[] = GLOW_SEEDS.map((seed) => (t, size) => {
  const { x, y, pulse } = glowCentre(t, size, seed);
  return {
    cx: x,
    cy: y,
    r: size * 0.01 * (0.6 + pulse * 0.4),
    opacity: pulse * 0.7,
  };
});

export const NightGlowFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {GLOW_SEEDS.map((seed, i) => {
      const [cr, cg, cb] = COLORS[seed.ci]!;
      return (
        <Fragment key={`glow-${seed.angleOff}`}>
          <LoopDot
            sample={HALO_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color={`rgb(${cr},${cg},${cb})`}
          />
          <LoopDot
            sample={CORE_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color="rgb(200,255,230)"
          />
        </Fragment>
      );
    })}
  </View>
));
NightGlowFlair.displayName = 'NightGlowFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
