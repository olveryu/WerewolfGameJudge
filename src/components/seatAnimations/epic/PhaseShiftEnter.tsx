/**
 * PhaseShiftEnter — 相位偏移
 *
 * Child appears with a ghostly shimmer/phase effect — multiple translucent copies offset.
 * Epic-tier archetype. Parameterized by phase count, color tint, and shift pattern.
 */
import { memo, useEffect } from 'react';
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

import { EPIC_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { AnimatedCircle } from '../svgAnimatedPrimitives';

export interface PhaseShiftConfig {
  /** Shimmer/ghost color */
  color: string;
  /** Glow accent color */
  accentColor: string;
  /** Shift pattern: 'horizontal' | 'vertical' | 'radial' */
  pattern: 'horizontal' | 'vertical' | 'radial';
}

export const PhaseShiftEnter = memo<SeatAnimationProps & { config: PhaseShiftConfig }>(
  ({ size, borderRadius, onComplete, children, config }) => {
    const progress = useSharedValue(0);

    useEffect(() => {
      progress.value = withTiming(
        1,
        {
          duration: EPIC_DURATION,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) runOnJS(onComplete)();
        },
      );
    }, [progress, onComplete]);

    // Ghost copy offset
    const ghostStyle = useAnimatedStyle(() => {
      const t = progress.value;
      const offset = (1 - t) * size * 0.12;
      const tx = config.pattern === 'horizontal' ? offset : 0;
      const ty = config.pattern === 'vertical' ? offset : 0;
      const sc = config.pattern === 'radial' ? 1.1 - t * 0.1 : 1;
      return {
        opacity: (1 - t) * 0.4,
        transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
      };
    });

    // Second ghost in opposite direction
    const ghost2Style = useAnimatedStyle(() => {
      const t = progress.value;
      const offset = (1 - t) * size * 0.12;
      const tx = config.pattern === 'horizontal' ? -offset : 0;
      const ty = config.pattern === 'vertical' ? -offset : 0;
      const sc = config.pattern === 'radial' ? 0.9 + t * 0.1 : 1;
      return {
        opacity: (1 - t) * 0.3,
        transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
      };
    });

    const childStyle = useAnimatedStyle(() => ({
      opacity: progress.value,
    }));

    const glowProps = useAnimatedProps(() => {
      'worklet';
      return {
        r: size * 0.4,
        opacity: (1 - progress.value) * 0.25,
      } as Record<string, number>;
    });

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            animatedProps={glowProps}
            fill={config.accentColor}
          />
        </Svg>
        <Animated.View
          style={[styles.childWrapper, { width: size, height: size, borderRadius }, ghostStyle]}
        >
          {children}
        </Animated.View>
        <Animated.View
          style={[styles.childWrapper, { width: size, height: size, borderRadius }, ghost2Style]}
        >
          {children}
        </Animated.View>
        <Animated.View
          style={[styles.childWrapper, { width: size, height: size, borderRadius }, childStyle]}
        >
          {children}
        </Animated.View>
      </View>
    );
  },
);
PhaseShiftEnter.displayName = 'PhaseShiftEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
