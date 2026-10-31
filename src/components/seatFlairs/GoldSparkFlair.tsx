/**
 * GoldSparkFlair — Gold Sparks
 *
 * 8 four-pointed stars burst outward from the perimeter and fade, each with a cross-shaped gleam.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, type LineSampler, LoopDot, LoopLine } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 3500;
const N = 8;

const SPARKLE_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle: (i / N) * Math.PI * 2 + i * 0.7,
  dist: 0.35 + (i % 4) * 0.04,
  phase: i / N,
  burst: 0.3 + (i % 3) * 0.1,
}));

type SparkleSeed = (typeof SPARKLE_SEEDS)[number];

/**
 * The burst runs at 1.5× loop speed with `seed.phase` added before the wrap while the angle
 * wobble follows the raw loop, so the phase is not a pure time shift and stays inside the sampler.
 */
function sparkleFrame(seed: SparkleSeed, t: number, size: number) {
  const cx = size / 2;
  const cy = size / 2;
  const tt = (t * 1.5 + seed.phase) % 1;
  const burstDist = seed.dist * size + tt * size * seed.burst;
  const angle = seed.angle + Math.sin(t * Math.PI * 2) * 0.2;
  const x = cx + Math.cos(angle) * burstDist;
  const y = cy + Math.sin(angle) * burstDist;
  const tooClose = burstDist < size * 0.25;
  const alpha = tt < 0.1 ? tt / 0.1 : (1 - tt) * 0.8;
  const armLen = size * 0.02 * (1 - tt * 0.5);
  return { x, y, tooClose, alpha, armLen };
}

const H_LINE_SAMPLERS: readonly LineSampler[] = SPARKLE_SEEDS.map((seed) => (t, size) => {
  const { x, y, tooClose, alpha, armLen } = sparkleFrame(seed, t, size);
  return {
    x1: x - armLen,
    y1: y,
    x2: x + armLen,
    y2: y,
    opacity: tooClose ? 0 : alpha * 0.8,
    strokeWidth: 1.2,
  };
});

const V_LINE_SAMPLERS: readonly LineSampler[] = SPARKLE_SEEDS.map((seed) => (t, size) => {
  const { x, y, tooClose, alpha, armLen } = sparkleFrame(seed, t, size);
  return {
    x1: x,
    y1: y - armLen,
    x2: x,
    y2: y + armLen,
    opacity: tooClose ? 0 : alpha * 0.8,
    strokeWidth: 1.2,
  };
});

const DOT_SAMPLERS: readonly DotSampler[] = SPARKLE_SEEDS.map((seed) => (t, size) => {
  const { x, y, tooClose, alpha } = sparkleFrame(seed, t, size);
  return { cx: x, cy: y, r: size * 0.01, opacity: tooClose ? 0 : alpha * 0.9 };
});

export const GoldSparkFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {SPARKLE_SEEDS.map((seed, i) => (
      <Fragment key={`spark-${seed.angle}`}>
        <LoopLine
          sample={H_LINE_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          color="rgb(255,210,60)"
        />
        <LoopLine
          sample={V_LINE_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          color="rgb(255,210,60)"
        />
        <LoopDot
          sample={DOT_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          color="rgb(255,240,150)"
        />
      </Fragment>
    ))}
  </View>
));
GoldSparkFlair.displayName = 'GoldSparkFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
