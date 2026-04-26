/**
 * SpiritSummon — 灵魂召唤
 *
 * Legendary entrance: ghostly wisps circle inward, summoning circle glows,
 * spirit energy converges, avatar materializes from spirit realm.
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

const WISP_COUNT = 6;

const Wisp = memo<{ index: number; total: number; size: number; progress: { value: number } }>(
  ({ index, total, size, progress }) => {
    const startAngle = (index / total) * Math.PI * 2;
    const props = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const angle = startAngle + t * Math.PI * 4;
      const radius = size * 0.45 * (1 - t * 0.9);
      return {
        cx: size / 2 + Math.cos(angle) * radius,
        cy: size / 2 + Math.sin(angle) * radius,
        r: size * 0.025 * (1 - t * 0.5),
        opacity: 0.7 * (1 - t * 0.5),
      } as Record<string, number>;
    });
    return (
      <AnimatedCircle
        animatedProps={props}
        fill={index % 2 === 0 ? 'rgb(150,200,255)' : 'rgb(200,220,255)'}
      />
    );
  },
);
Wisp.displayName = 'Wisp';

export const SpiritSummon = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
    const wispProgress = useSharedValue(0);
    const circleGlow = useSharedValue(0);
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      wispProgress.value = withTiming(1, {
        duration: LEGENDARY_DURATION * 0.78,
        easing: Easing.inOut(Easing.cubic),
      });
      circleGlow.value = withDelay(
        LEGENDARY_DURATION * 0.22,
        withTiming(0.5, { duration: LEGENDARY_DURATION * 0.33 }, () => {
          'worklet';
          circleGlow.value = withTiming(0, { duration: LEGENDARY_DURATION * 0.33 });
        }),
      );
      childOpacity.value = withDelay(
        LEGENDARY_DURATION * 0.56,
        withTiming(
          1,
          { duration: LEGENDARY_DURATION * 0.44, easing: Easing.out(Easing.cubic) },
          (f) => {
            if (f) runOnJS(onComplete)();
          },
        ),
      );
    }, [wispProgress, circleGlow, childOpacity, onComplete]);

    const glowProps = useAnimatedProps(() => {
      'worklet';
      return { r: size * 0.3, opacity: circleGlow.value } as Record<string, number>;
    });
    const outerRing = useAnimatedProps(() => {
      'worklet';
      return { r: size * 0.38, opacity: circleGlow.value * 0.4 } as Record<string, number>;
    });
    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: 0.5 + childOpacity.value * 0.5 }],
    }));

    const wisps = useMemo(() => Array.from({ length: WISP_COUNT }, (_, i) => i), []);

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            animatedProps={glowProps}
            fill="rgb(100,150,255)"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            animatedProps={outerRing}
            fill="none"
            stroke="rgb(150,180,255)"
            strokeWidth={1.5}
          />
          {wisps.map((i) => (
            <Wisp key={i} index={i} total={WISP_COUNT} size={size} progress={wispProgress} />
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
SpiritSummon.displayName = 'SpiritSummon';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
