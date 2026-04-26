/**
 * WitchBrew — 女巫熬药
 *
 * Legendary entrance: bubbles rise from bottom, green mist swirls, cauldron glow
 * pulses, then avatar materializes from the brew.
 */
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { LEGENDARY_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { AnimatedCircle } from '../svgAnimatedPrimitives';
const BUBBLE_COUNT = 8;

const Bubble = memo<{
  index: number;
  size: number;
  progress: { value: number };
}>(({ index, size, progress }) => {
  const xFrac = 0.2 + (index / BUBBLE_COUNT) * 0.6;
  const delay = index * 0.08;
  const props = useAnimatedProps(() => {
    'worklet';
    const t = Math.max(0, Math.min((progress.value - delay) / (1 - delay), 1));
    return {
      cx: size * xFrac + Math.sin(t * Math.PI * 3 + index) * size * 0.04,
      cy: size * (0.9 - t * 0.7),
      r: size * (0.015 + (index % 3) * 0.008) * (1 - t * 0.3),
      opacity: t * (1 - Math.max(0, (t - 0.7) / 0.3)) * 0.7,
    } as Record<string, number>;
  });
  return (
    <AnimatedCircle
      animatedProps={props}
      fill={index % 2 === 0 ? 'rgb(100,220,100)' : 'rgb(50,180,80)'}
    />
  );
});
Bubble.displayName = 'Bubble';

export const WitchBrew = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
    const progress = useSharedValue(0);
    const glowOpacity = useSharedValue(0);
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      progress.value = withTiming(1, {
        duration: LEGENDARY_DURATION * 0.7,
        easing: Easing.out(Easing.cubic),
      });
      glowOpacity.value = withTiming(0.5, { duration: LEGENDARY_DURATION * 0.4 }, () => {
        'worklet';
        glowOpacity.value = withTiming(0, { duration: LEGENDARY_DURATION * 0.3 });
      });
      childOpacity.value = withDelay(
        LEGENDARY_DURATION * 0.4,
        withTiming(
          1,
          { duration: LEGENDARY_DURATION * 0.5, easing: Easing.out(Easing.cubic) },
          (f) => {
            if (f) runOnJS(onComplete)();
          },
        ),
      );
    }, [progress, glowOpacity, childOpacity, onComplete]);

    const glowProps = useAnimatedProps(() => {
      'worklet';
      return { r: size * 0.35, opacity: glowOpacity.value } as Record<string, number>;
    });
    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [
        { translateY: (1 - childOpacity.value) * size * 0.1 },
        { scale: 0.8 + childOpacity.value * 0.2 },
      ],
    }));

    const bubbles = useMemo(() => Array.from({ length: BUBBLE_COUNT }, (_, i) => i), []);

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={size / 2}
            cy={size * 0.6}
            animatedProps={glowProps}
            fill="rgb(50,200,80)"
          />
          {bubbles.map((i) => (
            <Bubble key={i} index={i} size={size} progress={progress} />
          ))}
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
WitchBrew.displayName = 'WitchBrew';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
