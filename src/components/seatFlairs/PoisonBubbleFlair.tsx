/**
 * PoisonBubbleFlair — poison bubbles
 *
 * 8 green bubbles rise from the bottom with highlight reflection points and fade out at the top.
 * Each bubble runs at its own `speed`, so the phase stays inside the sampler.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot, LoopRing, type RingSampler } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 5000;
const N = 8;

const BUBBLE_SEEDS = Array.from({ length: N }, (_, i) => ({
  xFrac: 0.15 + (i * 0.7) / (N - 1),
  phase: i / N,
  rFrac: 0.02 + (i % 3) * 0.008,
  speed: 0.6 + (i % 4) * 0.1,
}));

const OUTLINE_SAMPLERS: readonly RingSampler[] = BUBBLE_SEEDS.map((seed) => (t, size) => {
  const tt = (t * seed.speed + seed.phase) % 1;
  const y = size * (1 - tt * 0.9) - size * 0.05;
  const x = seed.xFrac * size + Math.sin(tt * Math.PI * 2) * size * 0.03;
  const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.85 ? (1 - tt) / 0.15 : 0.6;
  const r = seed.rFrac * size * (1 + tt * 0.3);
  return { cx: x, cy: y, r, strokeWidth: 1, opacity: alpha * 0.7 };
});

const HIGHLIGHT_SAMPLERS: readonly DotSampler[] = BUBBLE_SEEDS.map((seed) => (t, size) => {
  const tt = (t * seed.speed + seed.phase) % 1;
  const y = size * (1 - tt * 0.9) - size * 0.05;
  const x = seed.xFrac * size + Math.sin(tt * Math.PI * 2) * size * 0.03;
  const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.85 ? (1 - tt) / 0.15 : 0.6;
  const r = seed.rFrac * size * (1 + tt * 0.3);
  return { cx: x - r * 0.3, cy: y - r * 0.3, r: r * 0.25, opacity: alpha * 0.5 };
});

export const PoisonBubbleFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {BUBBLE_SEEDS.map((seed, i) => (
      <Fragment key={`bubble-${seed.xFrac}`}>
        <LoopRing
          sample={OUTLINE_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          color="rgb(80,220,80)"
        />
        <LoopDot
          sample={HIGHLIGHT_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          color="rgb(150,255,150)"
        />
      </Fragment>
    ))}
  </View>
));
PoisonBubbleFlair.displayName = 'PoisonBubbleFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
