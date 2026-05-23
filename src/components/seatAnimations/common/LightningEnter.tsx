/**
 * LightningEnter — 闪电入场
 *
 * A lightning bolt strikes down, then children appear with a flash.
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

interface ColoredAnimationProps extends SeatAnimationProps {
  colors: FlairColorSet;
}

export const LightningEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const childOpacity = useSharedValue(0);
    const flashOpacity = useSharedValue(0);

    useEffect(() => {
      // Flash at bolt strike moment
      flashOpacity.value = withDelay(
        RARE_DURATION * 0.35,
        withTiming(0.6, { duration: 50 }, () => {
          'worklet';
          flashOpacity.value = withTiming(0, { duration: 200 });
        }),
      );
      // Children appear after bolt
      childOpacity.value = withDelay(
        RARE_DURATION * 0.4,
        withTiming(
          1,
          { duration: RARE_DURATION * 0.5, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) scheduleOnRN(onComplete);
          },
        ),
      );
    }, [childOpacity, flashOpacity, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: 0.9 + childOpacity.value * 0.1 }],
    }));

    const flashStyle = useAnimatedStyle(() => ({
      opacity: flashOpacity.value,
    }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <AnimationOverlay
          dom={{ matchContents: true }}
          size={size}
          duration={RARE_DURATION}
          effectId="lightningBolt"
          color={colors.rgb}
          easing="linear"
        />
        <Animated.View
          style={[styles.childWrapper, { width: size, height: size, borderRadius }, childStyle]}
        >
          {children}
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.flash, { borderRadius }, flashStyle]} />
      </View>
    );
  },
);
LightningEnter.displayName = 'LightningEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  // eslint-disable-next-line react-native/no-color-literals
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'white' },
});
