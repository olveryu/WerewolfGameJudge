/** Mythic entrance: a high-backed throne rises behind the seat, then fades. No equipment state or IO. */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { MYTHIC_COLORS, MYTHIC_ENTRY_DURATION } from '@/config/mythicVisual';

import type { SeatAnimationProps } from './SeatAnimationProps';

/** Reveals children without owning equipment state; completion is sent only for a finished animation. */
export const ThroneArrival = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
    const progress = useSharedValue(0);
    useEffect(() => {
      progress.value = withTiming(
        1,
        { duration: MYTHIC_ENTRY_DURATION, easing: Easing.linear },
        (finished) => {
          if (finished) scheduleOnRN(onComplete);
        },
      );
      return () => cancelAnimation(progress);
    }, [onComplete, progress]);
    const contentStyle = useAnimatedStyle(() => ({
      opacity: Math.min(1, Math.max(0, (progress.value - 0.4) / 0.35)),
      transform: [
        { translateY: (1 - Math.min(1, progress.value * 1.5)) * size * 0.15 },
        { scale: 0.9 + Math.min(1, progress.value * 1.5) * 0.1 },
      ],
    }));
    const throneStyle = useAnimatedStyle(() => ({
      opacity: Math.min(1, progress.value * 5) * (1 - Math.max(0, (progress.value - 0.65) / 0.35)),
      transform: [{ translateY: size * 0.4 * (1 - Math.min(1, progress.value / 0.4)) }],
    }));
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, throneStyle]}>
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Path d="M16 94 L23 84 H77 L84 94 Z" fill={MYTHIC_COLORS.metal} />
            <Path
              d="M29 75 V27 Q29 15 50 5 Q71 15 71 27 V75 Z"
              fill={MYTHIC_COLORS.obsidian}
              stroke={MYTHIC_COLORS.silver}
              strokeWidth={2.5}
            />
            <Path d="M35 67 V29 Q35 22 50 13 Q65 22 65 29 V67 Z" fill={MYTHIC_COLORS.enamel} />
            <Path
              d="M50 16 V64 M37 30 L63 50 M63 30 L37 50"
              fill="none"
              stroke={MYTHIC_COLORS.crimson}
              strokeWidth={1.5}
            />
            <Path
              d="M21 53 H30 V75 H70 V53 H79 V85 H21 Z"
              fill={MYTHIC_COLORS.obsidian}
              stroke={MYTHIC_COLORS.silver}
              strokeWidth={2}
            />
            <Path
              d="M30 69 H70 L74 76 H26 Z"
              fill={MYTHIC_COLORS.crimson}
              stroke={MYTHIC_COLORS.silver}
              strokeWidth={1.5}
            />
            <Path
              d="M24 85 V90 M76 85 V90 M23 55 H29 M71 55 H77"
              stroke={MYTHIC_COLORS.pearl}
              strokeWidth={3}
            />
          </Svg>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, contentStyle]}>{children}</Animated.View>
      </View>
    );
  },
);
ThroneArrival.displayName = 'ThroneArrival';
const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
});
