/**
 * RisingElementEnter — 元素升腾
 *
 * Diamond/leaf/drop shapes rise upward, then child appears.
 * Epic-tier archetype.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import AnimationOverlay from '../AnimationOverlay';
import { EPIC_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { EPIC_FLASH_STYLE, useEpicFlash } from './useEpicEnhancers';

export interface RisingElementConfig {
  color: string;
  accentColor: string;
  elementCount: number;
  shape: 'diamond' | 'leaf' | 'drop' | 'circle';
  direction?: 'up' | 'down';
}

export const RisingElementEnter = memo<SeatAnimationProps & { config: RisingElementConfig }>(
  ({ size, borderRadius, onComplete, children, config }) => {
    const childOpacity = useSharedValue(0);
    const childScale = useSharedValue(0.8);
    const flashStyle = useEpicFlash();

    useEffect(() => {
      childOpacity.value = withDelay(
        EPIC_DURATION * 0.35,
        withTiming(
          1,
          { duration: EPIC_DURATION * 0.45, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) scheduleOnRN(onComplete);
          },
        ),
      );
      childScale.value = withDelay(
        EPIC_DURATION * 0.35,
        withSpring(1, { dampingRatio: 0.7, duration: 500 }),
      );
    }, [childOpacity, childScale, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: childScale.value }],
    }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <AnimationOverlay
          dom={{ matchContents: true }}
          size={size}
          duration={EPIC_DURATION}
          effectId="risingShapes"
          color={config.color}
          accentColor={config.accentColor}
          params={JSON.stringify({ elementCount: config.elementCount, shape: config.shape })}
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
RisingElementEnter.displayName = 'RisingElementEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
