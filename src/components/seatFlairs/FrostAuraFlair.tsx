/**
 * FrostAuraFlair — Frost Aura
 *
 * 8 ice-blue snowflake particles float slowly around the avatar, pulsing in size and opacity at random.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 6000;
const N = 8;

const FROST_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle0: (i / N) * Math.PI * 2,
  orbitFrac: 0.42 + (i % 3) * 0.05,
  rFrac: 0.015 + (i % 4) * 0.005,
  speed: 0.8 + (i % 3) * 0.2,
  index: i,
}));

const FROST_SAMPLERS: readonly DotSampler[] = FROST_SEEDS.map((seed) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const angle = seed.angle0 + t * Math.PI * 2 * seed.speed;
  const orbit = seed.orbitFrac * size;
  const x = cx + Math.cos(angle) * orbit;
  const y = cy + Math.sin(angle) * orbit;
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 4 + seed.index);
  const alpha = 0.3 + pulse * 0.4;
  const r = seed.rFrac * size * (0.8 + pulse * 0.4);
  return { cx: x, cy: y, r, opacity: alpha };
});

export const FrostAuraFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {FROST_SEEDS.map((seed, i) => (
      <LoopDot
        key={`frost-${seed.angle0}`}
        sample={FROST_SAMPLERS[i]!}
        size={size}
        durationMs={LOOP_MS}
        color="rgb(140,220,255)"
      />
    ))}
  </View>
));
FrostAuraFlair.displayName = 'FrostAuraFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
