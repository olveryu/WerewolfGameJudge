/**
 * ThunderClapFlair — 惊雷一击
 *
 * 单道大型闪电从顶部劈至底部，三层叠加(外晕/中/芯) + 4 spark 散射。
 * 周期性闪现：快闪→余光→暗→repeat。
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

interface SparkSeed {
  dx: number;
  dy: number;
  phase: number;
}

const BoltLayer = memo<{
  size: number;
  progress: { value: number };
  color: string;
  widthMul: number;
  opacityMul: number;
}>(({ size, progress, color, widthMul, opacityMul }) => {
  const props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const flash =
      t < 0.1
        ? t / 0.1
        : t < 0.2
          ? 1 - ((t - 0.1) / 0.1) * 0.5
          : t < 0.3
            ? 0.5 - ((t - 0.2) / 0.1) * 0.5
            : 0;
    const cx = size * 0.5;
    const d = `M ${cx} 0 L ${cx - size * 0.08} ${size * 0.25} L ${cx + size * 0.05} ${size * 0.35} L ${cx - size * 0.1} ${size * 0.55} L ${cx + size * 0.06} ${size * 0.7} L ${cx - size * 0.04} ${size}`;
    return { d, opacity: flash * opacityMul, strokeWidth: size * widthMul } as {
      d: string;
      opacity: number;
      strokeWidth: number;
    };
  });
  return (
    <AnimatedPath
      animatedProps={props}
      stroke={color}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
});
BoltLayer.displayName = 'BoltLayer';

const SparkDot = memo<{ seed: SparkSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const props = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const flash = t < 0.1 ? t / 0.1 : t < 0.25 ? 1 - (t - 0.1) / 0.15 : 0;
      const cx = size * 0.5 + seed.dx * size * flash;
      const cy = size * 0.5 + seed.dy * size * flash;
      return { cx, cy, r: size * 0.01 * flash, opacity: flash * 0.6 } as Record<string, number>;
    });
    return <AnimatedCircle animatedProps={props} fill="rgb(255,255,255)" />;
  },
);
SparkDot.displayName = 'SparkDot';

export const ThunderClapFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);
  }, [progress]);

  const sparks = useMemo<SparkSeed[]>(
    () => [
      { dx: -0.15, dy: -0.1, phase: 0 },
      { dx: 0.12, dy: -0.08, phase: 0 },
      { dx: -0.1, dy: 0.12, phase: 0 },
      { dx: 0.14, dy: 0.1, phase: 0 },
    ],
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <BoltLayer
          size={size}
          progress={progress}
          color="rgb(80,140,255)"
          widthMul={0.04}
          opacityMul={0.3}
        />
        <BoltLayer
          size={size}
          progress={progress}
          color="rgb(160,200,255)"
          widthMul={0.02}
          opacityMul={0.6}
        />
        <BoltLayer
          size={size}
          progress={progress}
          color="rgb(240,245,255)"
          widthMul={0.008}
          opacityMul={0.9}
        />
        {sparks.map((s, i) => (
          <SparkDot key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
ThunderClapFlair.displayName = 'ThunderClapFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
