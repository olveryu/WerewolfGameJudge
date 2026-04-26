/**
 * LightningEnter — 闪电入场
 *
 * A zigzag lightning bolt strikes down, then children flash in.
 * Rare-tier entrance animation template.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { RARE_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { AnimatedCircle, AnimatedPath } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

const STRIKE_DURATION = RARE_DURATION * 0.35;
const FLASH_DURATION = RARE_DURATION * 0.2;
const SETTLE_DURATION = RARE_DURATION * 0.45;

interface ColoredAnimationProps extends SeatAnimationProps {
  colors: FlairColorSet;
}

export const LightningEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const strikeProgress = useSharedValue(0);
    const flashOpacity = useSharedValue(0);
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      strikeProgress.value = withTiming(1, {
        duration: STRIKE_DURATION,
        easing: Easing.in(Easing.quad),
      });
      flashOpacity.value = withDelay(
        STRIKE_DURATION,
        withSequence(
          withTiming(0.8, { duration: FLASH_DURATION * 0.3 }),
          withTiming(0, { duration: FLASH_DURATION * 0.7 }),
        ),
      );
      childOpacity.value = withDelay(
        STRIKE_DURATION,
        withTiming(
          1,
          { duration: SETTLE_DURATION, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(onComplete)();
          },
        ),
      );
    }, [strikeProgress, flashOpacity, childOpacity, onComplete]);

    const boltProps = useAnimatedProps(() => {
      'worklet';
      const t = strikeProgress.value;
      const cx = size / 2;
      // Zigzag bolt: top → 40% left → 55% right → center bottom
      const endY = size * t;
      const points = [
        `M ${cx} 0`,
        `L ${cx - size * 0.15} ${endY * 0.35}`,
        `L ${cx + size * 0.1} ${endY * 0.5}`,
        `L ${cx - size * 0.05} ${endY * 0.7}`,
        `L ${cx} ${endY}`,
      ];
      return {
        d: points.join(' '),
        opacity: 1 - childOpacity.value,
      } as Record<string, string | number>;
    });

    const flashProps = useAnimatedStyle(() => ({
      opacity: flashOpacity.value,
    }));

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: 0.9 + childOpacity.value * 0.1 }],
    }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedPath
            animatedProps={boltProps}
            fill="none"
            stroke={colors.rgb}
            strokeWidth={3}
            strokeLinejoin="bevel"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={size * 0.45}
            fill={colors.rgbLight}
            opacity={0}
          />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashProps]}>
          <View style={[styles.flashInner, { backgroundColor: colors.rgbLight }]} />
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
LightningEnter.displayName = 'LightningEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  flash: { justifyContent: 'center', alignItems: 'center' },
  flashInner: { width: '100%', height: '100%', opacity: 0.3 },
});
