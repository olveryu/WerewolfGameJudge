/**
 * NightFall — 夜幕降临
 *
 * Stars twinkle, moon glows, darkness envelops then child appears.
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

export const NightFall = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      childOpacity.value = withDelay(
        LEGENDARY_DURATION * 0.55,
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
    }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <AnimationOverlay
          dom={{ matchContents: true }}
          size={size}
          duration={LEGENDARY_DURATION}
          effectId="nightFallStars"
          color="rgb(200,200,255)"
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
NightFall.displayName = 'NightFall';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
