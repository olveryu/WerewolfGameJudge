/**
 * SparkleFlair — 星点
 *
 * 4 颗小星点在四角闪烁。Common 级座位装饰模板。
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

import type { FlairProps } from '../FlairProps';
import { AnimatedCircle, AnimatedLine } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

interface StarSeed {
  x: number;
  y: number;
  phase: number;
}

const SparklePoint = memo<{
  seed: StarSeed;
  size: number;
  progress: { value: number };
  color: string;
}>(({ seed, size, progress, color }) => {
  const dotProps = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value + seed.phase) % 1;
    const blink = Math.sin(t * Math.PI * 2);
    const alpha = blink > 0 ? blink * 0.7 : 0;
    return {
      cx: seed.x * size,
      cy: seed.y * size,
      r: size * 0.012,
      opacity: alpha,
    } as Record<string, number>;
  });

  const hLineProps = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value + seed.phase) % 1;
    const blink = Math.sin(t * Math.PI * 2);
    const alpha = blink > 0 ? blink * 0.5 : 0;
    const arm = size * 0.025;
    const cx = seed.x * size;
    const cy = seed.y * size;
    return {
      x1: cx - arm,
      y1: cy,
      x2: cx + arm,
      y2: cy,
      opacity: alpha,
      strokeWidth: 0.8,
    } as Record<string, number>;
  });

  const vLineProps = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value + seed.phase) % 1;
    const blink = Math.sin(t * Math.PI * 2);
    const alpha = blink > 0 ? blink * 0.5 : 0;
    const arm = size * 0.025;
    const cx = seed.x * size;
    const cy = seed.y * size;
    return {
      x1: cx,
      y1: cy - arm,
      x2: cx,
      y2: cy + arm,
      opacity: alpha,
      strokeWidth: 0.8,
    } as Record<string, number>;
  });

  return (
    <>
      <AnimatedCircle animatedProps={dotProps} fill={color} />
      <AnimatedLine animatedProps={hLineProps} stroke={color} />
      <AnimatedLine animatedProps={vLineProps} stroke={color} />
    </>
  );
});
SparklePoint.displayName = 'SparklePoint';

export const SparkleFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo<StarSeed[]>(
    () => [
      { x: 0.1, y: 0.1, phase: 0 },
      { x: 0.9, y: 0.15, phase: 0.25 },
      { x: 0.85, y: 0.9, phase: 0.5 },
      { x: 0.15, y: 0.85, phase: 0.75 },
    ],
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <SparklePoint key={i} seed={s} size={size} progress={progress} color={colors.rgbLight} />
        ))}
      </Svg>
    </View>
  );
});
SparkleFlair.displayName = 'SparkleFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
