/**
 * OrbitFlair — 轨道
 *
 * Two dots orbiting at different radii and speeds. Common 级座位装饰模板。
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

export const OrbitFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const dot1Props = useAnimatedProps(() => {
    'worklet';
    const angle = progress.value * Math.PI * 2;
    const r = size * 0.38;
    return {
      cx: size / 2 + Math.cos(angle) * r,
      cy: size / 2 + Math.sin(angle) * r,
      r: size * 0.018,
      opacity: 0.55,
    } as Record<string, number>;
  });

  const dot2Props = useAnimatedProps(() => {
    'worklet';
    const angle = progress.value * Math.PI * 2 * -1.5 + Math.PI; // reverse, faster
    const r = size * 0.28;
    return {
      cx: size / 2 + Math.cos(angle) * r,
      cy: size / 2 + Math.sin(angle) * r,
      r: size * 0.014,
      opacity: 0.4,
    } as Record<string, number>;
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <AnimatedCircle animatedProps={dot1Props} fill={colors.rgb} />
        <AnimatedCircle animatedProps={dot2Props} fill={colors.rgbLight} />
      </Svg>
    </View>
  );
});
OrbitFlair.displayName = 'OrbitFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
