/**
 * MoonBeamFlair — Moon Beam
 *
 * 5 vertical moonlight columns slowly sweep across the avatar area from above, with halo circles.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, type LineSampler, LoopDot, LoopLine } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 5000;
const BEAM_COUNT = 5;

const BEAM_SEEDS = Array.from({ length: BEAM_COUNT }, (_, i) => ({
  xPhase: 0.15 + (i * 0.7) / (BEAM_COUNT - 1),
  width: 0.03 + (i % 2) * 0.015,
  phase: i / BEAM_COUNT,
}));

const LINE_SAMPLERS: readonly LineSampler[] = BEAM_SEEDS.map((seed) => (t, size) => {
  const x = seed.xPhase * size + Math.sin(t * Math.PI * 2) * size * 0.15;
  const alpha = 0.08 + Math.sin(t * Math.PI * 2) * 0.06;
  return {
    x1: x,
    y1: 0,
    x2: x + size * 0.03,
    y2: size,
    opacity: alpha,
    strokeWidth: seed.width * size,
  };
});

const HALO_SAMPLERS: readonly DotSampler[] = BEAM_SEEDS.map((seed) => (t, size) => {
  const x = seed.xPhase * size + Math.sin(t * Math.PI * 2) * size * 0.15;
  const y = size * 0.15 + t * size * 0.1;
  const alpha = 0.12 + Math.sin(t * Math.PI * 4) * 0.08;
  return { cx: x, cy: y, r: size * 0.04, opacity: alpha };
});

export const MoonBeamFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {BEAM_SEEDS.map((seed, i) => (
      <Fragment key={`beam-${seed.xPhase}`}>
        <LoopLine
          sample={LINE_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(200,210,240)"
        />
        <LoopDot
          sample={HALO_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(220,230,255)"
        />
      </Fragment>
    ))}
  </View>
));
MoonBeamFlair.displayName = 'MoonBeamFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
