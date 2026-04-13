/**
 * PoisonBubbleFlair — 剧毒气泡
 *
 * 8 颗绿色气泡从底部浮起，带高光反射点，到顶部消散。
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

const N = 8;

interface BubbleSeed {
  xFrac: number;
  phase: number;
  rFrac: number;
  speed: number;
}

const BubbleParticle = memo<{ seed: BubbleSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const outlineProps = useAnimatedProps(() => {
      'worklet';
      const tt = (progress.value * seed.speed + seed.phase) % 1;
      const y = size * (1 - tt * 0.9) - size * 0.05;
      const x = seed.xFrac * size + Math.sin(tt * Math.PI * 2) * size * 0.03;
      const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.85 ? (1 - tt) / 0.15 : 0.6;
      const r = seed.rFrac * size * (1 + tt * 0.3);
      return { cx: x, cy: y, r, opacity: alpha * 0.7 } as Record<string, number>;
    });

    const highlightProps = useAnimatedProps(() => {
      'worklet';
      const tt = (progress.value * seed.speed + seed.phase) % 1;
      const y = size * (1 - tt * 0.9) - size * 0.05;
      const x = seed.xFrac * size + Math.sin(tt * Math.PI * 2) * size * 0.03;
      const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.85 ? (1 - tt) / 0.15 : 0.6;
      const r = seed.rFrac * size * (1 + tt * 0.3);
      return { cx: x - r * 0.3, cy: y - r * 0.3, r: r * 0.25, opacity: alpha * 0.5 } as Record<
        string,
        number
      >;
    });

    return (
      <>
        <AnimatedCircle
          animatedProps={outlineProps}
          fill="none"
          stroke="rgb(80,220,80)"
          strokeWidth={1}
        />
        <AnimatedCircle animatedProps={highlightProps} fill="rgb(150,255,150)" />
      </>
    );
  },
);
BubbleParticle.displayName = 'BubbleParticle';

export const PoisonBubbleFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        xFrac: 0.15 + (i * 0.7) / (N - 1),
        phase: i / N,
        rFrac: 0.02 + (i % 3) * 0.008,
        speed: 0.6 + (i % 4) * 0.1,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <BubbleParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
PoisonBubbleFlair.displayName = 'PoisonBubbleFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
