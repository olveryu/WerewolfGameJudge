/**
 * BloodMoonRise — 血月升起
 *
 * Legendary entrance: red moon rises from bottom, blood-red eclipse ring pulses,
 * dark mist swirls, avatar appears under the blood moon.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { LEGENDARY_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { AnimatedCircle } from '../svgAnimatedPrimitives';

export const BloodMoonRise = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
    const moonY = useSharedValue(size);
    const eclipseRing = useSharedValue(0);
    const mistOpacity = useSharedValue(0);
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      moonY.value = withTiming(size * 0.25, {
        duration: LEGENDARY_DURATION * 0.59,
        easing: Easing.out(Easing.cubic),
      });
      eclipseRing.value = withDelay(
        LEGENDARY_DURATION * 0.41,
        withSequence(
          withTiming(1, { duration: LEGENDARY_DURATION * 0.24 }),
          withTiming(0.5, { duration: LEGENDARY_DURATION * 0.18 }),
        ),
      );
      mistOpacity.value = withDelay(
        LEGENDARY_DURATION * 0.24,
        withTiming(0.3, { duration: LEGENDARY_DURATION * 0.35 }, () => {
          'worklet';
          mistOpacity.value = withTiming(0, { duration: LEGENDARY_DURATION * 0.47 });
        }),
      );
      childOpacity.value = withDelay(
        LEGENDARY_DURATION * 0.53,
        withTiming(
          1,
          { duration: LEGENDARY_DURATION * 0.47, easing: Easing.out(Easing.cubic) },
          (f) => {
            if (f) runOnJS(onComplete)();
          },
        ),
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps -- size is stable (layout-driven), re-triggering animation on resize is unwanted
    }, [moonY, eclipseRing, mistOpacity, childOpacity, onComplete]);

    const moonProps = useAnimatedProps(() => {
      'worklet';
      return { cy: moonY.value, r: size * 0.12, opacity: (1 - childOpacity.value) * 0.8 } as Record<
        string,
        number
      >;
    });
    const ringProps = useAnimatedProps(() => {
      'worklet';
      return {
        cy: moonY.value,
        r: size * 0.16 * eclipseRing.value,
        opacity: eclipseRing.value * (1 - childOpacity.value) * 0.5,
      } as Record<string, number>;
    });
    const mistProps = useAnimatedProps(() => {
      'worklet';
      return { r: size * 0.4, opacity: mistOpacity.value } as Record<string, number>;
    });
    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: 0.7 + childOpacity.value * 0.3 }],
    }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            animatedProps={mistProps}
            fill="rgb(80,0,0)"
          />
          <AnimatedCircle cx={size / 2} animatedProps={moonProps} fill="rgb(180,30,30)" />
          <AnimatedCircle
            cx={size / 2}
            animatedProps={ringProps}
            fill="none"
            stroke="rgb(220,50,50)"
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
BloodMoonRise.displayName = 'BloodMoonRise';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
