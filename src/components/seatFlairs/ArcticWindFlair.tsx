/**
 * ArcticWindFlair — 极地寒风
 *
 * 6 条水平风速线从右向左吹过，带冰粒子偏移。
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
import { AnimatedCircle, AnimatedLine } from './svgAnimatedPrimitives';

const STREAK_COUNT = 6;

interface StreakSeed {
  yFrac: number;
  phase: number;
  length: number;
}

const StreakParticle = memo<{ seed: StreakSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const lineProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const xStart = size * (1.1 - t * 1.3);
      const xEnd = xStart - seed.length * size;
      const y = seed.yFrac * size + Math.sin(t * Math.PI * 3) * size * 0.02;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.35;
      return {
        x1: xStart,
        y1: y,
        x2: xEnd,
        y2: y,
        opacity: alpha,
        strokeWidth: size * 0.008,
      } as Record<string, number>;
    });

    const iceProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const x = size * (1.1 - t * 1.3) - seed.length * size * 0.5;
      const y = seed.yFrac * size + Math.sin(t * Math.PI * 3) * size * 0.02 - size * 0.015;
      const alpha = t < 0.15 ? 0 : t > 0.85 ? (1 - t) / 0.15 : 0.45;
      return { cx: x, cy: y, r: size * 0.006, opacity: alpha } as Record<string, number>;
    });

    return (
      <>
        <AnimatedLine animatedProps={lineProps} stroke="rgb(180,220,255)" strokeLinecap="round" />
        <AnimatedCircle animatedProps={iceProps} fill="rgb(220,240,255)" />
      </>
    );
  },
);
StreakParticle.displayName = 'StreakParticle';

export const ArcticWindFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: STREAK_COUNT }, (_, i) => ({
        yFrac: 0.15 + (i * 0.7) / (STREAK_COUNT - 1),
        phase: i / STREAK_COUNT,
        length: 0.15 + (i % 3) * 0.06,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <StreakParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
ArcticWindFlair.displayName = 'ArcticWindFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
