/**
 * ThornVineFlair — 荆棘缠绕
 *
 * 4 条荆棘藤蔓从四角向中心生长，带尖刺粒子。
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
import { AnimatedCircle, AnimatedPath } from './svgAnimatedPrimitives';

interface VineSeed {
  startX: number;
  startY: number;
  ctrlX: number;
  ctrlY: number;
  endX: number;
  endY: number;
  phase: number;
}

const VineParticle = memo<{ seed: VineSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const vineProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const growFrac = Math.min(t * 2, 1);
      const sx = seed.startX * size;
      const sy = seed.startY * size;
      const mx = sx + (seed.ctrlX * size - sx) * growFrac;
      const my = sy + (seed.ctrlY * size - sy) * growFrac;
      const ex = sx + (seed.endX * size - sx) * growFrac;
      const ey = sy + (seed.endY * size - sy) * growFrac;
      const d = `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`;
      const alpha = t > 0.7 ? (1 - t) / 0.3 : 0.4;
      return { d, opacity: alpha, strokeWidth: size * 0.012 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const thornProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const growFrac = Math.min(t * 2, 1);
      const midX = seed.startX * size + (seed.ctrlX * size - seed.startX * size) * growFrac * 0.5;
      const midY = seed.startY * size + (seed.ctrlY * size - seed.startY * size) * growFrac * 0.5;
      const alpha = growFrac > 0.3 ? (t > 0.7 ? (1 - t) / 0.3 : 0.5) : 0;
      return { cx: midX, cy: midY - size * 0.02, r: size * 0.008, opacity: alpha } as Record<
        string,
        number
      >;
    });

    const tipProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const growFrac = Math.min(t * 2, 1);
      const ex = seed.startX * size + (seed.endX * size - seed.startX * size) * growFrac;
      const ey = seed.startY * size + (seed.endY * size - seed.startY * size) * growFrac;
      const alpha = growFrac > 0.5 ? (t > 0.7 ? (1 - t) / 0.3 : 0.6) : 0;
      return { cx: ex, cy: ey, r: size * 0.01, opacity: alpha } as Record<string, number>;
    });

    return (
      <>
        <AnimatedPath
          animatedProps={vineProps}
          stroke="rgb(60,80,40)"
          fill="none"
          strokeLinecap="round"
        />
        <AnimatedCircle animatedProps={thornProps} fill="rgb(100,60,30)" />
        <AnimatedCircle animatedProps={tipProps} fill="rgb(80,100,50)" />
      </>
    );
  },
);
VineParticle.displayName = 'VineParticle';

export const ThornVineFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo<VineSeed[]>(
    () => [
      { startX: 0, startY: 0, ctrlX: 0.3, ctrlY: 0.2, endX: 0.45, endY: 0.45, phase: 0 },
      { startX: 1, startY: 0, ctrlX: 0.7, ctrlY: 0.25, endX: 0.55, endY: 0.45, phase: 0.25 },
      { startX: 0, startY: 1, ctrlX: 0.25, ctrlY: 0.7, endX: 0.45, endY: 0.55, phase: 0.5 },
      { startX: 1, startY: 1, ctrlX: 0.75, ctrlY: 0.75, endX: 0.55, endY: 0.55, phase: 0.75 },
    ],
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <VineParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
ThornVineFlair.displayName = 'ThornVineFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
