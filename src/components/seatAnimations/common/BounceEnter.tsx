/**
 * BounceEnter — 弹跳入场
 *
 * Children drop in with a spring bounce and a colored impact ring.
 * Common-tier entrance animation template.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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

export const BounceEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const translateY = useSharedValue(-size * 0.5);
    const opacity = useSharedValue(0);
    const ringProgress = useSharedValue(0);

    useEffect(() => {
      opacity.value = withTiming(1, { duration: COMMON_DURATION * 0.15 });
      translateY.value = withSpring(0, { damping: 8, stiffness: 180 });
      ringProgress.value = withTiming(1, { duration: COMMON_DURATION }, (finished) => {
        if (finished) runOnJS(onComplete)();
      });
    }, [translateY, opacity, ringProgress, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    }));

    const ringProps = useAnimatedProps(() => {
      'worklet';
      return {
        r: size * 0.1 + ringProgress.value * size * 0.35,
        opacity: (1 - ringProgress.value) * 0.4,
      } as Record<string, number>;
    });

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={size / 2}
            cy={size * 0.7}
            animatedProps={ringProps}
            fill="none"
            stroke={colors.rgb}
            strokeWidth={2}
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
BounceEnter.displayName = 'BounceEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
