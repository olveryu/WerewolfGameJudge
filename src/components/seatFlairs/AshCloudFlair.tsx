/**
 * AshCloudFlair — Ash Cloud
 *
 * 10 ash particles drift slowly through the air in irregular Brownian motion.
 * Each particle = hazy outer halo + solid grain core.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 6000;
const ASH_COUNT = 10;

const ASH_SEEDS = Array.from({ length: ASH_COUNT }, (_, i) => ({
  cx0: 0.1 + (i % 5) * 0.2,
  cy0: 0.1 + Math.floor(i / 5) * 0.4,
  driftX: ((i % 3) - 1) * 0.06,
  driftY: -0.05 + (i % 2) * 0.03,
  phase: i / ASH_COUNT,
  rFrac: 0.006 + (i % 3) * 0.003,
}));

type AshSeed = (typeof ASH_SEEDS)[number];

function ashCentre(t: number, size: number, seed: AshSeed): { cx: number; cy: number } {
  const wobbleX = Math.sin(t * Math.PI * 3 + seed.driftX * 10) * size * 0.03;
  const wobbleY = Math.cos(t * Math.PI * 2.5 + seed.driftY * 8) * size * 0.025;
  const cx = seed.cx0 * size + seed.driftX * size * t + wobbleX;
  const cy = seed.cy0 * size + seed.driftY * size * t + wobbleY;
  return { cx, cy };
}

const HALO_SAMPLERS: readonly DotSampler[] = ASH_SEEDS.map((seed) => (t, size) => {
  const { cx, cy } = ashCentre(t, size, seed);
  const flicker = 0.08 + Math.sin(t * Math.PI * 5 + seed.phase * 12) * 0.05;
  return { cx, cy, r: seed.rFrac * size * 2.5, opacity: flicker };
});

const CORE_SAMPLERS: readonly DotSampler[] = ASH_SEEDS.map((seed) => (t, size) => {
  const { cx, cy } = ashCentre(t, size, seed);
  const flicker = 0.15 + Math.sin(t * Math.PI * 5 + seed.phase * 12) * 0.1;
  return { cx, cy, r: seed.rFrac * size, opacity: flicker };
});

export const AshCloudFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {ASH_SEEDS.map((seed, i) => (
      <Fragment key={`ash-${seed.cx0}-${seed.cy0}`}>
        <LoopDot
          sample={HALO_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(130,120,110)"
        />
        <LoopDot
          sample={CORE_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(90,80,70)"
        />
      </Fragment>
    ))}
  </View>
));
AshCloudFlair.displayName = 'AshCloudFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
