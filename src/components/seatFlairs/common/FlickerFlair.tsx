/**
 * FlickerFlair — 闪烁
 *
 * A single center dot that flickers with randomized intensity. Common 级座位装饰模板。
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

export const FlickerFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1);
  }, [progress]);

  const coreProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    // Two overlapping sin waves for an irregular flicker
    const a = Math.sin(t * Math.PI * 2) * 0.3;
    const b = Math.sin(t * Math.PI * 6) * 0.15;
    const alpha = 0.35 + a + b;
    const r = size * 0.03 + Math.sin(t * Math.PI * 4) * size * 0.008;
    return {
      cx: size / 2,
      cy: size / 2,
      r,
      opacity: Math.max(0, alpha),
    } as Record<string, number>;
  });

  const haloProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const alpha = 0.15 + Math.sin(t * Math.PI * 2) * 0.15;
    return {
      cx: size / 2,
      cy: size / 2,
      r: size * 0.06,
      opacity: Math.max(0, alpha),
    } as Record<string, number>;
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <AnimatedCircle animatedProps={haloProps} fill={colors.rgbLight} />
        <AnimatedCircle animatedProps={coreProps} fill={colors.rgb} />
      </Svg>
    </View>
  );
});
FlickerFlair.displayName = 'FlickerFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
