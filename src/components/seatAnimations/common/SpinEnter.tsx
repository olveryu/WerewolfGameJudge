/**
 * SpinEnter — 旋转入场
 *
 * Children rotate 360° while fading in with a colored arc sweep behind.
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
import { AnimatedPath } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

interface ColoredAnimationProps extends SeatAnimationProps {
  colors: FlairColorSet;
}

export const SpinEnter = memo<ColoredAnimationProps>(
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
      opacity: Math.min(progress.value * 1.5, 1),
      transform: [
        { rotate: `${(1 - progress.value) * 360}deg` },
        { scale: 0.5 + progress.value * 0.5 },
      ],
    }));

    const arcProps = useAnimatedProps(() => {
      'worklet';
      const cx = size / 2;
      const cy = size / 2;
      const r = size * 0.42;
      const angle = progress.value * Math.PI * 2;
      const x = cx + r * Math.cos(angle - Math.PI / 2);
      const y = cy + r * Math.sin(angle - Math.PI / 2);
      return {
        d: `M ${cx} ${cy - r} A ${r} ${r} 0 ${angle > Math.PI ? 1 : 0} 1 ${x} ${y}`,
        opacity: (1 - progress.value) * 0.5,
      } as Record<string, string | number>;
    });

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedPath
            animatedProps={arcProps}
            fill="none"
            stroke={colors.rgb}
            strokeWidth={2}
            strokeLinecap="round"
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
SpinEnter.displayName = 'SpinEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
