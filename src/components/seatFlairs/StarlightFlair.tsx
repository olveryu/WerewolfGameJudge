/**
 * StarlightFlair — 星光点缀
 *
 * 6 颗四芒星在头像周围漂浮，十字+对角光芒+光晕+中心点。
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
import { AnimatedCircle, AnimatedLine } from './svgAnimatedPrimitives';

const N = 6;

interface StarSeed {
  angle0: number;
  dist: number;
  phase: number;
  drift: number;
}

const StarParticle = memo<{ seed: StarSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const cx = size / 2;
    const cy = size / 2;
    const armLen = size * 0.05;
    const diagLen = armLen * 0.55;

    const haloProps = useAnimatedProps(() => {
      'worklet';
      const angle = seed.angle0 + progress.value * Math.PI * 2 * seed.drift;
      const d = seed.dist * size;
      const x = cx + Math.cos(angle) * d;
      const y = cy + Math.sin(angle) * d;
      const t = (progress.value + seed.phase) % 1;
      const tw = 0.3 + 0.7 * Math.max(0, Math.sin(t * Math.PI * 2));
      return { cx: x, cy: y, r: armLen * 0.9, opacity: tw * 0.15 } as Record<string, number>;
    });

    const cross1Props = useAnimatedProps(() => {
      'worklet';
      const angle = seed.angle0 + progress.value * Math.PI * 2 * seed.drift;
      const d = seed.dist * size;
      const x = cx + Math.cos(angle) * d;
      const y = cy + Math.sin(angle) * d;
      const t = (progress.value + seed.phase) % 1;
      const tw = 0.3 + 0.7 * Math.max(0, Math.sin(t * Math.PI * 2));
      return {
        x1: x - armLen,
        y1: y,
        x2: x + armLen,
        y2: y,
        opacity: tw * 0.8,
        strokeWidth: 1.5,
      } as Record<string, number>;
    });

    const cross2Props = useAnimatedProps(() => {
      'worklet';
      const angle = seed.angle0 + progress.value * Math.PI * 2 * seed.drift;
      const d = seed.dist * size;
      const x = cx + Math.cos(angle) * d;
      const y = cy + Math.sin(angle) * d;
      const t = (progress.value + seed.phase) % 1;
      const tw = 0.3 + 0.7 * Math.max(0, Math.sin(t * Math.PI * 2));
      return {
        x1: x,
        y1: y - armLen,
        x2: x,
        y2: y + armLen,
        opacity: tw * 0.8,
        strokeWidth: 1.5,
      } as Record<string, number>;
    });

    const diag1Props = useAnimatedProps(() => {
      'worklet';
      const angle = seed.angle0 + progress.value * Math.PI * 2 * seed.drift;
      const d = seed.dist * size;
      const x = cx + Math.cos(angle) * d;
      const y = cy + Math.sin(angle) * d;
      const t = (progress.value + seed.phase) % 1;
      const tw = 0.3 + 0.7 * Math.max(0, Math.sin(t * Math.PI * 2));
      return {
        x1: x - diagLen,
        y1: y - diagLen,
        x2: x + diagLen,
        y2: y + diagLen,
        opacity: tw * 0.5,
        strokeWidth: 1,
      } as Record<string, number>;
    });

    const diag2Props = useAnimatedProps(() => {
      'worklet';
      const angle = seed.angle0 + progress.value * Math.PI * 2 * seed.drift;
      const d = seed.dist * size;
      const x = cx + Math.cos(angle) * d;
      const y = cy + Math.sin(angle) * d;
      const t = (progress.value + seed.phase) % 1;
      const tw = 0.3 + 0.7 * Math.max(0, Math.sin(t * Math.PI * 2));
      return {
        x1: x - diagLen,
        y1: y + diagLen,
        x2: x + diagLen,
        y2: y - diagLen,
        opacity: tw * 0.5,
        strokeWidth: 1,
      } as Record<string, number>;
    });

    const dotProps = useAnimatedProps(() => {
      'worklet';
      const angle = seed.angle0 + progress.value * Math.PI * 2 * seed.drift;
      const d = seed.dist * size;
      const x = cx + Math.cos(angle) * d;
      const y = cy + Math.sin(angle) * d;
      const t = (progress.value + seed.phase) % 1;
      const tw = 0.3 + 0.7 * Math.max(0, Math.sin(t * Math.PI * 2));
      return { cx: x, cy: y, r: size * 0.008, opacity: tw * 0.9 } as Record<string, number>;
    });

    return (
      <>
        <AnimatedCircle animatedProps={haloProps} fill="rgb(255,250,200)" />
        <AnimatedLine animatedProps={cross1Props} stroke="rgb(255,253,224)" />
        <AnimatedLine animatedProps={cross2Props} stroke="rgb(255,253,224)" />
        <AnimatedLine animatedProps={diag1Props} stroke="rgb(255,253,224)" />
        <AnimatedLine animatedProps={diag2Props} stroke="rgb(255,253,224)" />
        <AnimatedCircle animatedProps={dotProps} fill="rgb(255,255,240)" />
      </>
    );
  },
);
StarParticle.displayName = 'StarParticle';

export const StarlightFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle0: (i / N) * Math.PI * 2,
        dist: 0.35 + (i % 3) * 0.05,
        phase: i / N,
        drift: 0.4 + (i % 4) * 0.25,
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
StarlightFlair.displayName = 'StarlightFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
