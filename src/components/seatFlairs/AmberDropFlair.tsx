/**
 * AmberDropFlair — 琥珀坠落
 *
 * 5 枚琥珀泪滴以钟摆弧线缓慢摇荡下落，带光泽高光点。
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

const DROP_COUNT = 5;

interface DropSeed {
  xAnchor: number;
  swingAmp: number;
  phase: number;
  rFrac: number;
}

const AmberDrop = memo<{ seed: DropSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const dropProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const y = t * size;
      const swing = Math.sin(t * Math.PI * 3) * seed.swingAmp * size;
      const cx = seed.xAnchor * size + swing;
      const r = seed.rFrac * size;
      // Teardrop: top narrow, bottom round
      const d = `M ${cx} ${y - r * 2} Q ${cx - r} ${y - r} ${cx - r} ${y} A ${r} ${r} 0 1 0 ${cx + r} ${y} Q ${cx + r} ${y - r} ${cx} ${y - r * 2} Z`;
      const alpha = t < 0.05 ? t / 0.05 : t > 0.85 ? (1 - t) / 0.15 : 0.5;
      return { d, opacity: alpha } as { d: string; opacity: number };
    });

    const glintProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const y = t * size;
      const swing = Math.sin(t * Math.PI * 3) * seed.swingAmp * size;
      const cx = seed.xAnchor * size + swing;
      const r = seed.rFrac * size;
      return {
        cx: cx - r * 0.3,
        cy: y - r * 0.3,
        r: r * 0.25,
        opacity: t > 0.1 && t < 0.8 ? 0.6 : 0,
      } as Record<string, number>;
    });

    return (
      <>
        <AnimatedPath
          animatedProps={dropProps}
          fill="rgb(200,150,40)"
          stroke="rgb(220,170,60)"
          strokeWidth={size * 0.003}
        />
        <AnimatedCircle animatedProps={glintProps} fill="rgb(255,230,150)" />
      </>
    );
  },
);
AmberDrop.displayName = 'AmberDrop';

export const AmberDropFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4500, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: DROP_COUNT }, (_, i) => ({
        xAnchor: 0.15 + (i * 0.7) / (DROP_COUNT - 1),
        swingAmp: 0.03 + (i % 3) * 0.015,
        phase: i / DROP_COUNT,
        rFrac: 0.018 + (i % 2) * 0.008,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <AmberDrop key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
AmberDropFlair.displayName = 'AmberDropFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
