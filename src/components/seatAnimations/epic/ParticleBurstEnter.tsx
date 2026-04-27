/**
 * ParticleBurstEnter — 粒子爆散
 *
 * Particles burst outward from center in all directions, then child fades in.
 * Epic-tier archetype. Parameterized by particle count, color, shape, and speed.
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
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { EPIC_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { AnimatedCircle, AnimatedPath } from '../svgAnimatedPrimitives';
import { EPIC_FLASH_STYLE, useEpicEnhancers } from './useEpicEnhancers';

export interface ParticleBurstConfig {
  /** Primary particle color */
  color: string;
  /** Secondary accent color */
  accentColor: string;
  /** Number of particles (8-16) */
  particleCount: number;
  /** Particle shape: 'circle' uses circles, 'shard' uses triangular shards */
  shape: 'circle' | 'shard';
  /** Whether particles spiral outward or go straight */
  spiral: boolean;
}

const BurstParticle = memo<{
  index: number;
  total: number;
  size: number;
  progress: { value: number };
  config: ParticleBurstConfig;
}>(({ index, total, size, progress, config }) => {
  const angle = (index / total) * Math.PI * 2 + index * 0.3;
  const isAccent = index % 3 === 0;
  const isShard = config.shape === 'shard';

  const shardProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const spiralOffset = config.spiral ? t * Math.PI * 0.5 : 0;
    const dist = t * size * 0.48;
    const cx = size / 2 + Math.cos(angle + spiralOffset) * dist;
    const cy = size / 2 + Math.sin(angle + spiralOffset) * dist;
    const s = size * 0.05 * (1 - t * 0.6);
    return {
      d: `M ${cx} ${cy - s} L ${cx + s * 0.8} ${cy + s * 0.5} L ${cx - s * 0.8} ${cy + s * 0.5} Z`,
      opacity: (1 - t) * 0.8,
    } as Record<string, string | number>;
  });

  const circleProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const spiralOffset = config.spiral ? t * Math.PI * 0.8 : 0;
    const dist = t * size * 0.48;
    return {
      cx: size / 2 + Math.cos(angle + spiralOffset) * dist,
      cy: size / 2 + Math.sin(angle + spiralOffset) * dist,
      r: size * 0.025 * (1 - t * 0.5),
      opacity: (1 - t) * 0.8,
    } as Record<string, number>;
  });

  if (isShard) {
    return (
      <AnimatedPath
        animatedProps={shardProps}
        fill={isAccent ? config.accentColor : config.color}
      />
    );
  }

  return (
    <AnimatedCircle
      animatedProps={circleProps}
      fill={isAccent ? config.accentColor : config.color}
    />
  );
});
BurstParticle.displayName = 'BurstParticle';

export const ParticleBurstEnter = memo<SeatAnimationProps & { config: ParticleBurstConfig }>(
  ({ size, borderRadius, onComplete, children, config }) => {
    const burstProgress = useSharedValue(0);
    const childOpacity = useSharedValue(0);
    const childScale = useSharedValue(0.7);
    const { flashStyle, glowProps } = useEpicEnhancers(size);

    useEffect(() => {
      burstProgress.value = withTiming(1, {
        duration: EPIC_DURATION * 0.7,
        easing: Easing.out(Easing.quad),
      });
      childOpacity.value = withDelay(
        EPIC_DURATION * 0.14,
        withTiming(
          1,
          { duration: EPIC_DURATION * 0.3, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(onComplete)();
          },
        ),
      );
      childScale.value = withDelay(
        EPIC_DURATION * 0.14,
        withSpring(1, { dampingRatio: 0.6, duration: 600 }),
      );
    }, [burstProgress, childOpacity, childScale, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: childScale.value }],
    }));

    const particles = useMemo(
      () => Array.from({ length: config.particleCount }, (_, i) => i),
      [config.particleCount],
    );

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            animatedProps={glowProps}
            fill={config.color}
          />
          {particles.map((i) => (
            <BurstParticle
              key={i}
              index={i}
              total={config.particleCount}
              size={size}
              progress={burstProgress}
              config={config}
            />
          ))}
        </Svg>
        <Animated.View
          style={[styles.childWrapper, { width: size, height: size, borderRadius }, childStyle]}
        >
          {children}
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[EPIC_FLASH_STYLE, { borderRadius }, flashStyle]}
        />
      </View>
    );
  },
);
ParticleBurstEnter.displayName = 'ParticleBurstEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
