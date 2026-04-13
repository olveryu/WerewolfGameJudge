/**
 * MagmaFloatFlair — 熔岩浮石
 *
 * 6 块不规则熔岩球在外围浮动，由重叠圆组成，带底部热辉光。
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

interface MagmaSeed {
  angle0: number;
  dist: number;
  phase: number;
  rFrac: number;
}

const MagmaParticle = memo<{ seed: MagmaSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const bodyProps = useAnimatedProps(() => {
      'worklet';
      const cx = size / 2;
      const cy = size / 2;
      const t = progress.value;
      const tt = (t + seed.phase) % 1;
      const angle = seed.angle0 + Math.sin(tt * Math.PI * 2) * 0.3;
      const dist = seed.dist * size + Math.sin(tt * Math.PI * 4) * size * 0.03;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin((t * 3 + seed.phase * 5) * Math.PI));
      const r = seed.rFrac * size;
      return { cx: x, cy: y, r, opacity: pulse * 0.6 } as Record<string, number>;
    });

    const lobeProps = useAnimatedProps(() => {
      'worklet';
      const cx = size / 2;
      const cy = size / 2;
      const t = progress.value;
      const tt = (t + seed.phase) % 1;
      const angle = seed.angle0 + Math.sin(tt * Math.PI * 2) * 0.3;
      const dist = seed.dist * size + Math.sin(tt * Math.PI * 4) * size * 0.03;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin((t * 3 + seed.phase * 5) * Math.PI));
      const r = seed.rFrac * size;
      return { cx: x + r * 0.4, cy: y - r * 0.3, r: r * 0.7, opacity: pulse * 0.5 } as Record<
        string,
        number
      >;
    });

    const glowProps = useAnimatedProps(() => {
      'worklet';
      const cx = size / 2;
      const cy = size / 2;
      const t = progress.value;
      const tt = (t + seed.phase) % 1;
      const angle = seed.angle0 + Math.sin(tt * Math.PI * 2) * 0.3;
      const dist = seed.dist * size + Math.sin(tt * Math.PI * 4) * size * 0.03;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin((t * 3 + seed.phase * 5) * Math.PI));
      const r = seed.rFrac * size;
      return { cx: x, cy: y + r * 0.5, r: r * 1.3, opacity: pulse * 0.12 } as Record<
        string,
        number
      >;
    });

    return (
      <>
        <AnimatedCircle animatedProps={bodyProps} fill="rgb(200,60,20)" />
        <AnimatedCircle animatedProps={lobeProps} fill="rgb(240,120,20)" />
        <AnimatedCircle animatedProps={glowProps} fill="rgb(255,80,0)" />
      </>
    );
  },
);
MagmaParticle.displayName = 'MagmaParticle';

export const MagmaFloatFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle0: (i / N) * Math.PI * 2 + i * 0.4,
        dist: 0.35 + (i % 3) * 0.06,
        phase: i / N,
        rFrac: 0.018 + (i % 3) * 0.007,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <MagmaParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
MagmaFloatFlair.displayName = 'MagmaFloatFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
