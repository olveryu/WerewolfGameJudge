/**
 * FireflyFlair — 萤火虫之夜
 *
 * 8 只萤火虫在外围不规则游走，明暗闪烁节奏错开，带暖色辉光晕。
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

interface FireflySeed {
  angle0: number;
  dist: number;
  phase: number;
  wander: number;
}

const FireflyParticle = memo<{ seed: FireflySeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const haloProps = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const cx = size / 2;
      const cy = size / 2;
      const angle =
        seed.angle0 +
        Math.sin((t * 1.5 + seed.phase * 7) * Math.PI) * seed.wander +
        t * Math.PI * 0.3;
      const dist = seed.dist * size + Math.sin((t * 2.5 + seed.phase * 5) * Math.PI) * size * 0.04;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const blink = Math.max(0, Math.sin((t * 4 + seed.phase * 8) * Math.PI));
      const alpha = 0.1 + blink * 0.7;
      return { cx: x, cy: y, r: size * 0.03, opacity: alpha * 0.25 } as Record<string, number>;
    });

    const coreProps = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const cx = size / 2;
      const cy = size / 2;
      const angle =
        seed.angle0 +
        Math.sin((t * 1.5 + seed.phase * 7) * Math.PI) * seed.wander +
        t * Math.PI * 0.3;
      const dist = seed.dist * size + Math.sin((t * 2.5 + seed.phase * 5) * Math.PI) * size * 0.04;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const blink = Math.max(0, Math.sin((t * 4 + seed.phase * 8) * Math.PI));
      const alpha = 0.1 + blink * 0.7;
      return { cx: x, cy: y, r: size * 0.012, opacity: alpha * 0.9 } as Record<string, number>;
    });

    return (
      <>
        <AnimatedCircle animatedProps={haloProps} fill="rgb(200,230,60)" />
        <AnimatedCircle animatedProps={coreProps} fill="rgb(230,255,100)" />
      </>
    );
  },
);
FireflyParticle.displayName = 'FireflyParticle';

export const FireflyFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle0: (i / N) * Math.PI * 2,
        dist: 0.32 + (i % 4) * 0.05,
        phase: i / N,
        wander: 0.15 + (i % 3) * 0.08,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <FireflyParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
FireflyFlair.displayName = 'FireflyFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
