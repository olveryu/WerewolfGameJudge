/**
 * RisingElementEnter — 元素升起
 *
 * Elements rise from the bottom edge (or fall from top) before child appears.
 * Epic-tier archetype. Parameterized by direction, element shape, color, and count.
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

export interface RisingElementConfig {
  /** Element color */
  color: string;
  /** Accent color for alternating elements */
  accentColor: string;
  /** Number of rising elements (4-8) */
  elementCount: number;
  /** 'up' = rise from bottom, 'down' = fall from top */
  direction: 'up' | 'down';
  /** Element shape */
  shape: 'circle' | 'diamond' | 'leaf';
}

const RisingElement = memo<{
  index: number;
  total: number;
  size: number;
  progress: { value: number };
  config: RisingElementConfig;
}>(({ index, total, size, progress, config }) => {
  const xFrac = 0.1 + (index / total) * 0.8;
  const phase = index * 0.1;
  const isUp = config.direction === 'up';
  const isPath = config.shape === 'diamond' || config.shape === 'leaf';

  const pathProps = useAnimatedProps(() => {
    'worklet';
    const t = Math.max(0, Math.min((progress.value - phase) / (1 - phase), 1));
    const x = size * xFrac + Math.sin(t * Math.PI * 2) * size * 0.05;
    const startY = isUp ? size * 1.1 : -size * 0.1;
    const endY = size * (0.2 + (index % 3) * 0.2);
    const y = startY + (endY - startY) * t;
    const s = size * 0.04;
    const d =
      config.shape === 'diamond'
        ? `M ${x} ${y - s} L ${x + s} ${y} L ${x} ${y + s} L ${x - s} ${y} Z`
        : `M ${x} ${y - s} Q ${x + s * 1.5} ${y} ${x} ${y + s} Q ${x - s * 1.5} ${y} ${x} ${y - s}`;
    return {
      d,
      opacity: t * (1 - Math.max(0, (progress.value - 0.7) / 0.3)),
    } as Record<string, string | number>;
  });

  const circleProps = useAnimatedProps(() => {
    'worklet';
    const t = Math.max(0, Math.min((progress.value - phase) / (1 - phase), 1));
    const x = size * xFrac + Math.sin(t * Math.PI * 2) * size * 0.05;
    const startY = isUp ? size * 1.1 : -size * 0.1;
    const endY = size * (0.2 + (index % 3) * 0.2);
    const y = startY + (endY - startY) * t;
    return {
      cx: x,
      cy: y,
      r: size * 0.02 * (0.5 + t * 0.5),
      opacity: t * (1 - Math.max(0, (progress.value - 0.7) / 0.3)),
    } as Record<string, number>;
  });

  if (isPath) {
    return (
      <AnimatedPath
        animatedProps={pathProps}
        fill={index % 2 === 0 ? config.color : config.accentColor}
      />
    );
  }

  return (
    <AnimatedCircle
      animatedProps={circleProps}
      fill={index % 2 === 0 ? config.color : config.accentColor}
    />
  );
});
RisingElement.displayName = 'RisingElement';

export const RisingElementEnter = memo<SeatAnimationProps & { config: RisingElementConfig }>(
  ({ size, borderRadius, onComplete, children, config }) => {
    const elementProgress = useSharedValue(0);
    const childOpacity = useSharedValue(0);
    const childScale = useSharedValue(0.8);
    const { flashStyle, glowProps } = useEpicEnhancers(size);

    useEffect(() => {
      elementProgress.value = withTiming(1, {
        duration: EPIC_DURATION * 0.7,
        easing: Easing.out(Easing.cubic),
      });
      childOpacity.value = withDelay(
        EPIC_DURATION * 0.25,
        withTiming(
          1,
          { duration: EPIC_DURATION * 0.5, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(onComplete)();
          },
        ),
      );
      childScale.value = withDelay(
        EPIC_DURATION * 0.25,
        withSpring(1, { dampingRatio: 0.6, duration: 600 }),
      );
    }, [elementProgress, childOpacity, childScale, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [
        {
          translateY:
            (1 - childOpacity.value) * (config.direction === 'up' ? size * 0.15 : -size * 0.15),
        },
        { scale: childScale.value },
      ],
    }));

    const elements = useMemo(
      () => Array.from({ length: config.elementCount }, (_, i) => i),
      [config.elementCount],
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
          {elements.map((i) => (
            <RisingElement
              key={i}
              index={i}
              total={config.elementCount}
              size={size}
              progress={elementProgress}
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
RisingElementEnter.displayName = 'RisingElementEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
