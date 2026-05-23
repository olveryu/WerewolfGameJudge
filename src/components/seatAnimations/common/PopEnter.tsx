/**
 * PopEnter — 弹出入场
 *
 * Children pop in with an elastic overshoot scale and a colored burst ring.
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

export const PopEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const timer = useSharedValue(0);

    useEffect(() => {
      opacity.value = withTiming(1, { duration: COMMON_DURATION * 0.1 });
      scale.value = withSpring(1, { damping: 6, stiffness: 200 });
      timer.value = withTiming(1, { duration: COMMON_DURATION }, (finished) => {
        if (finished) scheduleOnRN(onComplete);
      });
    }, [scale, opacity, timer, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
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
PopEnter.displayName = 'PopEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
