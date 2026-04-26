/**
 * ZoomOutEnter — 缩放入场
 *
 * Children shrink from an oversized state to normal with a colored ring implosion.
 * Common-tier entrance animation template.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { COMMON_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { AnimatedCircle } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

interface ColoredAnimationProps extends SeatAnimationProps {
  colors: FlairColorSet;
}

export const ZoomOutEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const progress = useSharedValue(0);

    useEffect(() => {
      progress.value = withTiming(
        1,
        { duration: COMMON_DURATION, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onComplete)();
        },
      );
    }, [progress, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: Math.min(progress.value * 2, 1),
      transform: [{ scale: 1.6 - progress.value * 0.6 }],
    }));

    const ringProps = useAnimatedProps(() => {
      'worklet';
      return {
        r: size * 0.5 - progress.value * size * 0.15,
        opacity: (1 - progress.value) * 0.3,
      } as Record<string, number>;
    });

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            animatedProps={ringProps}
            fill="none"
            stroke={colors.rgbLight}
            strokeWidth={3}
          />
        </Svg>
        <Animated.View
          style={[styles.childWrapper, { width: size, height: size, borderRadius }, childStyle]}
        >
          {children}
        </Animated.View>
      </View>
    );
  },
);
ZoomOutEnter.displayName = 'ZoomOutEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
