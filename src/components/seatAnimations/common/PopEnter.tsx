/**
 * PopEnter — 弹出入场
 *
 * Children pop in with an elastic overshoot scale and a colored burst ring.
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

export const PopEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const burstProgress = useSharedValue(0);

    useEffect(() => {
      opacity.value = withTiming(1, { duration: COMMON_DURATION * 0.1 });
      scale.value = withSpring(1, { damping: 6, stiffness: 200 });
      burstProgress.value = withTiming(1, { duration: COMMON_DURATION }, (finished) => {
        if (finished) runOnJS(onComplete)();
      });
    }, [scale, opacity, burstProgress, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    }));

    const burstProps = useAnimatedProps(() => {
      'worklet';
      return {
        r: burstProgress.value * size * 0.5,
        opacity: (1 - burstProgress.value) * 0.5,
        strokeWidth: 3 * (1 - burstProgress.value),
      } as Record<string, number>;
    });

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            animatedProps={burstProps}
            fill="none"
            stroke={colors.rgb}
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
PopEnter.displayName = 'PopEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
