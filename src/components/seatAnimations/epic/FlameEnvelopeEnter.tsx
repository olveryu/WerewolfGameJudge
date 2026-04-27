/**
 * FlameEnvelopeEnter — 火焰包裹
 *
 * Flame-like particles envelope the tile from edges, then recede to reveal child.
 * Epic-tier archetype. Parameterized by flame color, intensity, direction.
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

export interface FlameEnvelopeConfig {
  /** Flame primary color */
  color: string;
  /** Flame tip/accent color */
  accentColor: string;
  /** Number of flame tongues (6-10) */
  flameCount: number;
  /** 'inward' = flames converge to center, 'outward' = flames expand from center */
  direction: 'inward' | 'outward';
}

const FlameTongue = memo<{
  index: number;
  total: number;
  size: number;
  progress: { value: number };
  config: FlameEnvelopeConfig;
}>(({ index, total, size, progress, config }) => {
  const angle = (index / total) * Math.PI * 2;
  const isInward = config.direction === 'inward';

  const props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const flickerPhase = t * Math.PI * 6 + index;
    const flicker = Math.sin(flickerPhase) * 0.15;
    const baseRadius = isInward ? size * 0.5 * (1 - t * 0.8) : size * 0.1 + t * size * 0.35;
    const tipRadius = baseRadius + size * (0.08 + flicker);
    const cx = size / 2;
    const cy = size / 2;
    const bx = cx + Math.cos(angle) * baseRadius;
    const by = cy + Math.sin(angle) * baseRadius;
    const tx = cx + Math.cos(angle) * tipRadius;
    const ty = cy + Math.sin(angle) * tipRadius;
    const spread = size * 0.03;
    const perpX = -Math.sin(angle) * spread;
    const perpY = Math.cos(angle) * spread;
    return {
      d: `M ${bx + perpX} ${by + perpY} Q ${tx} ${ty} ${bx - perpX} ${by - perpY}`,
      opacity: isInward ? 0.7 * (1 - t) : 0.7 * t * (1 - Math.max(0, (t - 0.7) / 0.3)),
    } as Record<string, string | number>;
  });

  return (
    <AnimatedPath
      animatedProps={props}
      fill={index % 3 === 0 ? config.accentColor : config.color}
    />
  );
});
FlameTongue.displayName = 'FlameTongue';

export const FlameEnvelopeEnter = memo<SeatAnimationProps & { config: FlameEnvelopeConfig }>(
  ({ size, borderRadius, onComplete, children, config }) => {
    const flameProgress = useSharedValue(0);
    const childOpacity = useSharedValue(0);
    const childScale = useSharedValue(0.8);
    const { flashStyle, glowProps } = useEpicEnhancers(size);

    useEffect(() => {
      flameProgress.value = withTiming(1, {
        duration: EPIC_DURATION * 0.7,
        easing: Easing.out(Easing.cubic),
      });
      childOpacity.value = withDelay(
        EPIC_DURATION * 0.3,
        withTiming(
          1,
          { duration: EPIC_DURATION * 0.5, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(onComplete)();
          },
        ),
      );
      childScale.value = withDelay(
        EPIC_DURATION * 0.3,
        withSpring(1, { dampingRatio: 0.6, duration: 600 }),
      );
    }, [flameProgress, childOpacity, childScale, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: childScale.value }],
    }));

    const flames = useMemo(
      () => Array.from({ length: config.flameCount }, (_, i) => i),
      [config.flameCount],
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
          {flames.map((i) => (
            <FlameTongue
              key={i}
              index={i}
              total={config.flameCount}
              size={size}
              progress={flameProgress}
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
FlameEnvelopeEnter.displayName = 'FlameEnvelopeEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
