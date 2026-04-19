/**
 * RippleFlair — 涟漪
 *
 * 从中心偏移点发出小型圆形涟漪，不贴边。Common 级座位装饰模板。
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

/** Max ripple radius as fraction of tile size */
const MAX_R = 0.32;

export const RippleFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.linear }), -1);
  }, [progress]);

  const ring1Props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const r = size * 0.04 + t * size * MAX_R;
    return {
      cx: size * 0.45,
      cy: size * 0.48,
      r,
      opacity: (1 - t) * 0.45,
      strokeWidth: 1.5,
    } as Record<string, number>;
  });

  const ring2Props = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value + 0.5) % 1;
    const r = size * 0.04 + t * size * MAX_R;
    return {
      cx: size * 0.45,
      cy: size * 0.48,
      r,
      opacity: (1 - t) * 0.35,
      strokeWidth: 1,
    } as Record<string, number>;
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
RippleFlair.displayName = 'RippleFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
