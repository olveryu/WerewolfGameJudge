/**
 * FlipEnter — 翻转入场
 *
 * Children flip in along the Y axis (like a card flip) with a colored shimmer line.
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
import { AnimatedLine } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

interface ColoredAnimationProps extends SeatAnimationProps {
  colors: FlairColorSet;
}

export const FlipEnter = memo<ColoredAnimationProps>(
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
      opacity: progress.value > 0.3 ? 1 : 0,
      transform: [{ perspective: 800 }, { rotateY: `${(1 - progress.value) * 90}deg` }],
    }));

    const lineProps = useAnimatedProps(() => {
      'worklet';
      const x = size * progress.value;
      return {
        x1: x,
        x2: x,
        y1: 0,
        y2: size,
        opacity: (1 - progress.value) * 0.5,
      } as Record<string, number>;
    });

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedLine animatedProps={lineProps} stroke={colors.rgbLight} strokeWidth={2} />
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
FlipEnter.displayName = 'FlipEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
