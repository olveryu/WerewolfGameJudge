/**
 * RainDropFlair — Rainfall
 *
 * 12 diagonal raindrops fall with trailing streaks and small splash rings at the bottom.
 * Each drop runs at its own `speed`, so the phase stays inside the sampler.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type LineSampler, LoopLine, LoopRing, type RingSampler } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 4000;
const N = 12;

/** Splash threshold on the per-drop clock `tt = (t * speed + phase) % 1`. */
const SPLASH_START = 0.85;

const RAIN_SEEDS = Array.from({ length: N }, (_, i) => {
  const phase = i / N;
  const speed = 0.7 + (i % 4) * 0.1;
  return {
    xFrac: 0.05 + (i * 0.9) / (N - 1),
    phase,
    lenFrac: 0.03 + (i % 3) * 0.015,
    speed,
    /** `tt` peaks at `speed + phase` within one loop; below the threshold the splash never shows. */
    hasSplash: speed + phase > SPLASH_START,
  };
});

const STREAK_SAMPLERS: readonly LineSampler[] = RAIN_SEEDS.map((seed) => (t, size) => {
  const tt = (t * seed.speed + seed.phase) % 1;
  const y = tt * size * 1.1 - size * 0.05;
  const x = seed.xFrac * size + tt * size * 0.08;
  const alpha = tt < 0.05 ? tt / 0.05 : tt > 0.9 ? (1 - tt) / 0.1 : 0.5;
  const len = seed.lenFrac * size;
  return {
    x1: x,
    y1: y,
    x2: x - 1,
    y2: y - len,
    opacity: alpha * 0.7,
    strokeWidth: 0.8,
  };
});

const SPLASH_SAMPLERS: readonly RingSampler[] = RAIN_SEEDS.map((seed) => (t, size) => {
  const tt = (t * seed.speed + seed.phase) % 1;
  if (tt <= SPLASH_START) {
    return { cx: 0, cy: 0, r: 0, opacity: 0, strokeWidth: 0.5 };
  }
  const y = tt * size * 1.1 - size * 0.05;
  const x = seed.xFrac * size + tt * size * 0.08;
  const splash = (tt - SPLASH_START) / 0.15;
  const splashAlpha = (1 - splash) * 0.4;
  const splashR = splash * size * 0.02;
  return { cx: x, cy: y, r: splashR, opacity: splashAlpha, strokeWidth: 0.5 };
});

export const RainDropFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {RAIN_SEEDS.map((seed, i) => (
      <Fragment key={`drop-${seed.xFrac}`}>
        <LoopLine
          sample={STREAK_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          color="rgb(150,190,230)"
        />
        {seed.hasSplash && (
          <LoopRing
            sample={SPLASH_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            color="rgb(150,190,230)"
          />
        )}
      </Fragment>
    ))}
  </View>
));
RainDropFlair.displayName = 'RainDropFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
