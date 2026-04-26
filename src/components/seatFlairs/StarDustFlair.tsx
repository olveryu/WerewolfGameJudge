/**
 * StarDustFlair — 星尘飘散
 *
 * 7 枚微型十字星在周围闪烁(十字线+对角线+中心圆 = 5 elements per star)。
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

const STAR_COUNT = 7;

interface StarSeed {
  xFrac: number;
  yFrac: number;
  phase: number;
  armLen: number;
}

const StarParticle = memo<{ seed: StarSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const getAlpha = (t: number) => {
      'worklet';
      const cycle = (t + seed.phase) % 1;
      if (cycle < 0.2) return cycle / 0.2;
      if (cycle < 0.4) return 1;
      if (cycle < 0.6) return 1 - (cycle - 0.4) / 0.2;
      return 0;
    };

    const px = seed.xFrac * size;
    const py = seed.yFrac * size;
    const arm = seed.armLen * size;

    const hLineProps = useAnimatedProps(() => {
      'worklet';
      const alpha = getAlpha(progress.value);
      return {
        x1: px - arm,
        y1: py,
        x2: px + arm,
        y2: py,
        opacity: alpha * 0.5,
        strokeWidth: size * 0.006,
      } as Record<string, number>;
    });

    const vLineProps = useAnimatedProps(() => {
      'worklet';
      const alpha = getAlpha(progress.value);
      return {
        x1: px,
        y1: py - arm,
        x2: px,
        y2: py + arm,
        opacity: alpha * 0.5,
        strokeWidth: size * 0.006,
      } as Record<string, number>;
    });

    const d1Props = useAnimatedProps(() => {
      'worklet';
      const alpha = getAlpha(progress.value);
      const da = arm * 0.6;
      return {
        x1: px - da,
        y1: py - da,
        x2: px + da,
        y2: py + da,
        opacity: alpha * 0.3,
        strokeWidth: size * 0.004,
      } as Record<string, number>;
    });

    const d2Props = useAnimatedProps(() => {
      'worklet';
      const alpha = getAlpha(progress.value);
      const da = arm * 0.6;
      return {
        x1: px + da,
        y1: py - da,
        x2: px - da,
        y2: py + da,
        opacity: alpha * 0.3,
        strokeWidth: size * 0.004,
      } as Record<string, number>;
    });

    const centerProps = useAnimatedProps(() => {
      'worklet';
      const alpha = getAlpha(progress.value);
      return { cx: px, cy: py, r: size * 0.008, opacity: alpha * 0.8 } as Record<string, number>;
    });

    return (
      <>
        <AnimatedLine animatedProps={hLineProps} stroke="rgb(255,255,220)" />
        <AnimatedLine animatedProps={vLineProps} stroke="rgb(255,255,220)" />
        <AnimatedLine animatedProps={d1Props} stroke="rgb(220,220,255)" />
        <AnimatedLine animatedProps={d2Props} stroke="rgb(220,220,255)" />
        <AnimatedCircle animatedProps={centerProps} fill="rgb(255,255,255)" />
      </>
    );
  },
);
StarParticle.displayName = 'StarParticle';

export const StarDustFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, i) => ({
        xFrac: 0.1 + (((i * 17 + 3) % 11) / 12) * 0.8,
        yFrac: 0.1 + (((i * 13 + 5) % 9) / 10) * 0.8,
        phase: i / STAR_COUNT,
        armLen: 0.025 + (i % 3) * 0.008,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <StarParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
StarDustFlair.displayName = 'StarDustFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
