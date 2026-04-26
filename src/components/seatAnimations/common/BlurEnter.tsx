/**
 * BlurEnter — 模糊渐清入场
 *
 * Children go from blurred/low-opacity to sharp/full-opacity. On web, we use
 * a scale+opacity approximation since RN does not support blur on Animated.View natively.
 * A colored soft circle pulses behind to sell the "focus" feel.
 * Common-tier entrance animation template.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
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

export const BlurEnter = memo<ColoredAnimationProps>(
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
      opacity: progress.value,
      transform: [{ scale: 1.15 - progress.value * 0.15 }],
    }));

    const glowStyle = useAnimatedStyle(() => ({
      opacity: (1 - progress.value) * 0.4,
    }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Animated.View style={glowStyle}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={size * 0.4}
              fill={colors.rgbLight}
              opacity={0.5}
            />
          </Svg>
        </Animated.View>
        <Animated.View
          style={[styles.childWrapper, { width: size, height: size, borderRadius }, childStyle]}
        >
          {children}
        </Animated.View>
      </View>
    );
  },
);
BlurEnter.displayName = 'BlurEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
