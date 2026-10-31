/**
 * ShadowMistFlair — Shadow mist
 *
 * 5 purple-black smoke puffs rise from the bottom and disperse, opacity fades out. Loops.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 5000;
const N = 5;

const MIST_SEEDS = Array.from({ length: N }, (_, i) => ({
  xFrac: 0.15 + (i * 0.7) / (N - 1),
  phase: i / N,
  maxR: 0.06 + (i % 3) * 0.02,
}));

const MIST_SAMPLERS: readonly DotSampler[] = MIST_SEEDS.map((seed) => (t, size) => {
  const y = size * (1 - t * 0.6);
  const x = seed.xFrac * size + Math.sin(t * Math.PI * 3) * size * 0.03;
  const r = seed.maxR * size * (0.3 + t * 0.7);
  const alpha = t < 0.1 ? t / 0.1 : (1 - t) * 0.4;
  return { cx: x, cy: y, r, opacity: alpha };
});

export const ShadowMistFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {MIST_SEEDS.map((seed, i) => (
      <LoopDot
        key={`mist-${seed.xFrac}`}
        sample={MIST_SAMPLERS[i]!}
        size={size}
        durationMs={LOOP_MS}
        phase={seed.phase}
        color="rgb(42,16,64)"
      />
    ))}
  </View>
));
ShadowMistFlair.displayName = 'ShadowMistFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
