/**
 * ShatterEnter — 碎片入场
 *
 * 8 colored shards explode outward from center, then children fade in.
 * Rare-tier entrance animation template.
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
import { RARE_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import type { FlairColorSet } from './palette';

const FADE_IN_DELAY = RARE_DURATION * 0.3;
const FADE_IN_DURATION = RARE_DURATION * 0.5;

interface ColoredAnimationProps extends SeatAnimationProps {
  colors: FlairColorSet;
}

export const ShatterEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      childOpacity.value = withDelay(
        FADE_IN_DELAY,
        withTiming(
          1,
          { duration: FADE_IN_DURATION, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) scheduleOnRN(onComplete);
          },
        ),
      );
    }, [childOpacity, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: 0.8 + childOpacity.value * 0.2 }],
    }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <AnimationOverlay
          dom={{ matchContents: true }}
          size={size}
          duration={RARE_DURATION}
          effectId="shatterShards"
          color={colors.rgb}
          accentColor={colors.rgbLight}
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
ShatterEnter.displayName = 'ShatterEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
