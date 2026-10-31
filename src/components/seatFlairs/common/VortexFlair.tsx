/**
 * VortexFlair — vortex
 *
 * Eight particles spiral inward over two turns and fade. Rare-tier seat flair template.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const LOOP_MS = 4000;
const PARTICLE_COUNT = 8;

const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  phase: i / PARTICLE_COUNT,
  isPrimary: i % 2 === 0,
}));

/**
 * Each particle's spiral is also rotated by its phase, so the samplers differ per particle
 * even though the phase offset in time comes from `animationDelay`.
 */
const PARTICLE_SAMPLERS: readonly DotSampler[] = PARTICLES.map((particle) => (t, size) => {
  const angle = t * Math.PI * 4 + particle.phase * Math.PI * 2;
  const r = size * 0.38 * (1 - t);
  const alpha = t < 0.1 ? t / 0.1 : 1 - t;
  return {
    cx: size / 2 + Math.cos(angle) * r,
    cy: size / 2 + Math.sin(angle) * r,
    r: size * 0.01,
    opacity: alpha * 0.5,
  };
});

export const VortexFlair = memo<ColoredFlairProps>(({ size, colors }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {PARTICLES.map((particle, i) => (
      <LoopDot
        key={`particle-${particle.phase}`}
        sample={PARTICLE_SAMPLERS[i]!}
        size={size}
        durationMs={LOOP_MS}
        phase={particle.phase}
        color={particle.isPrimary ? colors.rgb : colors.rgbLight}
      />
    ))}
  </View>
));
VortexFlair.displayName = 'VortexFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
