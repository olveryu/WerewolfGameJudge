/**
 * SnowfallFlair — 纷飞白雪
 *
 * 10 片雪花从上方飘落，每片用 3 条交叉线绘制六角星形，缓慢旋转。
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

const N = 10;

interface SnowflakeSeed {
  xFrac: number;
  phase: number;
  rFrac: number;
  speed: number;
  sway: number;
}

const SnowflakeParticle = memo<{ seed: SnowflakeSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const line0Props = useAnimatedProps(() => {
      'worklet';
      const tt = (progress.value * seed.speed + seed.phase) % 1;
      const y = tt * size;
      const x = seed.xFrac * size + Math.sin(tt * Math.PI * 4) * size * seed.sway;
      const alpha = tt < 0.05 ? tt / 0.05 : tt > 0.9 ? (1 - tt) / 0.1 : 0.7;
      const r = seed.rFrac * size;
      const ang = (0 / 3) * Math.PI + tt * Math.PI;
      return {
        x1: x - Math.cos(ang) * r,
        y1: y - Math.sin(ang) * r,
        x2: x + Math.cos(ang) * r,
        y2: y + Math.sin(ang) * r,
        opacity: alpha * 0.8,
        strokeWidth: 0.8,
      } as Record<string, number>;
    });

    const line1Props = useAnimatedProps(() => {
      'worklet';
      const tt = (progress.value * seed.speed + seed.phase) % 1;
      const y = tt * size;
      const x = seed.xFrac * size + Math.sin(tt * Math.PI * 4) * size * seed.sway;
      const alpha = tt < 0.05 ? tt / 0.05 : tt > 0.9 ? (1 - tt) / 0.1 : 0.7;
      const r = seed.rFrac * size;
      const ang = (1 / 3) * Math.PI + tt * Math.PI;
      return {
        x1: x - Math.cos(ang) * r,
        y1: y - Math.sin(ang) * r,
        x2: x + Math.cos(ang) * r,
        y2: y + Math.sin(ang) * r,
        opacity: alpha * 0.8,
        strokeWidth: 0.8,
      } as Record<string, number>;
    });

    const line2Props = useAnimatedProps(() => {
      'worklet';
      const tt = (progress.value * seed.speed + seed.phase) % 1;
      const y = tt * size;
      const x = seed.xFrac * size + Math.sin(tt * Math.PI * 4) * size * seed.sway;
      const alpha = tt < 0.05 ? tt / 0.05 : tt > 0.9 ? (1 - tt) / 0.1 : 0.7;
      const r = seed.rFrac * size;
      const ang = (2 / 3) * Math.PI + tt * Math.PI;
      return {
        x1: x - Math.cos(ang) * r,
        y1: y - Math.sin(ang) * r,
        x2: x + Math.cos(ang) * r,
        y2: y + Math.sin(ang) * r,
        opacity: alpha * 0.8,
        strokeWidth: 0.8,
      } as Record<string, number>;
    });

    const centerProps = useAnimatedProps(() => {
      'worklet';
      const tt = (progress.value * seed.speed + seed.phase) % 1;
      const y = tt * size;
      const x = seed.xFrac * size + Math.sin(tt * Math.PI * 4) * size * seed.sway;
      const alpha = tt < 0.05 ? tt / 0.05 : tt > 0.9 ? (1 - tt) / 0.1 : 0.7;
      return { cx: x, cy: y, r: size * 0.005, opacity: alpha * 0.9 } as Record<string, number>;
    });

    return (
      <>
        <AnimatedLine animatedProps={line0Props} stroke="rgb(220,230,255)" />
        <AnimatedLine animatedProps={line1Props} stroke="rgb(220,230,255)" />
        <AnimatedLine animatedProps={line2Props} stroke="rgb(220,230,255)" />
        <AnimatedCircle animatedProps={centerProps} fill="rgb(240,245,255)" />
      </>
    );
  },
);
SnowflakeParticle.displayName = 'SnowflakeParticle';

export const SnowfallFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        xFrac: 0.05 + (i * 0.9) / (N - 1),
        phase: i / N,
        rFrac: 0.008 + (i % 3) * 0.005,
        speed: 0.4 + (i % 4) * 0.1,
        sway: 0.02 + (i % 3) * 0.015,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <SnowflakeParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
SnowfallFlair.displayName = 'SnowfallFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
