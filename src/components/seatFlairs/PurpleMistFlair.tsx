/**
 * PurpleMistFlair — 紫雾缭绕
 *
 * 7 团紫色雾气在外围漂浮，大小呼吸脉冲，多层渐变模拟柔焦。
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

const N = 7;

interface MistSeed {
  angle0: number;
  dist: number;
  phase: number;
  driftSpeed: number;
  maxRFrac: number;
}

const MistParticle = memo<{ seed: MistSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const outerProps = useAnimatedProps(() => {
      'worklet';
      const cx = size / 2;
      const cy = size / 2;
      const t = progress.value;
      const angle = seed.angle0 + Math.sin((t * seed.driftSpeed + seed.phase) * Math.PI * 2) * 0.6;
      const dist = seed.dist * size + Math.sin(t * Math.PI * 2 + seed.phase * 5) * size * 0.04;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const pulse = 0.3 + 0.5 * Math.abs(Math.sin((t * 2 + seed.phase * 4) * Math.PI));
      const r = seed.maxRFrac * size * (0.6 + 0.4 * pulse);
      return { cx: x, cy: y, r, opacity: pulse * 0.08 } as Record<string, number>;
    });

    const midProps = useAnimatedProps(() => {
      'worklet';
      const cx = size / 2;
      const cy = size / 2;
      const t = progress.value;
      const angle = seed.angle0 + Math.sin((t * seed.driftSpeed + seed.phase) * Math.PI * 2) * 0.6;
      const dist = seed.dist * size + Math.sin(t * Math.PI * 2 + seed.phase * 5) * size * 0.04;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const pulse = 0.3 + 0.5 * Math.abs(Math.sin((t * 2 + seed.phase * 4) * Math.PI));
      const r = seed.maxRFrac * size * (0.6 + 0.4 * pulse);
      return { cx: x, cy: y, r: r * 0.6, opacity: pulse * 0.15 } as Record<string, number>;
    });

    const innerProps = useAnimatedProps(() => {
      'worklet';
      const cx = size / 2;
      const cy = size / 2;
      const t = progress.value;
      const angle = seed.angle0 + Math.sin((t * seed.driftSpeed + seed.phase) * Math.PI * 2) * 0.6;
      const dist = seed.dist * size + Math.sin(t * Math.PI * 2 + seed.phase * 5) * size * 0.04;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const pulse = 0.3 + 0.5 * Math.abs(Math.sin((t * 2 + seed.phase * 4) * Math.PI));
      const r = seed.maxRFrac * size * (0.6 + 0.4 * pulse);
      return { cx: x, cy: y, r: r * 0.3, opacity: pulse * 0.25 } as Record<string, number>;
    });

    return (
      <>
        <AnimatedCircle animatedProps={outerProps} fill="rgb(80,30,160)" />
        <AnimatedCircle animatedProps={midProps} fill="rgb(100,50,180)" />
        <AnimatedCircle animatedProps={innerProps} fill="rgb(140,80,200)" />
      </>
    );
  },
);
MistParticle.displayName = 'MistParticle';

export const PurpleMistFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle0: (i / N) * Math.PI * 2,
        dist: 0.35 + (i % 3) * 0.05,
        phase: i / N,
        driftSpeed: 0.3 + (i % 4) * 0.15,
        maxRFrac: 0.04 + (i % 3) * 0.02,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <MistParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
PurpleMistFlair.displayName = 'PurpleMistFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
