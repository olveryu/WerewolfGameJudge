/**
 * SakuraFlair — 樱花飘落
 *
 * 6 片樱花花瓣从上方飘落，左右轻摆，到底部渐隐后循环。
 * 每片花瓣用 5 个紧密圆点模拟椭圆形状。
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

const N = 6;

interface PetalSeed {
  xFrac: number;
  phase: number;
  swayAmp: number;
  swayFreq: number;
}

const Petal = memo<{ seed: PetalSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const r = size * 0.015;

    const centerProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const y = t * size;
      const x = seed.xFrac * size + Math.sin(t * Math.PI * 2 * seed.swayFreq) * size * seed.swayAmp;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.7;
      return { cx: x, cy: y, opacity: alpha } as Record<string, number>;
    });

    const fwdProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const y = t * size;
      const x = seed.xFrac * size + Math.sin(t * Math.PI * 2 * seed.swayFreq) * size * seed.swayAmp;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.7;
      const a = t * Math.PI;
      const dx = Math.cos(a) * r * 0.6;
      const dy = Math.sin(a) * r * 0.6;
      return { cx: x + dx, cy: y + dy, opacity: alpha } as Record<string, number>;
    });

    const bwdProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const y = t * size;
      const x = seed.xFrac * size + Math.sin(t * Math.PI * 2 * seed.swayFreq) * size * seed.swayAmp;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.7;
      const a = t * Math.PI;
      const dx = Math.cos(a) * r * 0.6;
      const dy = Math.sin(a) * r * 0.6;
      return { cx: x - dx, cy: y - dy, opacity: alpha } as Record<string, number>;
    });

    const sideAProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const y = t * size;
      const x = seed.xFrac * size + Math.sin(t * Math.PI * 2 * seed.swayFreq) * size * seed.swayAmp;
      const alpha = (t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.7) * 0.6;
      const a = t * Math.PI;
      const dx = Math.cos(a) * r * 0.6;
      const dy = Math.sin(a) * r * 0.6;
      return { cx: x + dy, cy: y - dx, opacity: alpha } as Record<string, number>;
    });

    const sideBProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const y = t * size;
      const x = seed.xFrac * size + Math.sin(t * Math.PI * 2 * seed.swayFreq) * size * seed.swayAmp;
      const alpha = (t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.7) * 0.6;
      const a = t * Math.PI;
      const dx = Math.cos(a) * r * 0.6;
      const dy = Math.sin(a) * r * 0.6;
      return { cx: x - dy, cy: y + dx, opacity: alpha } as Record<string, number>;
    });

    return (
      <>
        <AnimatedCircle animatedProps={centerProps} r={r} fill="rgb(255,183,197)" />
        <AnimatedCircle animatedProps={fwdProps} r={r * 0.8} fill="rgb(255,183,197)" />
        <AnimatedCircle animatedProps={bwdProps} r={r * 0.8} fill="rgb(255,183,197)" />
        <AnimatedCircle animatedProps={sideAProps} r={r * 0.6} fill="rgb(255,210,220)" />
        <AnimatedCircle animatedProps={sideBProps} r={r * 0.6} fill="rgb(255,210,220)" />
      </>
    );
  },
);
Petal.displayName = 'Petal';

export const SakuraFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        xFrac: 0.1 + (i * 0.8) / (N - 1),
        phase: i / N,
        swayAmp: 0.04 + (i % 3) * 0.02,
        swayFreq: 1.5 + (i % 2) * 0.5,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <Petal key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
SakuraFlair.displayName = 'SakuraFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
