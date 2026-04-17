/**
 * BreatheFlair — 呼吸
 *
 * 边框发光呼吸效果（opacity 周期性升降）。Common 级座位装饰模板。
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
// AnimatedRect for breathing border
import Animated from 'react-native-reanimated';
import {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

export const BreatheFlair = memo<ColoredFlairProps>(({ size, borderRadius, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1);
  }, [progress]);

  const rectProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const alpha = 0.15 + Math.sin(t * Math.PI * 2) * 0.2;
    return { opacity: alpha, strokeWidth: 2 } as Record<string, number>;
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <AnimatedRect
          animatedProps={rectProps}
          x={2}
          y={2}
          width={size - 4}
          height={size - 4}
          rx={borderRadius}
          fill="none"
          stroke={colors.rgb}
        />
      </Svg>
    </View>
  );
});
BreatheFlair.displayName = 'BreatheFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
