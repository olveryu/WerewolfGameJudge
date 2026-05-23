/**
 * BounceEnter — 弹跳入场
 *
 * Children drop in with a spring bounce and a colored impact ring.
 * Common-tier entrance animation template.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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

export const BounceEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const translateY = useSharedValue(-size * 0.5);
    const opacity = useSharedValue(0);
    const timer = useSharedValue(0);

    useEffect(() => {
      opacity.value = withTiming(1, { duration: COMMON_DURATION * 0.15 });
      translateY.value = withSpring(0, { damping: 8, stiffness: 180 });
      timer.value = withTiming(1, { duration: COMMON_DURATION }, (finished) => {
        if (finished) scheduleOnRN(onComplete);
      });
    }, [translateY, opacity, timer, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <AnimationOverlay
          dom={{ matchContents: true }}
          size={size}
          duration={COMMON_DURATION}
          effectId="burstRing"
          color={colors.rgb}
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
BounceEnter.displayName = 'BounceEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
