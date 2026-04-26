/**
 * DarkSmokeFlair — 暗烟升腾
 *
 * 5 缕暗紫烟雾从底部升起，S形路径蜿蜒，不同宽度/透明度。
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

const WISP_COUNT = 5;

interface WispSeed {
  xBase: number;
  phase: number;
  drift: number;
  width: number;
}

const WispParticle = memo<{ seed: WispSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const pathProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const base = size * seed.xBase;
      const y0 = size * (1 - t * 0.8);
      const y1 = y0 - size * 0.15;
      const y2 = y1 - size * 0.15;
      const y3 = y2 - size * 0.15;
      const dx = seed.drift * size * Math.sin(t * Math.PI * 3);
      const d = `M ${base} ${y0} Q ${base + dx} ${y1} ${base - dx * 0.5} ${y2} Q ${base + dx * 0.3} ${y3 + size * 0.05} ${base} ${y3}`;
      const alpha = t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1;
      return { d, opacity: alpha * 0.25, strokeWidth: seed.width * size } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const headProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const base = size * seed.xBase;
      const y = size * (1 - t * 0.8) - size * 0.45;
      const dx = seed.drift * size * Math.sin(t * Math.PI * 3) * 0.3;
      const alpha = t < 0.2 ? 0 : t > 0.8 ? (1 - t) / 0.2 : 0.35;
      return { cx: base + dx, cy: y, r: seed.width * size * 0.8, opacity: alpha } as Record<
        string,
        number
      >;
    });

    return (
      <>
        <AnimatedPath
          animatedProps={pathProps}
          stroke="rgb(80,60,100)"
          fill="none"
          strokeLinecap="round"
        />
        <AnimatedCircle animatedProps={headProps} fill="rgb(60,40,80)" />
      </>
    );
  },
);
WispParticle.displayName = 'WispParticle';

export const DarkSmokeFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: WISP_COUNT }, (_, i) => ({
        xBase: 0.2 + (i * 0.6) / (WISP_COUNT - 1),
        phase: i / WISP_COUNT,
        drift: 0.05 + (i % 3) * 0.02,
        width: 0.03 + (i % 2) * 0.015,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <WispParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
DarkSmokeFlair.displayName = 'DarkSmokeFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
