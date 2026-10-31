/**
 * SandStormFlairFlair — Sandstorm
 *
 * 10 sand particles orbit in a circular vortex at varying radii and speeds, each with a dust trail.
 * (Double "Flair" in filename because the ID is sandStormFlair)
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 3000;
const GRAIN_COUNT = 10;
const COLORS = [
  [210, 180, 120],
  [190, 160, 100],
  [220, 190, 130],
  [200, 170, 110],
  [230, 200, 140],
] as const;

const GRAIN_SEEDS = Array.from({ length: GRAIN_COUNT }, (_, i) => ({
  orbitR: 0.25 + (i % 4) * 0.07,
  angleOff: (i / GRAIN_COUNT) * Math.PI * 2,
  speed: 1 + (i % 3) * 0.4,
  phase: i / GRAIN_COUNT,
  rFrac: 0.008 + (i % 3) * 0.004,
  ci: i % COLORS.length,
}));

const MAIN_SAMPLERS: readonly DotSampler[] = GRAIN_SEEDS.map((seed) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const angle = t * Math.PI * 2 * seed.speed + seed.angleOff;
  return {
    cx: cx + Math.cos(angle) * seed.orbitR * size,
    cy: cy + Math.sin(angle) * seed.orbitR * size,
    r: seed.rFrac * size,
    opacity: 0.6,
  };
});

const TRAIL_SAMPLERS: readonly DotSampler[] = GRAIN_SEEDS.map((seed) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const angle = t * Math.PI * 2 * seed.speed + seed.angleOff - 0.15;
  return {
    cx: cx + Math.cos(angle) * seed.orbitR * size,
    cy: cy + Math.sin(angle) * seed.orbitR * size,
    r: seed.rFrac * size * 1.5,
    opacity: 0.12,
  };
});

function grainColor(ci: number): string {
  const [cr, cg, cb] = COLORS[ci]!;
  return `rgb(${cr},${cg},${cb})`;
}

export const SandStormFlairFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {GRAIN_SEEDS.map((seed, i) => {
      const color = grainColor(seed.ci);
      return (
        <Fragment key={`grain-${seed.phase}`}>
          <LoopDot
            sample={TRAIL_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color={color}
          />
          <LoopDot
            sample={MAIN_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color={color}
          />
        </Fragment>
      );
    })}
  </View>
));
SandStormFlairFlair.displayName = 'SandStormFlairFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
