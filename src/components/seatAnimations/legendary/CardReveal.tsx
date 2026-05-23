/**
 * CardReveal — 翻牌登场
 *
 * Sparkle dots radiate outward, then child flips into view.
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

export const CardReveal = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      childOpacity.value = withDelay(
        LEGENDARY_DURATION * 0.4,
        withTiming(
          1,
          { duration: LEGENDARY_DURATION * 0.4, easing: Easing.out(Easing.cubic) },
          (f) => {
            if (f) scheduleOnRN(onComplete);
          },
        ),
      );
    }, [childOpacity, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ perspective: 800 }, { rotateY: `${(1 - childOpacity.value) * 90}deg` }],
    }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <AnimationOverlay
          dom={{ matchContents: true }}
          size={size}
          duration={LEGENDARY_DURATION}
          effectId="cardSparkles"
          color="rgb(255,200,50)"
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
CardReveal.displayName = 'CardReveal';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
