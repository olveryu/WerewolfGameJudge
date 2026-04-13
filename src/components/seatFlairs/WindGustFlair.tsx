/**
 * WindGustFlair — 疾风粒子
 *
 * 8 条短水平划线从左吹向右，跳过中心区域，带头部光点。
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

interface WindSeed {
  yFrac: number;
  phase: number;
  speed: number;
  rFrac: number;
}

const WindParticle = memo<{
  seed: WindSeed;
  size: number;
  progress: { value: number };
  index: number;
}>(({ seed, size, progress }) => {
  const lineProps = useAnimatedProps(() => {
    'worklet';
    const cx = size / 2;
    const cy = size / 2;
    const safe = size * 0.22;
    const tt = (progress.value * seed.speed + seed.phase) % 1;
    const x = tt * size;
    const baseY = seed.yFrac * size;
    const y = baseY + Math.sin(tt * Math.PI * 3) * size * 0.04;
    const dx = x - cx;
    const dy = y - cy;
    const tooClose = dx * dx + dy * dy < safe * safe;
    const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.85 ? (1 - tt) / 0.15 : 0.5;
    const streakLen = size * 0.04;
    return {
      x1: x,
      y1: y,
      x2: x - streakLen,
      y2: y + 0.5,
      opacity: tooClose ? 0 : alpha * 0.7,
      strokeWidth: seed.rFrac * size * 2,
    } as Record<string, number>;
  });

  const dotProps = useAnimatedProps(() => {
    'worklet';
    const cx = size / 2;
    const cy = size / 2;
    const safe = size * 0.22;
    const tt = (progress.value * seed.speed + seed.phase) % 1;
    const x = tt * size;
    const baseY = seed.yFrac * size;
    const y = baseY + Math.sin(tt * Math.PI * 3) * size * 0.04;
    const dx = x - cx;
    const dy = y - cy;
    const tooClose = dx * dx + dy * dy < safe * safe;
    const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.85 ? (1 - tt) / 0.15 : 0.5;
    return { cx: x, cy: y, r: seed.rFrac * size, opacity: tooClose ? 0 : alpha * 0.6 } as Record<
      string,
      number
    >;
  });

  return (
    <>
      <AnimatedLine animatedProps={lineProps} stroke="rgb(180,230,200)" />
      <AnimatedCircle animatedProps={dotProps} fill="rgb(200,245,220)" />
    </>
  );
});
WindParticle.displayName = 'WindParticle';

export const WindGustFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        yFrac: 0.1 + (i / N) * 0.8,
        phase: i / N,
        speed: 1.2 + (i % 3) * 0.3,
        rFrac: 0.008 + (i % 4) * 0.003,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <WindParticle key={i} seed={s} size={size} progress={progress} index={i} />
        ))}
      </Svg>
    </View>
  );
});
WindGustFlair.displayName = 'WindGustFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
