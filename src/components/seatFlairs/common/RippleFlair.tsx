/**
 * RippleFlair — 涟漪
 *
 * Expanding concentric square outlines that fade out. Common 级座位装饰模板。
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
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

export const RippleFlair = memo<ColoredFlairProps>(({ size, borderRadius, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.linear }), -1);
  }, [progress]);

  const rect1Props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const pad = size * 0.1 * (1 - t);
    const dim = size - 2 * pad;
    return { x: pad, y: pad, width: dim, height: dim, opacity: (1 - t) * 0.45 } as Record<
      string,
      number
    >;
  });

  const rect2Props = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value + 0.5) % 1;
    const pad = size * 0.1 * (1 - t);
    const dim = size - 2 * pad;
    return { x: pad, y: pad, width: dim, height: dim, opacity: (1 - t) * 0.35 } as Record<
      string,
      number
    >;
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <AnimatedRect
          animatedProps={rect1Props}
          rx={borderRadius}
          fill="none"
          stroke={colors.rgb}
          strokeWidth={1.5}
        />
        <AnimatedRect
          animatedProps={rect2Props}
          rx={borderRadius}
          fill="none"
          stroke={colors.rgbLight}
          strokeWidth={1}
        />
      </Svg>
    </View>
  );
});
RippleFlair.displayName = 'RippleFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
