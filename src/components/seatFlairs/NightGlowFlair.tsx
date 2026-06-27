/**
 * NightGlowFlair — Glowworms
 *
 * 8 bioluminescent particles slowly drift around the avatar with a breathing pulse (halo + bright core).
 */
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useLoopProgress } from '@/hooks/useLoopProgress';

import type { FlairProps } from './FlairProps';
import { AnimatedCircle } from './svgAnimatedPrimitives';

const COUNT = 8;
const COLORS = [
  [0, 255, 180],
  [80, 255, 200],
  [0, 200, 160],
  [40, 255, 220],
  [0, 220, 180],
  [60, 240, 200],
  [20, 255, 160],
  [0, 200, 200],
] as const;

interface GlowSeed {
  orbitR: number;
  angleOff: number;
  phase: number;
  pulseSpeed: number;
  ci: number;
}

const GlowParticle = memo<{ seed: GlowSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const [cr, cg, cb] = COLORS[seed.ci]!;
    const cx = size / 2;
    const cy = size / 2;

    const haloProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const angle = t * Math.PI * 2 * 0.3 + seed.angleOff;
      const pulse = 0.5 + Math.sin(t * Math.PI * 2 * seed.pulseSpeed) * 0.5;
      return {
        cx: cx + Math.cos(angle) * seed.orbitR * size,
        cy: cy + Math.sin(angle) * seed.orbitR * size,
        r: size * 0.03 * (0.5 + pulse * 0.5),
        opacity: pulse * 0.15,
      };
    });

    const coreProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const angle = t * Math.PI * 2 * 0.3 + seed.angleOff;
      const pulse = 0.5 + Math.sin(t * Math.PI * 2 * seed.pulseSpeed) * 0.5;
      return {
        cx: cx + Math.cos(angle) * seed.orbitR * size,
        cy: cy + Math.sin(angle) * seed.orbitR * size,
        r: size * 0.01 * (0.6 + pulse * 0.4),
        opacity: pulse * 0.7,
      };
    });

    return (
      <>
        <AnimatedCircle animatedProps={haloProps} fill={`rgb(${cr},${cg},${cb})`} />
        <AnimatedCircle animatedProps={coreProps} fill="rgb(200,255,230)" />
      </>
    );
  },
);
GlowParticle.displayName = 'GlowParticle';

export const NightGlowFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useLoopProgress(6000);

  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        orbitR: 0.38 + (i % 3) * 0.05,
        angleOff: (i / COUNT) * Math.PI * 2,
        phase: i / COUNT,
        pulseSpeed: 2 + (i % 3),
        ci: i % COLORS.length,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <GlowParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
NightGlowFlair.displayName = 'NightGlowFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
