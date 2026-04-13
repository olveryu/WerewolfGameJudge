/**
 * PhoenixFeatherFlair — 凤凰羽
 *
 * 8 根金红色羽毛从外围螺旋上升，带弧线轨迹和辉光。
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

const N = 8;

interface FeatherSeed {
  angle: number;
  phase: number;
  dist: number;
}

const FeatherParticle = memo<{ seed: FeatherSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const cx = size / 2;
    const cy = size / 2;

    const lineProps = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const tt = (t + seed.phase) % 1;
      const spiralAngle = seed.angle + tt * Math.PI * 4;
      const dist = (seed.dist + tt * 0.2) * size;
      const y0 = cy - tt * size * 0.3;
      const x0 = cx + Math.cos(spiralAngle) * dist * 0.3;
      const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.7 ? (1 - tt) / 0.3 : 0.9;
      const featherLen = size * 0.035;
      const ang = spiralAngle + Math.PI / 2;
      const dx = Math.cos(ang) * featherLen;
      const dy = Math.sin(ang) * featherLen;
      return {
        x1: x0 - dx,
        y1: y0 - dy,
        x2: x0 + dx,
        y2: y0 + dy,
        opacity: alpha * 0.8,
        strokeWidth: 2,
      } as Record<string, number>;
    });

    const glowProps = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const tt = (t + seed.phase) % 1;
      const spiralAngle = seed.angle + tt * Math.PI * 4;
      const dist = (seed.dist + tt * 0.2) * size;
      const y0 = cy - tt * size * 0.3;
      const x0 = cx + Math.cos(spiralAngle) * dist * 0.3;
      const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.7 ? (1 - tt) / 0.3 : 0.9;
      return { cx: x0, cy: y0, r: size * 0.025, opacity: alpha * 0.3 } as Record<string, number>;
    });

    return (
      <>
        <AnimatedLine animatedProps={lineProps} stroke="rgb(255,160,30)" />
        <AnimatedCircle animatedProps={glowProps} fill="rgb(255,100,20)" />
      </>
    );
  },
);
FeatherParticle.displayName = 'FeatherParticle';

export const PhoenixFeatherFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle: (i / N) * Math.PI * 2,
        phase: i / N,
        dist: 0.25 + (i % 3) * 0.08,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <FeatherParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
PhoenixFeatherFlair.displayName = 'PhoenixFeatherFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
