/**
 * DawnLightFlair — Dawn Light
 *
 * 4 horizontal light bands slowly sweep upward from the bottom in golden gradient tones, with glimmer particles.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, type LineSampler, LoopDot, LoopLine } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 6000;
const BAND_COUNT = 4;

const BAND_SEEDS = Array.from({ length: BAND_COUNT }, (_, i) => ({
  phase: i / BAND_COUNT,
  width: 0.04 + (i % 2) * 0.02,
  xOff: 0.05 + (i % 3) * 0.03,
}));

const BAND_SAMPLERS: readonly LineSampler[] = BAND_SEEDS.map((seed) => (t, size) => {
  const y = size * (1 - t);
  const alpha = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 0.12;
  return {
    x1: seed.xOff * size,
    y1: y,
    x2: size - seed.xOff * size,
    y2: y,
    opacity: alpha,
    strokeWidth: seed.width * size,
  };
});

const glintSampler: DotSampler = (t, size) => {
  const y = size * (1 - t);
  const x = size * 0.3 + Math.sin(t * Math.PI * 4) * size * 0.2;
  const alpha = t > 0.3 && t < 0.7 ? 0.5 : 0;
  return { cx: x, cy: y, r: size * 0.008, opacity: alpha };
};

export const DawnLightFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {BAND_SEEDS.map((seed, i) => (
      <Fragment key={`band-${seed.phase}`}>
        <LoopLine
          sample={BAND_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(255,200,100)"
        />
        <LoopDot
          sample={glintSampler}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(255,240,200)"
        />
      </Fragment>
    ))}
  </View>
));
DawnLightFlair.displayName = 'DawnLightFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
