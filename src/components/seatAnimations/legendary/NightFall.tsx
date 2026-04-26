/**
 * NightFall — 夜幕降临
 *
 * Legendary entrance: darkness sweeps down from top, stars twinkle on,
 * crescent moon glows, then all fades to reveal avatar.
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
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { LEGENDARY_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { AnimatedCircle } from '../svgAnimatedPrimitives';

const STAR_COUNT = 6;
const STARS = Array.from({ length: STAR_COUNT }, (_, i) => ({
  x: 0.15 + Math.sin(i * 2.3) * 0.3 + 0.35,
  y: 0.1 + (i / STAR_COUNT) * 0.5,
  delay: i * 0.08,
}));

const Star = memo<{ star: (typeof STARS)[number]; size: number; progress: { value: number } }>(
  ({ star, size, progress }) => {
    const props = useAnimatedProps(() => {
      'worklet';
      const t = Math.max(0, Math.min((progress.value - star.delay) / (1 - star.delay), 1));
      return {
        cx: star.x * size,
        cy: star.y * size,
        r: size * 0.01 * t,
        opacity: t * 0.8,
      } as Record<string, number>;
    });
    return <AnimatedCircle animatedProps={props} fill="rgb(255,255,200)" />;
  },
);
Star.displayName = 'Star';

export const NightFall = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
    const darkness = useSharedValue(0);
    const starProgress = useSharedValue(0);
    const moonGlow = useSharedValue(0);
    const reveal = useSharedValue(0);

    useEffect(() => {
      darkness.value = withTiming(1, {
        duration: LEGENDARY_DURATION * 0.3,
        easing: Easing.out(Easing.cubic),
      });
      starProgress.value = withDelay(
        LEGENDARY_DURATION * 0.2,
        withTiming(1, { duration: LEGENDARY_DURATION * 0.4 }),
      );
      moonGlow.value = withDelay(
        LEGENDARY_DURATION * 0.4,
        withTiming(0.7, { duration: LEGENDARY_DURATION * 0.25 }),
      );
      reveal.value = withDelay(
        LEGENDARY_DURATION * 0.65,
        withTiming(
          1,
          { duration: LEGENDARY_DURATION * 0.35, easing: Easing.out(Easing.cubic) },
          (f) => {
            if (f) runOnJS(onComplete)();
          },
        ),
      );
    }, [darkness, starProgress, moonGlow, reveal, onComplete]);

    const darkOverlay = useAnimatedStyle(() => ({
      opacity: darkness.value * (1 - reveal.value) * 0.6,
      backgroundColor: 'rgb(10,10,30)',
    }));
    const moonProps = useAnimatedProps(() => {
      'worklet';
      return { r: size * 0.08, opacity: moonGlow.value * (1 - reveal.value) } as Record<
        string,
        number
      >;
    });
    const childStyle = useAnimatedStyle(() => ({
      opacity: reveal.value,
      transform: [{ scale: 0.8 + reveal.value * 0.2 }],
    }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Animated.View style={[StyleSheet.absoluteFill, darkOverlay]} />
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          {STARS.map((s, i) => (
            <Star key={i} star={s} size={size} progress={starProgress} />
          ))}
          <AnimatedCircle
            cx={size * 0.75}
            cy={size * 0.2}
            animatedProps={moonProps}
            fill="rgb(255,250,200)"
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
NightFall.displayName = 'NightFall';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
