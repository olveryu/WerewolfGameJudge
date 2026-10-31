/**
 * AuraBurstFlair — aura burst
 *
 * 3 concentric rings expand outward from center with different phases; reset after fading at the edge.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoopRing, type RingSampler } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 4000;
const RING_COUNT = 3;
const COLORS = [
  [160, 120, 255],
  [120, 180, 255],
  [180, 100, 255],
] as const;

const RING_SEEDS = Array.from({ length: RING_COUNT }, (_, i) => ({
  phase: i / RING_COUNT,
  ci: i % COLORS.length,
}));

function ringAlpha(t: number): number {
  return t < 0.1 ? t / 0.1 : (1 - t) / 0.9;
}

const outerSampler: RingSampler = (t, size) => ({
  cx: size / 2,
  cy: size / 2,
  r: t * size * 0.55,
  strokeWidth: size * 0.015,
  opacity: ringAlpha(t) * 0.2,
});

const innerSampler: RingSampler = (t, size) => ({
  cx: size / 2,
  cy: size / 2,
  r: t * size * 0.5,
  strokeWidth: size * 0.006,
  opacity: ringAlpha(t) * 0.4,
});

export const AuraBurstFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {RING_SEEDS.map((seed) => {
      const [cr, cg, cb] = COLORS[seed.ci]!;
      return (
        <Fragment key={`ring-${seed.ci}`}>
          <LoopRing
            sample={outerSampler}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color={`rgb(${cr},${cg},${cb})`}
          />
          <LoopRing
            sample={innerSampler}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color="rgb(220,210,255)"
          />
        </Fragment>
      );
    })}
  </View>
));
AuraBurstFlair.displayName = 'AuraBurstFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
