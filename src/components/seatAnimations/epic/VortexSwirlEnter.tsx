/**
 * VortexSwirlEnter — 漩涡汇聚
 *
 * Particles swirl inward toward center in a vortex pattern, then child appears.
 * Epic-tier archetype. Parameterized by rotation direction, speed, color, and density.
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

import { EPIC_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { AnimatedCircle } from '../svgAnimatedPrimitives';

export interface VortexSwirlConfig {
  /** Primary particle color */
  color: string;
  /** Trail/accent color */
  accentColor: string;
  /** Number of swirl particles (6-12) */
  particleCount: number;
  /** 1 = clockwise, -1 = counter-clockwise */
  direction: 1 | -1;
  /** Number of full rotations */
  rotations: number;
}

const SwirlParticle = memo<{
  index: number;
  total: number;
  size: number;
  progress: { value: number };
  config: VortexSwirlConfig;
}>(({ index, total, size, progress, config }) => {
  const startAngle = (index / total) * Math.PI * 2;

  const props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const angle = startAngle + t * Math.PI * 2 * config.rotations * config.direction;
    const radius = size * 0.45 * (1 - t * 0.9);
    return {
      cx: size / 2 + Math.cos(angle) * radius,
      cy: size / 2 + Math.sin(angle) * radius,
      r: size * 0.02 * (0.5 + (1 - t) * 0.5),
      opacity: 0.8 * (1 - t * 0.7),
    } as Record<string, number>;
  });

  return (
    <AnimatedCircle
      animatedProps={props}
      fill={index % 2 === 0 ? config.color : config.accentColor}
    />
  );
});
SwirlParticle.displayName = 'SwirlParticle';

export const VortexSwirlEnter = memo<SeatAnimationProps & { config: VortexSwirlConfig }>(
  ({ size, borderRadius, onComplete, children, config }) => {
    const swirlProgress = useSharedValue(0);
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      swirlProgress.value = withTiming(1, {
        duration: EPIC_DURATION * 0.7,
        easing: Easing.inOut(Easing.cubic),
      });
      childOpacity.value = withDelay(
        EPIC_DURATION * 0.4,
        withTiming(
          1,
          { duration: EPIC_DURATION * 0.4, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(onComplete)();
          },
        ),
      );
    }, [swirlProgress, childOpacity, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [
        { rotate: `${(1 - childOpacity.value) * 90 * config.direction}deg` },
        { scale: 0.6 + childOpacity.value * 0.4 },
      ],
    }));

    const particles = useMemo(
      () => Array.from({ length: config.particleCount }, (_, i) => i),
      [config.particleCount],
    );

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          {particles.map((i) => (
            <SwirlParticle
              key={i}
              index={i}
              total={config.particleCount}
              size={size}
              progress={swirlProgress}
              config={config}
            />
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
VortexSwirlEnter.displayName = 'VortexSwirlEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
