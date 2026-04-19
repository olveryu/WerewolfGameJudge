/**
 * FloatFlair — 浮点
 *
 * 一个小光点沿 Lissajous 曲线在座位内部漫游（不贴边）。Common 级座位装饰模板。
 */
import { memo, useEffect } from 'react';
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

export const FloatFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const dotProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value * Math.PI * 2;
    // Lissajous curve (3:2 frequency ratio), amplitude stays inside tile
    const amp = size * 0.28;
    const cx = size / 2 + Math.sin(t * 3) * amp * 0.8;
    const cy = size / 2 + Math.cos(t * 2) * amp * 0.7;
    const alpha = 0.4 + Math.sin(t * 4) * 0.25;
    return { cx, cy, r: size * 0.02, opacity: alpha } as Record<string, number>;
  });

  const trailProps = useAnimatedProps(() => {
    'worklet';
    const t = ((progress.value - 0.04 + 1) % 1) * Math.PI * 2;
    const amp = size * 0.28;
    const cx = size / 2 + Math.sin(t * 3) * amp * 0.8;
    const cy = size / 2 + Math.cos(t * 2) * amp * 0.7;
    return { cx, cy, r: size * 0.015, opacity: 0.18 } as Record<string, number>;
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <AnimatedCircle animatedProps={trailProps} fill={colors.rgbLight} />
        <AnimatedCircle animatedProps={dotProps} fill={colors.rgb} />
      </Svg>
    </View>
  );
});
FloatFlair.displayName = 'FloatFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
