/**
 * JadeMistFlair — 玉雾弥漫
 *
 * 5 道翡翠色雾气卷须从底部蛇形上升，AnimatedPath S 曲线 + 尖端亮点。
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

const TENDRIL_COUNT = 5;
const GREENS = [
  [60, 180, 100],
  [80, 200, 120],
  [50, 160, 90],
  [70, 190, 110],
  [90, 210, 130],
] as const;

interface TendrilSeed {
  xBase: number;
  amplitude: number;
  phase: number;
  ci: number;
}

const Tendril = memo<{ seed: TendrilSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const [cr, cg, cb] = GREENS[seed.ci]!;

    const pathProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const rise = t;
      const bx = seed.xBase * size;
      const by = size;
      const midY1 = by - rise * size * 0.35;
      const midY2 = by - rise * size * 0.65;
      const topY = by - rise * size * 0.9;
      const amp = seed.amplitude * size;
      const d = `M ${bx} ${by} C ${bx + amp} ${midY1} ${bx - amp * 0.7} ${midY2} ${bx + amp * 0.3} ${topY}`;
      const alpha = rise < 0.1 ? rise / 0.1 : rise > 0.8 ? (1 - rise) / 0.2 : 0.3;
      return { d, opacity: alpha, strokeWidth: size * 0.012 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const tipProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const rise = t;
      const bx = seed.xBase * size;
      const by = size;
      const topY = by - rise * size * 0.9;
      const amp = seed.amplitude * size;
      const alpha = rise > 0.3 && rise < 0.8 ? 0.5 : 0;
      return {
        cx: bx + amp * 0.3,
        cy: topY,
        r: size * 0.01,
        opacity: alpha,
      } as Record<string, number>;
    });

    const color = `rgb(${cr},${cg},${cb})`;
    return (
      <>
        <AnimatedPath animatedProps={pathProps} stroke={color} fill="none" strokeLinecap="round" />
        <AnimatedCircle
          animatedProps={tipProps}
          fill={`rgb(${Math.min(255, cr + 80)},${Math.min(255, cg + 50)},${Math.min(255, cb + 80)})`}
        />
      </>
    );
  },
);
Tendril.displayName = 'Tendril';

export const JadeMistFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: TENDRIL_COUNT }, (_, i) => ({
        xBase: 0.15 + (i * 0.7) / (TENDRIL_COUNT - 1),
        amplitude: 0.04 + (i % 3) * 0.025,
        phase: i / TENDRIL_COUNT,
        ci: i % GREENS.length,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <Tendril key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
JadeMistFlair.displayName = 'JadeMistFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
