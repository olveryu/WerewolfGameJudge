/**
 * FlameEnvelopeEnter — 火焰包裹
 *
 * Flame-like particles envelope the tile from edges, then recede to reveal child.
 * Epic-tier archetype. Parameterized by flame color, intensity, direction.
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

export interface FlameEnvelopeConfig {
  color: string;
  accentColor: string;
  flameCount: number;
  direction: 'inward' | 'outward';
}

export const FlameEnvelopeEnter = memo<SeatAnimationProps & { config: FlameEnvelopeConfig }>(
  ({ size, borderRadius, onComplete, children, config }) => {
    const childOpacity = useSharedValue(0);
    const childScale = useSharedValue(0.8);
    const flashStyle = useEpicFlash();

    useEffect(() => {
      childOpacity.value = withDelay(
        EPIC_DURATION * 0.3,
        withTiming(
          1,
          { duration: EPIC_DURATION * 0.5, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) scheduleOnRN(onComplete);
          },
        ),
      );
      childScale.value = withDelay(
        EPIC_DURATION * 0.3,
        withSpring(1, { dampingRatio: 0.6, duration: 600 }),
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
          effectId="flameTongues"
          color={config.color}
          accentColor={config.accentColor}
          params={JSON.stringify({ flameCount: config.flameCount, direction: config.direction })}
          easing="linear"
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
FlameEnvelopeEnter.displayName = 'FlameEnvelopeEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
