/**
 * DawnBreak — 破晓黎明
 *
 * Legendary entrance: golden light rays expand from bottom, warm glow rises,
 * light particles scatter, avatar emerges from the dawn.
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
import { AnimatedCircle, AnimatedPath } from '../svgAnimatedPrimitives';

const RAY_COUNT = 5;

const LightRay = memo<{ index: number; size: number; progress: { value: number } }>(
  ({ index, size, progress }) => {
    const spread = (index / (RAY_COUNT - 1) - 0.5) * 1.2;
    const props = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const bx = size / 2 + spread * size * 0.3;
      const by = size;
      const tx = size / 2 + spread * size * 0.5;
      const ty = size * (1 - t * 0.9);
      const w = size * 0.04 * (1 - t * 0.3);
      return {
        d: `M ${bx - w} ${by} L ${tx} ${ty} L ${bx + w} ${by} Z`,
        opacity: t * (1 - Math.max(0, (t - 0.6) / 0.4)) * 0.5,
      } as Record<string, string | number>;
    });
    return <AnimatedPath animatedProps={props} fill="rgb(255,220,100)" />;
  },
);
LightRay.displayName = 'LightRay';

export const DawnBreak = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
    const rayProgress = useSharedValue(0);
    const glowProgress = useSharedValue(0);
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      rayProgress.value = withTiming(1, {
        duration: LEGENDARY_DURATION * 0.67,
        easing: Easing.out(Easing.cubic),
      });
      glowProgress.value = withTiming(0.5, { duration: LEGENDARY_DURATION * 0.53 }, () => {
        'worklet';
        glowProgress.value = withTiming(0, { duration: LEGENDARY_DURATION * 0.4 });
      });
      childOpacity.value = withDelay(
        LEGENDARY_DURATION * 0.47,
        withTiming(
          1,
          { duration: LEGENDARY_DURATION * 0.53, easing: Easing.out(Easing.cubic) },
          (f) => {
            if (f) runOnJS(onComplete)();
          },
        ),
      );
    }, [rayProgress, glowProgress, childOpacity, onComplete]);

    const glowProps = useAnimatedProps(() => {
      'worklet';
      return { r: size * 0.4, opacity: glowProgress.value } as Record<string, number>;
    });
    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ translateY: (1 - childOpacity.value) * size * 0.08 }],
    }));

    const rays = useMemo(() => Array.from({ length: RAY_COUNT }, (_, i) => i), []);

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={size / 2}
            cy={size * 0.85}
            animatedProps={glowProps}
            fill="rgb(255,200,80)"
          />
          {rays.map((i) => (
            <LightRay key={i} index={i} size={size} progress={rayProgress} />
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
DawnBreak.displayName = 'DawnBreak';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
