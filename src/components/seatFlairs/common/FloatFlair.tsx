/**
 * FloatFlair — 浮点
 *
 * 一个小光点沿座位边缘缓慢漂浮。Common 级座位装饰模板。
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
    const t = progress.value;
    const angle = t * Math.PI * 2;
    // Orbit along the edge with padding
    const pad = size * 0.08;
    const rx = size / 2 - pad;
    const ry = size / 2 - pad;
    const cx = size / 2 + Math.cos(angle) * rx;
    const cy = size / 2 + Math.sin(angle) * ry;
    // Gentle alpha pulsing
    const alpha = 0.4 + Math.sin(t * Math.PI * 4) * 0.25;
    return { cx, cy, r: size * 0.02, opacity: alpha } as Record<string, number>;
  });

  const trailProps = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value - 0.05 + 1) % 1;
    const angle = t * Math.PI * 2;
    const pad = size * 0.08;
    const rx = size / 2 - pad;
    const ry = size / 2 - pad;
    const cx = size / 2 + Math.cos(angle) * rx;
    const cy = size / 2 + Math.sin(angle) * ry;
    return { cx, cy, r: size * 0.015, opacity: 0.2 } as Record<string, number>;
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
