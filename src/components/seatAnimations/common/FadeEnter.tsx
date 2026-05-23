/**
 * FadeEnter — 淡入
 *
 * Children fade from transparent to opaque with a subtle colored glow behind.
 * Common-tier entrance animation template.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import AnimationOverlay from '../AnimationOverlay';
import { COMMON_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import type { FlairColorSet } from './palette';

interface ColoredAnimationProps extends SeatAnimationProps {
  colors: FlairColorSet;
}

export const FadeEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const opacity = useSharedValue(0);

    useEffect(() => {
      opacity.value = withTiming(
        1,
        { duration: COMMON_DURATION * 0.75, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) scheduleOnRN(onComplete);
        },
      );
    }, [opacity, onComplete]);

    const childStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <AnimationOverlay
          dom={{ matchContents: true }}
          size={size}
          duration={COMMON_DURATION}
          effectId="staticGlow"
          color={colors.rgbLight}
        />
        <Animated.View
          style={[styles.childWrapper, { width: size, height: size, borderRadius }, childStyle]}
        >
          {children}
        </Animated.View>
      </View>
    );
  },
);
FadeEnter.displayName = 'FadeEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
