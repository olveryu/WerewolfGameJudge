/**
 * AuraBurstFlair — 灵气爆发
 *
 * 3 道同心光环从中心向外扩散，不同相位，到边缘消失后重置。
 */
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

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
      return { cx, cy, r, opacity: alpha * 0.2, strokeWidth: size * 0.015 } as Record<
        string,
        number
      >;
    });

    const innerProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const r = t * size * 0.5;
      const alpha = t < 0.1 ? t / 0.1 : (1 - t) / 0.9;
      return { cx, cy, r, opacity: alpha * 0.4, strokeWidth: size * 0.006 } as Record<
        string,
        number
      >;
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
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

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
