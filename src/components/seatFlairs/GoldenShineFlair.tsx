/**
 * GoldenShineFlair — 金色闪耀
 *
 * 10 颗金色光点围绕头像随机绽放又消散，模拟 sparkle 效果。
 * react-native-svg + Reanimated useAnimatedProps。
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

const N = 10;

interface SparkleSeed {
  angle: number;
  dist: number;
  phase: number;
  rFrac: number;
}

const SparkleParticle = memo<{ seed: SparkleSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const coreProps = useAnimatedProps(() => {
      'worklet';
      const cx = size / 2;
      const cy = size / 2;
      const t = (progress.value + seed.phase) % 1;
      const flash = Math.max(0, 1 - Math.abs(t - 0.3) * 5);
      const d = seed.dist * size * (0.9 + flash * 0.2);
      const x = cx + Math.cos(seed.angle) * d;
      const y = cy + Math.sin(seed.angle) * d;
      const r = seed.rFrac * size * (0.5 + flash);
      return { cx: x, cy: y, r, opacity: flash < 0.01 ? 0 : flash * 0.9 } as Record<string, number>;
    });

    const glowProps = useAnimatedProps(() => {
      'worklet';
      const cx = size / 2;
      const cy = size / 2;
      const t = (progress.value + seed.phase) % 1;
      const flash = Math.max(0, 1 - Math.abs(t - 0.3) * 5);
      const d = seed.dist * size * (0.9 + flash * 0.2);
      const x = cx + Math.cos(seed.angle) * d;
      const y = cy + Math.sin(seed.angle) * d;
      const r = seed.rFrac * size * (0.5 + flash);
      return { cx: x, cy: y, r: r * 2, opacity: flash < 0.01 ? 0 : flash * 0.3 } as Record<
        string,
        number
      >;
    });

    return (
      <>
        <AnimatedCircle animatedProps={glowProps} fill="rgb(255,220,100)" />
        <AnimatedCircle animatedProps={coreProps} fill="rgb(255,200,50)" />
      </>
    );
  },
);
SparkleParticle.displayName = 'SparkleParticle';

export const GoldenShineFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle: (i / N) * Math.PI * 2 + i * 0.3,
        dist: 0.32 + (i % 4) * 0.06,
        phase: i / N,
        rFrac: 0.012 + (i % 3) * 0.006,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <SparkleParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
GoldenShineFlair.displayName = 'GoldenShineFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
