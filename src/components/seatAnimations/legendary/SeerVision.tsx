/**
 * SeerVision — 预言家之眼
 *
 * Legendary entrance: a glowing eye opens in the center, iris contracts,
 * vision ripples outward, avatar appears as if being "seen".
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
import { AnimatedCircle, AnimatedEllipse } from '../svgAnimatedPrimitives';

const PHASE1 = LEGENDARY_DURATION * 0.4; // eye opens
const PHASE2 = LEGENDARY_DURATION * 0.3; // iris focus
const PHASE3 = LEGENDARY_DURATION * 0.3; // ripple + reveal

export const SeerVision = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
    const eyeOpen = useSharedValue(0);
    const irisFocus = useSharedValue(0);
    const ripple = useSharedValue(0);
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      eyeOpen.value = withTiming(1, { duration: PHASE1, easing: Easing.out(Easing.cubic) });
      irisFocus.value = withDelay(
        PHASE1,
        withSequence(
          withTiming(1, { duration: PHASE2 * 0.6 }),
          withTiming(0.7, { duration: PHASE2 * 0.4 }),
        ),
      );
      ripple.value = withDelay(
        PHASE1 + PHASE2,
        withTiming(1, { duration: PHASE3, easing: Easing.out(Easing.cubic) }),
      );
      childOpacity.value = withDelay(
        PHASE1 + PHASE2 * 0.5,
        withTiming(1, { duration: PHASE3, easing: Easing.out(Easing.cubic) }, (f) => {
          if (f) runOnJS(onComplete)();
        }),
      );
    }, [eyeOpen, irisFocus, ripple, childOpacity, onComplete]);

    const outerEye = useAnimatedProps(() => {
      'worklet';
      return {
        rx: size * 0.35 * eyeOpen.value,
        ry: size * 0.2 * eyeOpen.value,
        opacity: (1 - ripple.value) * 0.5,
      } as Record<string, number>;
    });
    const iris = useAnimatedProps(() => {
      'worklet';
      const r = size * 0.12 * (1 - irisFocus.value * 0.4);
      return { r, opacity: (1 - ripple.value) * 0.8 } as Record<string, number>;
    });
    const pupil = useAnimatedProps(() => {
      'worklet';
      const r = size * 0.05 * (0.5 + irisFocus.value * 0.5);
      return { r, opacity: (1 - ripple.value) * 0.9 } as Record<string, number>;
    });
    const rippleRing = useAnimatedProps(() => {
      'worklet';
      return { r: ripple.value * size * 0.5, opacity: (1 - ripple.value) * 0.4 } as Record<
        string,
        number
      >;
    });
    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: 0.6 + childOpacity.value * 0.4 }],
    }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedEllipse
            cx={size / 2}
            cy={size / 2}
            animatedProps={outerEye}
            fill="none"
            stroke="rgb(100,150,255)"
            strokeWidth={2}
          />
          <AnimatedCircle cx={size / 2} cy={size / 2} animatedProps={iris} fill="rgb(80,130,220)" />
          <AnimatedCircle cx={size / 2} cy={size / 2} animatedProps={pupil} fill="rgb(20,20,40)" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            animatedProps={rippleRing}
            fill="none"
            stroke="rgb(150,200,255)"
            strokeWidth={1.5}
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
SeerVision.displayName = 'SeerVision';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
