/**
 * WindGustFlair - wind gust particles
 *
 * 8 short horizontal streaks blow from left to right, skipping the central area, with a leading bright dot.
 * The seed phase is applied after the per-streak speed multiplier (`(t * speed + phase) % 1`), so it
 * stays inside the sampler instead of becoming an animation delay.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, type LineSampler, LoopDot, LoopLine } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 3000;
const N = 8;

const WIND_SEEDS = Array.from({ length: N }, (_, i) => ({
  yFrac: 0.1 + (i / N) * 0.8,
  phase: i / N,
  speed: 1.2 + (i % 3) * 0.3,
  rFrac: 0.008 + (i % 4) * 0.003,
}));

type WindSeed = (typeof WIND_SEEDS)[number];

interface WindState {
  x: number;
  y: number;
  tooClose: boolean;
  alpha: number;
}

function windState(t: number, size: number, seed: WindSeed): WindState {
  const cx = size / 2;
  const cy = size / 2;
  const safe = size * 0.22;
  const tt = (t * seed.speed + seed.phase) % 1;
  const x = tt * size;
  const baseY = seed.yFrac * size;
  const y = baseY + Math.sin(tt * Math.PI * 3) * size * 0.04;
  const dx = x - cx;
  const dy = y - cy;
  const tooClose = dx * dx + dy * dy < safe * safe;
  const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.85 ? (1 - tt) / 0.15 : 0.5;
  return { x, y, tooClose, alpha };
}

const LINE_SAMPLERS: readonly LineSampler[] = WIND_SEEDS.map((seed) => (t, size) => {
  const { x, y, tooClose, alpha } = windState(t, size, seed);
  const streakLen = size * 0.04;
  return {
    x1: x,
    y1: y,
    x2: x - streakLen,
    y2: y + 0.5,
    strokeWidth: seed.rFrac * size * 2,
    opacity: tooClose ? 0 : alpha * 0.7,
  };
});

const DOT_SAMPLERS: readonly DotSampler[] = WIND_SEEDS.map((seed) => (t, size) => {
  const { x, y, tooClose, alpha } = windState(t, size, seed);
  return { cx: x, cy: y, r: seed.rFrac * size, opacity: tooClose ? 0 : alpha * 0.6 };
});

export const WindGustFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {WIND_SEEDS.map((seed, i) => (
      <Fragment key={`wind-${seed.yFrac}`}>
        <LoopLine
          sample={LINE_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          color="rgb(180,230,200)"
        />
        <LoopDot
          sample={DOT_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          color="rgb(200,245,220)"
        />
      </Fragment>
    ))}
  </View>
));
WindGustFlair.displayName = 'WindGustFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
