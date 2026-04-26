/**
 * WolfKingEntry — 狼王登场
 *
 * Legendary entrance: glowing wolf-eye pupils appear, claw slashes form an X,
 * then a blood-red shockwave reveals the avatar with a zoom-in.
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
import { AnimatedCircle, AnimatedPath } from '../svgAnimatedPrimitives';

const PHASE1 = LEGENDARY_DURATION * 0.36; // eyes appear
const PHASE2 = LEGENDARY_DURATION * 0.32; // claw slashes
const PHASE3 = LEGENDARY_DURATION * 0.32; // shockwave + reveal

export const WolfKingEntry = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
    const eyeGlow = useSharedValue(0);
    const slashProgress = useSharedValue(0);
    const waveProgress = useSharedValue(0);
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      eyeGlow.value = withSequence(
        withTiming(1, { duration: PHASE1 * 0.6 }),
        withTiming(0.5, { duration: PHASE1 * 0.4 }),
      );
      slashProgress.value = withDelay(
        PHASE1,
        withTiming(1, { duration: PHASE2, easing: Easing.out(Easing.quad) }),
      );
      waveProgress.value = withDelay(
        PHASE1 + PHASE2,
        withTiming(1, { duration: PHASE3, easing: Easing.out(Easing.cubic) }),
      );
      childOpacity.value = withDelay(
        PHASE1 + PHASE2 * 0.5,
        withTiming(1, { duration: PHASE3, easing: Easing.out(Easing.cubic) }, (f) => {
          if (f) runOnJS(onComplete)();
        }),
      );
    }, [eyeGlow, slashProgress, waveProgress, childOpacity, onComplete]);

    const leftEye = useAnimatedProps(() => {
      'worklet';
      return { r: size * 0.03, opacity: eyeGlow.value * 0.9 } as Record<string, number>;
    });
    const rightEye = useAnimatedProps(() => {
      'worklet';
      return { r: size * 0.03, opacity: eyeGlow.value * 0.9 } as Record<string, number>;
    });
    const slash1 = useAnimatedProps(() => {
      'worklet';
      const t = slashProgress.value;
      const x1 = size * 0.15;
      const y1 = size * 0.15;
      const x2 = x1 + t * size * 0.7;
      const y2 = y1 + t * size * 0.7;
      return {
        d: `M ${x1} ${y1} L ${x2} ${y2}`,
        opacity: (1 - waveProgress.value) * 0.7,
      } as Record<string, string | number>;
    });
    const slash2 = useAnimatedProps(() => {
      'worklet';
      const t = slashProgress.value;
      const x1 = size * 0.85;
      const y1 = size * 0.15;
      const x2 = x1 - t * size * 0.7;
      const y2 = y1 + t * size * 0.7;
      return {
        d: `M ${x1} ${y1} L ${x2} ${y2}`,
        opacity: (1 - waveProgress.value) * 0.7,
      } as Record<string, string | number>;
    });
    const wave = useAnimatedProps(() => {
      'worklet';
      return {
        r: waveProgress.value * size * 0.55,
        opacity: (1 - waveProgress.value) * 0.4,
      } as Record<string, number>;
    });
    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: 0.5 + childOpacity.value * 0.5 }],
    }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={size * 0.38}
            cy={size * 0.38}
            animatedProps={leftEye}
            fill="rgb(255,50,50)"
          />
          <AnimatedCircle
            cx={size * 0.62}
            cy={size * 0.38}
            animatedProps={rightEye}
            fill="rgb(255,50,50)"
          />
          <AnimatedPath
            animatedProps={slash1}
            fill="none"
            stroke="rgb(200,30,30)"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <AnimatedPath
            animatedProps={slash2}
            fill="none"
            stroke="rgb(200,30,30)"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            animatedProps={wave}
            fill="none"
            stroke="rgb(180,20,20)"
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
WolfKingEntry.displayName = 'WolfKingEntry';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
