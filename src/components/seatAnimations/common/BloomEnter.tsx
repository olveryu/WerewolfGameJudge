/**
 * BloomEnter — 花开入场
 *
 * Colored petals bloom outward from center, revealing children inside.
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
import { AnimatedEllipse } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

const PETAL_COUNT = 6;

interface ColoredAnimationProps extends SeatAnimationProps {
  colors: FlairColorSet;
}

const Petal = memo<{
  index: number;
  total: number;
  size: number;
  progress: { value: number };
  color: string;
}>(({ index, total, size, progress, color }) => {
  const angle = (index / total) * Math.PI * 2;

  const props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    // Petals bloom outward and fade
    const dist = t * size * 0.35;
    const cx = size / 2 + Math.cos(angle) * dist;
    const cy = size / 2 + Math.sin(angle) * dist;
    const rx = size * 0.06 * (0.3 + t * 0.7);
    const ry = size * 0.12 * (0.3 + t * 0.7);
    return {
      cx,
      cy,
      rx,
      ry,
      opacity: 0.7 * (1 - t * 0.8),
      // rotate via transform attribute not animatable via reanimated,
      // so we use rx/ry asymmetry + position to approximate petal shape
    } as Record<string, number>;
  });

  return <AnimatedEllipse animatedProps={props} fill={color} />;
});
Petal.displayName = 'Petal';

export const BloomEnter = memo<ColoredAnimationProps>(
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
      opacity: Math.min(progress.value * 2, 1),
      transform: [{ scale: 0.5 + progress.value * 0.5 }],
    }));

    const petals = useMemo(() => Array.from({ length: PETAL_COUNT }, (_, i) => i), []);

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          {petals.map((i) => (
            <Petal
              key={i}
              index={i}
              total={PETAL_COUNT}
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
BloomEnter.displayName = 'BloomEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
