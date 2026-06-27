/**
 * AuraBurstFlair — aura burst
 *
 * 3 concentric rings expand outward from center with different phases; reset after fading at the edge.
 */
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useLoopProgress } from '@/hooks/useLoopProgress';

import type { FlairProps } from './FlairProps';
import { AnimatedCircle } from './svgAnimatedPrimitives';

const RING_COUNT = 3;
const COLORS = [
  [160, 120, 255],
  [120, 180, 255],
  [180, 100, 255],
] as const;

interface RingSeed {
  phase: number;
  ci: number;
}

const RingParticle = memo<{ seed: RingSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const [cr, cg, cb] = COLORS[seed.ci]!;
    const cx = size / 2;
    const cy = size / 2;

    const outerProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const r = t * size * 0.55;
      const alpha = t < 0.1 ? t / 0.1 : (1 - t) / 0.9;
      return { cx, cy, r, opacity: alpha * 0.2, strokeWidth: size * 0.015 };
    });

    const innerProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const r = t * size * 0.5;
      const alpha = t < 0.1 ? t / 0.1 : (1 - t) / 0.9;
      return { cx, cy, r, opacity: alpha * 0.4, strokeWidth: size * 0.006 };
    });

    const color = `rgb(${cr},${cg},${cb})`;
    return (
      <>
        <AnimatedCircle animatedProps={outerProps} fill="none" stroke={color} />
        <AnimatedCircle animatedProps={innerProps} fill="none" stroke="rgb(220,210,255)" />
      </>
    );
  },
);
RingParticle.displayName = 'RingParticle';

export const AuraBurstFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useLoopProgress(4000);

  const seeds = useMemo(
    () =>
      Array.from({ length: RING_COUNT }, (_, i) => ({
        phase: i / RING_COUNT,
        ci: i % COLORS.length,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <RingParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
AuraBurstFlair.displayName = 'AuraBurstFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
