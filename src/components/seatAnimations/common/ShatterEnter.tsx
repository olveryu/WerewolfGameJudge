/**
 * ShatterEnter — 碎片入场
 *
 * 8 colored SVG shards explode outward from center, then children fade in.
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
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { RARE_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { AnimatedPath } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

const SHARD_COUNT = 8;
const EXPLODE_DURATION = RARE_DURATION * 0.55;
const FADE_IN_DURATION = RARE_DURATION * 0.5;

interface ColoredAnimationProps extends SeatAnimationProps {
  colors: FlairColorSet;
}

const Shard = memo<{
  index: number;
  size: number;
  progress: { value: number };
  color: string;
}>(({ index, size, progress, color }) => {
  const angle = (index / SHARD_COUNT) * Math.PI * 2;
  const cx = size / 2;
  const cy = size / 2;
  const shardSize = size * 0.08;

  const props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const dist = t * size * 0.45;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const half = shardSize * (1 - t * 0.5);
    const d = `M ${x} ${y - half} L ${x + half * 0.7} ${y + half * 0.5} L ${x - half * 0.7} ${y + half * 0.5} Z`;
    return { d, opacity: 1 - t } as Record<string, string | number>;
  });

  return <AnimatedPath animatedProps={props} fill={color} />;
});
Shard.displayName = 'Shard';

export const ShatterEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const explodeProgress = useSharedValue(0);
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      explodeProgress.value = withTiming(1, {
        duration: EXPLODE_DURATION,
        easing: Easing.out(Easing.quad),
      });
      childOpacity.value = withDelay(
        EXPLODE_DURATION * 0.3,
        withTiming(
          1,
          { duration: FADE_IN_DURATION, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(onComplete)();
          },
        ),
      );
    }, [explodeProgress, childOpacity, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: 0.8 + childOpacity.value * 0.2 }],
    }));

    const shards = useMemo(() => Array.from({ length: SHARD_COUNT }, (_, i) => i), []);

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          {shards.map((i) => (
            <Shard
              key={i}
              index={i}
              size={size}
              progress={explodeProgress}
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
ShatterEnter.displayName = 'ShatterEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
