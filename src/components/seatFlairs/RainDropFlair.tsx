/**
 * RainDropFlair — 细雨绵绵
 *
 * 12 道斜向雨滴落下，带尾迹线条，底部溅起小水花圈。
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
import { AnimatedCircle, AnimatedLine } from './svgAnimatedPrimitives';

const N = 12;

interface RainSeed {
  xFrac: number;
  phase: number;
  lenFrac: number;
  speed: number;
}

const RainParticle = memo<{ seed: RainSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const streakProps = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const tt = (t * seed.speed + seed.phase) % 1;
      const y = tt * size * 1.1 - size * 0.05;
      const x = seed.xFrac * size + tt * size * 0.08;
      const alpha = tt < 0.05 ? tt / 0.05 : tt > 0.9 ? (1 - tt) / 0.1 : 0.5;
      const len = seed.lenFrac * size;
      return {
        x1: x,
        y1: y,
        x2: x - 1,
        y2: y - len,
        opacity: alpha * 0.7,
        strokeWidth: 0.8,
      } as Record<string, number>;
    });

    const splashProps = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const tt = (t * seed.speed + seed.phase) % 1;
      if (tt <= 0.85) {
        return { cx: 0, cy: 0, r: 0, opacity: 0, strokeWidth: 0.5 } as Record<string, number>;
      }
      const y = tt * size * 1.1 - size * 0.05;
      const x = seed.xFrac * size + tt * size * 0.08;
      const splash = (tt - 0.85) / 0.15;
      const splashAlpha = (1 - splash) * 0.4;
      const splashR = splash * size * 0.02;
      return { cx: x, cy: y, r: splashR, opacity: splashAlpha, strokeWidth: 0.5 } as Record<
        string,
        number
      >;
    });

    return (
      <>
        <AnimatedLine animatedProps={streakProps} stroke="rgb(150,190,230)" />
        <AnimatedCircle animatedProps={splashProps} fill="none" stroke="rgb(150,190,230)" />
      </>
    );
  },
);
RainParticle.displayName = 'RainParticle';

export const RainDropFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        xFrac: 0.05 + (i * 0.9) / (N - 1),
        phase: i / N,
        lenFrac: 0.03 + (i % 3) * 0.015,
        speed: 0.7 + (i % 4) * 0.1,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <RainParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
RainDropFlair.displayName = 'RainDropFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
