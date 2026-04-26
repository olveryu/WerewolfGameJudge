/**
 * FadeEnter — 淡入
 *
 * Children fade from transparent to opaque with a subtle colored glow ring behind.
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

export const FadeEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const opacity = useSharedValue(0);
    const glowOpacity = useSharedValue(0.6);

    useEffect(() => {
      opacity.value = withTiming(1, {
        duration: COMMON_DURATION * 0.75,
        easing: Easing.out(Easing.cubic),
      });
      glowOpacity.value = withTiming(0, { duration: COMMON_DURATION }, (finished) => {
        if (finished) runOnJS(onComplete)();
      });
    }, [opacity, glowOpacity, onComplete]);

    const childStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
    const glowProps = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Animated.View style={glowProps}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={size * 0.42}
              fill={colors.rgbLight}
              opacity={0.35}
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
FadeEnter.displayName = 'FadeEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
