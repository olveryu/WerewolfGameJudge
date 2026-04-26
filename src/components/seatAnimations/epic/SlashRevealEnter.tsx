/**
 * SlashRevealEnter — 爪痕揭示
 *
 * Diagonal slash lines sweep across the tile, revealing child behind.
 * Epic-tier archetype. Parameterized by slash count, angle, color, and speed.
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

export interface SlashRevealConfig {
  /** Slash line color */
  color: string;
  /** Accent glow color */
  accentColor: string;
  /** Number of slash lines (2-5) */
  slashCount: number;
  /** Base angle in degrees (0 = horizontal, 45 = diagonal) */
  baseAngle: number;
}

const SlashLine = memo<{
  index: number;
  total: number;
  size: number;
  progress: { value: number };
  config: SlashRevealConfig;
}>(({ index, total, size, progress, config }) => {
  const offset = (index / total) * size * 0.6 - size * 0.3;
  const rad = (config.baseAngle * Math.PI) / 180;

  const props = useAnimatedProps(() => {
    'worklet';
    const t = Math.min(progress.value * (1 + index * 0.15), 1);
    const len = t * size * 1.5;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const x1 = size / 2 - cos * size * 0.75 + sin * offset;
    const y1 = size / 2 - sin * size * 0.75 - cos * offset;
    const x2 = x1 + cos * len;
    const y2 = y1 + sin * len;
    return {
      d: `M ${x1} ${y1} L ${x2} ${y2}`,
      opacity: t > 0.1 ? (1 - t) * 0.7 : 0,
    } as Record<string, string | number>;
  });

  return (
    <AnimatedPath
      animatedProps={props}
      fill="none"
      stroke={index % 2 === 0 ? config.color : config.accentColor}
      strokeWidth={3}
      strokeLinecap="round"
    />
  );
});
SlashLine.displayName = 'SlashLine';

export const SlashRevealEnter = memo<SeatAnimationProps & { config: SlashRevealConfig }>(
  ({ size, borderRadius, onComplete, children, config }) => {
    const slashProgress = useSharedValue(0);
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      slashProgress.value = withTiming(1, {
        duration: EPIC_DURATION * 0.6,
        easing: Easing.out(Easing.quad),
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
    }, [slashProgress, childOpacity, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: 0.85 + childOpacity.value * 0.15 }],
    }));

    const slashes = useMemo(
      () => Array.from({ length: config.slashCount }, (_, i) => i),
      [config.slashCount],
    );

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          {slashes.map((i) => (
            <SlashLine
              key={i}
              index={i}
              total={config.slashCount}
              size={size}
              progress={slashProgress}
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
SlashRevealEnter.displayName = 'SlashRevealEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
