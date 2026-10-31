/**
 * MistVeilFlair — Mist Veil
 *
 * 5 large semi-transparent mist clouds drift past, each with a bright inner core.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 7000;
const FOG_COUNT = 5;

const FOG_SEEDS = Array.from({ length: FOG_COUNT }, (_, i) => ({
  startX: -0.1 + (i % 2) * 0.1,
  yBase: 0.2 + (i * 0.6) / (FOG_COUNT - 1),
  phase: i / FOG_COUNT,
  rFrac: 0.12 + (i % 3) * 0.04,
}));

type FogSeed = (typeof FOG_SEEDS)[number];

function fogCentre(t: number, size: number, seed: FogSeed): { x: number; y: number; fade: number } {
  const x = (seed.startX + t * 1.2 - 0.1) * size;
  const y = seed.yBase * size + Math.sin(t * Math.PI * 2) * size * 0.04;
  const fadeIn = Math.min(t * 5, 1);
  const fadeOut = Math.min((1 - t) * 5, 1);
  return { x, y, fade: fadeIn * fadeOut };
}

const OUTER_SAMPLERS: readonly DotSampler[] = FOG_SEEDS.map((seed) => (t, size) => {
  const { x, y, fade } = fogCentre(t, size, seed);
  return {
    cx: x,
    cy: y,
    r: seed.rFrac * size,
    opacity: fade * 0.06,
  };
});

const INNER_SAMPLERS: readonly DotSampler[] = FOG_SEEDS.map((seed) => (t, size) => {
  const { x, y, fade } = fogCentre(t, size, seed);
  return {
    cx: x,
    cy: y,
    r: seed.rFrac * size * 0.4,
    opacity: fade * 0.12,
  };
});

export const MistVeilFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {FOG_SEEDS.map((seed, i) => (
      <Fragment key={`fog-${seed.yBase}`}>
        <LoopDot
          sample={OUTER_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(200,210,220)"
        />
        <LoopDot
          sample={INNER_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(230,235,245)"
        />
      </Fragment>
    ))}
  </View>
));
MistVeilFlair.displayName = 'MistVeilFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
