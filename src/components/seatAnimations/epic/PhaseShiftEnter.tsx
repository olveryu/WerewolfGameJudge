/**
 * PhaseShiftEnter — 相位偏移
 *
 * Ghost copies shift in/out with a glow behind, then child solidifies.
 * Epic-tier archetype.
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
import { EPIC_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { EPIC_FLASH_STYLE, useEpicFlash } from './useEpicEnhancers';

export interface PhaseShiftConfig {
  color: string;
  accentColor: string;
  pattern?: 'horizontal' | 'vertical' | 'radial';
}

export const PhaseShiftEnter = memo<SeatAnimationProps & { config: PhaseShiftConfig }>(
  ({ size, borderRadius, onComplete, children, config }) => {
    const childOpacity = useSharedValue(0);
    const flashStyle = useEpicFlash();

    useEffect(() => {
      childOpacity.value = withDelay(
        EPIC_DURATION * 0.5,
        withTiming(
          1,
          { duration: EPIC_DURATION * 0.4, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) scheduleOnRN(onComplete);
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
          duration={EPIC_DURATION}
          effectId="phaseGlow"
          color={config.color}
        />
        <Animated.View
          style={[styles.childWrapper, { width: size, height: size, borderRadius }, childStyle]}
        >
          {children}
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[EPIC_FLASH_STYLE, { borderRadius }, flashStyle]}
        />
      </View>
    );
  },
);
PhaseShiftEnter.displayName = 'PhaseShiftEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
