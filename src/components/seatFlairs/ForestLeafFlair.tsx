/**
 * ForestLeafFlair — 落叶知秋
 *
 * 7 片橙褐色树叶从上方旋转飘落，椭圆形状 + 叶脉线。
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

const N = 7;
const COLORS = [
  [180, 100, 30],
  [200, 120, 40],
  [160, 80, 20],
  [190, 110, 35],
  [170, 90, 25],
  [210, 130, 45],
  [175, 95, 28],
] as const;

interface LeafSeed {
  xFrac: number;
  phase: number;
  rotSpeed: number;
  sway: number;
  rFrac: number;
}

const LeafParticle = memo<{
  seed: LeafSeed;
  colorIndex: number;
  size: number;
  progress: { value: number };
}>(({ seed, colorIndex, size, progress }) => {
  const [cr, cg, cb] = COLORS[colorIndex]!;

  const circle1Props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const tt = (t * 0.6 + seed.phase) % 1;
    const y = tt * size;
    const x = seed.xFrac * size + Math.sin(tt * Math.PI * 3) * size * seed.sway;
    const alpha = tt < 0.08 ? tt / 0.08 : tt > 0.85 ? (1 - tt) / 0.15 : 0.65;
    const rot = tt * Math.PI * seed.rotSpeed;
    const r = seed.rFrac * size;
    const dx = Math.cos(rot) * r * 0.3;
    const dy = Math.sin(rot) * r * 0.3;
    return { cx: x - dx, cy: y - dy, r, opacity: alpha * 0.7 } as Record<string, number>;
  });

  const circle2Props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const tt = (t * 0.6 + seed.phase) % 1;
    const y = tt * size;
    const x = seed.xFrac * size + Math.sin(tt * Math.PI * 3) * size * seed.sway;
    const alpha = tt < 0.08 ? tt / 0.08 : tt > 0.85 ? (1 - tt) / 0.15 : 0.65;
    const rot = tt * Math.PI * seed.rotSpeed;
    const r = seed.rFrac * size;
    const dx = Math.cos(rot) * r * 0.3;
    const dy = Math.sin(rot) * r * 0.3;
    return { cx: x + dx, cy: y + dy, r: r * 0.8, opacity: alpha * 0.7 } as Record<string, number>;
  });

  const veinProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const tt = (t * 0.6 + seed.phase) % 1;
    const y = tt * size;
    const x = seed.xFrac * size + Math.sin(tt * Math.PI * 3) * size * seed.sway;
    const alpha = tt < 0.08 ? tt / 0.08 : tt > 0.85 ? (1 - tt) / 0.15 : 0.65;
    const rot = tt * Math.PI * seed.rotSpeed;
    const r = seed.rFrac * size;
    const dx = Math.cos(rot) * r * 0.3;
    const dy = Math.sin(rot) * r * 0.3;
    return {
      x1: x - dx * 2,
      y1: y - dy * 2,
      x2: x + dx * 2,
      y2: y + dy * 2,
      opacity: alpha * 0.5,
      strokeWidth: 0.5,
    } as Record<string, number>;
  });

  return (
    <>
      <AnimatedCircle animatedProps={circle1Props} fill={`rgb(${cr},${cg},${cb})`} />
      <AnimatedCircle animatedProps={circle2Props} fill={`rgb(${cr},${cg},${cb})`} />
      <AnimatedLine animatedProps={veinProps} stroke={`rgb(${cr - 20},${cg - 20},${cb - 10})`} />
    </>
  );
});
LeafParticle.displayName = 'LeafParticle';

export const ForestLeafFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        xFrac: 0.1 + (i * 0.8) / (N - 1),
        phase: i / N,
        rotSpeed: 1 + (i % 3) * 0.7,
        sway: 0.03 + (i % 3) * 0.02,
        rFrac: 0.02 + (i % 3) * 0.005,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <LeafParticle key={i} seed={s} colorIndex={i} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
ForestLeafFlair.displayName = 'ForestLeafFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
