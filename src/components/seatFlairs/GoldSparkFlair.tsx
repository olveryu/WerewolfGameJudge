/**
 * GoldSparkFlair — 金星四溅
 *
 * 8 颗四芒星从外围爆发散出后消散，带十字光芒。
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

const N = 8;

interface SparkleSeed {
  angle: number;
  dist: number;
  phase: number;
  burst: number;
}

const SparkleParticle = memo<{
  seed: SparkleSeed;
  size: number;
  progress: { value: number };
  index: number;
}>(({ seed, size, progress }) => {
  const hLineProps = useAnimatedProps(() => {
    'worklet';
    const cx = size / 2;
    const cy = size / 2;
    const t = progress.value;
    const tt = (t * 1.5 + seed.phase) % 1;
    const burstDist = seed.dist * size + tt * size * seed.burst;
    const angle = seed.angle + Math.sin(t * Math.PI * 2) * 0.2;
    const x = cx + Math.cos(angle) * burstDist;
    const y = cy + Math.sin(angle) * burstDist;
    const tooClose = burstDist < size * 0.25;
    const alpha = tt < 0.1 ? tt / 0.1 : (1 - tt) * 0.8;
    const armLen = size * 0.02 * (1 - tt * 0.5);
    return {
      x1: x - armLen,
      y1: y,
      x2: x + armLen,
      y2: y,
      opacity: tooClose ? 0 : alpha * 0.8,
      strokeWidth: 1.2,
    } as Record<string, number>;
  });

  const vLineProps = useAnimatedProps(() => {
    'worklet';
    const cx = size / 2;
    const cy = size / 2;
    const t = progress.value;
    const tt = (t * 1.5 + seed.phase) % 1;
    const burstDist = seed.dist * size + tt * size * seed.burst;
    const angle = seed.angle + Math.sin(t * Math.PI * 2) * 0.2;
    const x = cx + Math.cos(angle) * burstDist;
    const y = cy + Math.sin(angle) * burstDist;
    const tooClose = burstDist < size * 0.25;
    const alpha = tt < 0.1 ? tt / 0.1 : (1 - tt) * 0.8;
    const armLen = size * 0.02 * (1 - tt * 0.5);
    return {
      x1: x,
      y1: y - armLen,
      x2: x,
      y2: y + armLen,
      opacity: tooClose ? 0 : alpha * 0.8,
      strokeWidth: 1.2,
    } as Record<string, number>;
  });

  const dotProps = useAnimatedProps(() => {
    'worklet';
    const cx = size / 2;
    const cy = size / 2;
    const t = progress.value;
    const tt = (t * 1.5 + seed.phase) % 1;
    const burstDist = seed.dist * size + tt * size * seed.burst;
    const angle = seed.angle + Math.sin(t * Math.PI * 2) * 0.2;
    const x = cx + Math.cos(angle) * burstDist;
    const y = cy + Math.sin(angle) * burstDist;
    const tooClose = burstDist < size * 0.25;
    const alpha = tt < 0.1 ? tt / 0.1 : (1 - tt) * 0.8;
    return { cx: x, cy: y, r: size * 0.01, opacity: tooClose ? 0 : alpha * 0.9 } as Record<
      string,
      number
    >;
  });

  return (
    <>
      <AnimatedLine animatedProps={hLineProps} stroke="rgb(255,210,60)" />
      <AnimatedLine animatedProps={vLineProps} stroke="rgb(255,210,60)" />
      <AnimatedCircle animatedProps={dotProps} fill="rgb(255,240,150)" />
    </>
  );
});
SparkleParticle.displayName = 'SparkleParticle';

export const GoldSparkFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle: (i / N) * Math.PI * 2 + i * 0.7,
        dist: 0.35 + (i % 4) * 0.04,
        phase: i / N,
        burst: 0.3 + (i % 3) * 0.1,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <SparkleParticle key={i} seed={s} size={size} progress={progress} index={i} />
        ))}
      </Svg>
    </View>
  );
});
GoldSparkFlair.displayName = 'GoldSparkFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
