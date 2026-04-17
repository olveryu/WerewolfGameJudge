/**
 * PulseFlair — 脉冲
 *
 * 一个从中心扩散的圆环，反复脉冲。Common 级座位装饰模板。
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

export const PulseFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 2500, easing: Easing.linear }), -1);
  }, [progress]);

  const ring1Props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const r = size * 0.2 + t * size * 0.3;
    const alpha = (1 - t) * 0.5;
    return { cx: size / 2, cy: size / 2, r, opacity: alpha, strokeWidth: 1.5 } as Record<
      string,
      number
    >;
  });

  const ring2Props = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value + 0.5) % 1;
    const r = size * 0.2 + t * size * 0.3;
    const alpha = (1 - t) * 0.4;
    return { cx: size / 2, cy: size / 2, r, opacity: alpha, strokeWidth: 1.2 } as Record<
      string,
      number
    >;
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <AnimatedCircle animatedProps={ring1Props} fill="none" stroke={colors.rgb} />
        <AnimatedCircle animatedProps={ring2Props} fill="none" stroke={colors.rgbLight} />
      </Svg>
    </View>
  );
});
PulseFlair.displayName = 'PulseFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
