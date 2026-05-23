/**
 * SpiritSummon — 灵魂召唤
 *
 * Spirit wisps converge inward, glow intensifies, then child materializes.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import AnimationOverlay from '../AnimationOverlay';
import { LEGENDARY_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';

export const SpiritSummon = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      childOpacity.value = withDelay(
        LEGENDARY_DURATION * 0.5,
        withTiming(
          1,
          { duration: LEGENDARY_DURATION * 0.35, easing: Easing.out(Easing.cubic) },
          (f) => {
            if (f) scheduleOnRN(onComplete);
          },
        ),
      );
    }, [childOpacity, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: 0.7 + childOpacity.value * 0.3 }],
    }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <AnimationOverlay
          dom={{ matchContents: true }}
          size={size}
          duration={LEGENDARY_DURATION}
          effectId="spiritWisps"
          color="rgb(150,200,255)"
          easing="linear"
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
SpiritSummon.displayName = 'SpiritSummon';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
