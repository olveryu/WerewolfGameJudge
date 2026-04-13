/**
 * BloodMarkFlair — 血月印记
 *
 * 4 颗暗红血滴从顶部滑落，拉长尾迹，到底部消散后循环。
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

const N = 4;
const TRAIL_LEN = 3;

interface DropSeed {
  xFrac: number;
  phase: number;
  rFrac: number;
}

const BloodDrop = memo<{ seed: DropSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const mainProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const x = seed.xFrac * size;
      const y = t * size;
      const r = seed.rFrac * size;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.85;
      return { cx: x, cy: y, r, opacity: alpha } as Record<string, number>;
    });

    const trail1Props = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const x = seed.xFrac * size;
      const y = t * size;
      const r = seed.rFrac * size;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.85;
      return {
        cx: x,
        cy: y - 1 * r * 1.5,
        r: r * (1 - 1 * 0.15),
        opacity: alpha * (1 - 1 / (TRAIL_LEN + 1)) * 0.6,
      } as Record<string, number>;
    });

    const trail2Props = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const x = seed.xFrac * size;
      const y = t * size;
      const r = seed.rFrac * size;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.85;
      return {
        cx: x,
        cy: y - 2 * r * 1.5,
        r: r * (1 - 2 * 0.15),
        opacity: alpha * (1 - 2 / (TRAIL_LEN + 1)) * 0.6,
      } as Record<string, number>;
    });

    const trail3Props = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const x = seed.xFrac * size;
      const y = t * size;
      const r = seed.rFrac * size;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.85;
      return {
        cx: x,
        cy: y - 3 * r * 1.5,
        r: r * (1 - 3 * 0.15),
        opacity: alpha * (1 - 3 / (TRAIL_LEN + 1)) * 0.6,
      } as Record<string, number>;
    });

    return (
      <>
        <AnimatedCircle animatedProps={trail3Props} fill="rgb(140,10,10)" />
        <AnimatedCircle animatedProps={trail2Props} fill="rgb(140,10,10)" />
        <AnimatedCircle animatedProps={trail1Props} fill="rgb(140,10,10)" />
        <AnimatedCircle animatedProps={mainProps} fill="rgb(180,20,20)" />
      </>
    );
  },
);
BloodDrop.displayName = 'BloodDrop';

export const BloodMarkFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        xFrac: 0.2 + (i * 0.6) / (N - 1),
        phase: i / N,
        rFrac: 0.018 + (i % 2) * 0.006,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <BloodDrop key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
BloodMarkFlair.displayName = 'BloodMarkFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
