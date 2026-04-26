/**
 * VenomDripFlair — 毒液滴落
 *
 * 5 枚毒液水滴从顶部滴落，带拖尾 3 circles + 落地溅射扩散环。
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

const DROP_COUNT = 5;

interface DropSeed {
  xFrac: number;
  phase: number;
  speed: number;
}

const DropParticle = memo<{ seed: DropSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const mainProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const y = t * seed.speed * size;
      const alpha = t > 0.85 ? (1 - t) / 0.15 : 0.7;
      return { cx: seed.xFrac * size, cy: y, r: size * 0.018, opacity: alpha } as Record<
        string,
        number
      >;
    });

    const t1Props = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const y = Math.max(0, t * seed.speed * size - size * 0.04);
      return { cx: seed.xFrac * size, cy: y, r: size * 0.012, opacity: 0.4 } as Record<
        string,
        number
      >;
    });

    const t2Props = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const y = Math.max(0, t * seed.speed * size - size * 0.08);
      return { cx: seed.xFrac * size, cy: y, r: size * 0.008, opacity: 0.2 } as Record<
        string,
        number
      >;
    });

    const t3Props = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const y = Math.max(0, t * seed.speed * size - size * 0.12);
      return { cx: seed.xFrac * size, cy: y, r: size * 0.005, opacity: 0.1 } as Record<
        string,
        number
      >;
    });

    const splashProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const splashT = t > 0.85 ? (t - 0.85) / 0.15 : 0;
      return {
        cx: seed.xFrac * size,
        cy: size * 0.92,
        r: size * 0.03 * splashT,
        opacity: (1 - splashT) * 0.3,
      } as Record<string, number>;
    });

    return (
      <>
        <AnimatedCircle animatedProps={t3Props} fill="rgb(80,180,40)" />
        <AnimatedCircle animatedProps={t2Props} fill="rgb(80,180,40)" />
        <AnimatedCircle animatedProps={t1Props} fill="rgb(100,200,60)" />
        <AnimatedCircle animatedProps={mainProps} fill="rgb(60,160,30)" />
        <AnimatedCircle
          animatedProps={splashProps}
          fill="none"
          stroke="rgb(80,180,40)"
          strokeWidth={1}
        />
      </>
    );
  },
);
DropParticle.displayName = 'DropParticle';

export const VenomDripFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: DROP_COUNT }, (_, i) => ({
        xFrac: 0.2 + (i * 0.6) / (DROP_COUNT - 1),
        phase: i / DROP_COUNT,
        speed: 0.9 + (i % 2) * 0.1,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <DropParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
VenomDripFlair.displayName = 'VenomDripFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
