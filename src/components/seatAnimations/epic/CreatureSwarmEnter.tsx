/**
 * CreatureSwarmEnter — 群体涌现
 *
 * Multiple small shapes (bats, crows, spirits) swarm around before settling.
 * Epic-tier archetype. Parameterized by creature count, shape, color, and path.
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
import { AnimatedPath } from '../svgAnimatedPrimitives';

export interface CreatureSwarmConfig {
  /** Creature body color */
  color: string;
  /** Wing/accent color */
  accentColor: string;
  /** Number of creatures (4-8) */
  creatureCount: number;
  /** Creature shape type */
  shape: 'bat' | 'bird' | 'wisp';
}

function creaturePath(
  shape: CreatureSwarmConfig['shape'],
  x: number,
  y: number,
  s: number,
): string {
  switch (shape) {
    case 'bat':
      return `M ${x} ${y} L ${x - s * 1.2} ${y - s * 0.6} L ${x - s * 0.5} ${y + s * 0.2} L ${x} ${y - s * 0.3} L ${x + s * 0.5} ${y + s * 0.2} L ${x + s * 1.2} ${y - s * 0.6} Z`;
    case 'bird':
      return `M ${x - s} ${y - s * 0.3} Q ${x - s * 0.3} ${y - s} ${x} ${y} Q ${x + s * 0.3} ${y - s} ${x + s} ${y - s * 0.3}`;
    case 'wisp':
      return `M ${x} ${y - s * 0.5} Q ${x + s * 0.5} ${y} ${x} ${y + s * 0.5} Q ${x - s * 0.5} ${y} ${x} ${y - s * 0.5}`;
  }
}

const Creature = memo<{
  index: number;
  total: number;
  size: number;
  progress: { value: number };
  config: CreatureSwarmConfig;
}>(({ index, total, size, progress, config }) => {
  const startAngle = (index / total) * Math.PI * 2;

  const props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    // Creatures fly in from outside, circle around, then converge to center
    const angle = startAngle + t * Math.PI * 3;
    const radius = size * 0.55 * (1 - t * 0.85);
    const x = size / 2 + Math.cos(angle) * radius;
    const y = size / 2 + Math.sin(angle) * radius + Math.sin(t * Math.PI * 4) * size * 0.03;
    const s = size * 0.04;
    return {
      d: creaturePath(config.shape, x, y, s),
      opacity: t < 0.1 ? t * 10 : t > 0.85 ? (1 - t) / 0.15 : 0.8,
    } as Record<string, string | number>;
  });

  return (
    <AnimatedPath
      animatedProps={props}
      fill={index % 2 === 0 ? config.color : config.accentColor}
    />
  );
});
Creature.displayName = 'Creature';

export const CreatureSwarmEnter = memo<SeatAnimationProps & { config: CreatureSwarmConfig }>(
  ({ size, borderRadius, onComplete, children, config }) => {
    const swarmProgress = useSharedValue(0);
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      swarmProgress.value = withTiming(1, {
        duration: EPIC_DURATION * 0.75,
        easing: Easing.inOut(Easing.cubic),
      });
      childOpacity.value = withDelay(
        EPIC_DURATION * 0.5,
        withTiming(
          1,
          { duration: EPIC_DURATION * 0.35, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(onComplete)();
          },
        ),
      );
    }, [swarmProgress, childOpacity, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: 0.7 + childOpacity.value * 0.3 }],
    }));

    const creatures = useMemo(
      () => Array.from({ length: config.creatureCount }, (_, i) => i),
      [config.creatureCount],
    );

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          {creatures.map((i) => (
            <Creature
              key={i}
              index={i}
              total={config.creatureCount}
              size={size}
              progress={swarmProgress}
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
CreatureSwarmEnter.displayName = 'CreatureSwarmEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
