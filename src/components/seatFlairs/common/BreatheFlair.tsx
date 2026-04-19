/**
 * BreatheFlair — 呼吸
 *
 * 3 个散布内部的柔光圆点，交错呼吸明灭（bokeh 风格）。Common 级座位装饰模板。
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
import { AnimatedCircle } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const DOTS = [
  { xFrac: 0.28, yFrac: 0.25, rFrac: 0.055, phase: 0 },
  { xFrac: 0.72, yFrac: 0.42, rFrac: 0.045, phase: 0.33 },
  { xFrac: 0.4, yFrac: 0.72, rFrac: 0.05, phase: 0.66 },
] as const;

const BokehDot = memo<{
  dot: (typeof DOTS)[number];
  size: number;
  progress: { value: number };
  color: string;
  lightColor: string;
}>(({ dot, size, progress, color, lightColor }) => {
  const coreProps = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value + dot.phase) % 1;
    const breath = Math.sin(t * Math.PI * 2);
    const alpha = 0.2 + breath * 0.35;
    const r = size * dot.rFrac * (0.85 + breath * 0.15);
    return { cx: dot.xFrac * size, cy: dot.yFrac * size, r, opacity: alpha } as Record<
      string,
      number
    >;
  });

  const haloProps = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value + dot.phase) % 1;
    const breath = Math.sin(t * Math.PI * 2);
    const alpha = 0.08 + breath * 0.12;
    return {
      cx: dot.xFrac * size,
      cy: dot.yFrac * size,
      r: size * dot.rFrac * 1.8,
      opacity: alpha,
    } as Record<string, number>;
  });

  return (
    <>
      <AnimatedCircle animatedProps={haloProps} fill={lightColor} />
      <AnimatedCircle animatedProps={coreProps} fill={color} />
    </>
  );
});
BokehDot.displayName = 'BokehDot';

export const BreatheFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1);
  }, [progress]);

  const dots = useMemo(() => DOTS, []);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {dots.map((d, i) => (
          <BokehDot
            key={i}
            dot={d}
            size={size}
            progress={progress}
            color={colors.rgb}
            lightColor={colors.rgbLight}
          />
        ))}
      </Svg>
    </View>
  );
});
BreatheFlair.displayName = 'BreatheFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
