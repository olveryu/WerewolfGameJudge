/**
 * SpiralEnter — 螺旋入场
 *
 * Children spin in along a spiral path while colored particles orbit inward.
 * Rare-tier entrance animation template.
 */
import { memo, useEffect, useMemo } from 'react';
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

import { RARE_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { AnimatedCircle } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

const PARTICLE_COUNT = 6;

interface ColoredAnimationProps extends SeatAnimationProps {
  colors: FlairColorSet;
}

const SpiralParticle = memo<{
  index: number;
  total: number;
  size: number;
  progress: { value: number };
  color: string;
}>(({ index, total, size, progress, color }) => {
  const phase = (index / total) * Math.PI * 2;

  const props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const angle = phase + t * Math.PI * 3;
    const radius = size * 0.45 * (1 - t);
    const cx = size / 2 + Math.cos(angle) * radius;
    const cy = size / 2 + Math.sin(angle) * radius;
    return {
      cx,
      cy,
      r: size * 0.025 * (1 - t * 0.5),
      opacity: 0.7 * (1 - t),
    } as Record<string, number>;
  });

  return <AnimatedCircle animatedProps={props} fill={color} />;
});
SpiralParticle.displayName = 'SpiralParticle';

export const SpiralEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const progress = useSharedValue(0);

    useEffect(() => {
      progress.value = withTiming(
        1,
        { duration: RARE_DURATION, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onComplete)();
        },
      );
    }, [progress, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: Math.min(progress.value * 1.5, 1),
      transform: [
        { rotate: `${(1 - progress.value) * 720}deg` },
        { scale: 0.2 + progress.value * 0.8 },
      ],
    }));

    const particles = useMemo(() => Array.from({ length: PARTICLE_COUNT }, (_, i) => i), []);

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          {particles.map((i) => (
            <SpiralParticle
              key={i}
              index={i}
              total={PARTICLE_COUNT}
              size={size}
              progress={progress}
              color={i % 2 === 0 ? colors.rgb : colors.rgbLight}
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
SpiralEnter.displayName = 'SpiralEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
