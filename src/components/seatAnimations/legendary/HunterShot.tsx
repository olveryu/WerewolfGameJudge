/**
 * HunterShot — 猎人开枪
 *
 * Legendary entrance: crosshair appears, locks on, muzzle flash, bullet trail,
 * shockwave reveals avatar.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { LEGENDARY_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { AnimatedCircle, AnimatedLine } from '../svgAnimatedPrimitives';

export const HunterShot = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
    const aim = useSharedValue(0);
    const flash = useSharedValue(0);
    const wave = useSharedValue(0);
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      aim.value = withTiming(1, {
        duration: LEGENDARY_DURATION * 0.47,
        easing: Easing.out(Easing.cubic),
      });
      flash.value = withDelay(
        LEGENDARY_DURATION * 0.47,
        withSequence(
          withTiming(1, { duration: LEGENDARY_DURATION * 0.11 }),
          withTiming(0, { duration: LEGENDARY_DURATION * 0.2 }),
        ),
      );
      wave.value = withDelay(
        LEGENDARY_DURATION * 0.53,
        withTiming(1, { duration: LEGENDARY_DURATION * 0.47, easing: Easing.out(Easing.cubic) }),
      );
      childOpacity.value = withDelay(
        LEGENDARY_DURATION * 0.53,
        withTiming(1, { duration: LEGENDARY_DURATION * 0.47 }, (f) => {
          if (f) runOnJS(onComplete)();
        }),
      );
    }, [aim, flash, wave, childOpacity, onComplete]);

    const cx = size / 2;
    const cy = size / 2;
    const crosshairV = useAnimatedProps(() => {
      'worklet';
      const r = size * 0.3 * (2 - aim.value);
      return { x1: cx, x2: cx, y1: cy - r, y2: cy + r, opacity: (1 - wave.value) * 0.6 } as Record<
        string,
        number
      >;
    });
    const crosshairH = useAnimatedProps(() => {
      'worklet';
      const r = size * 0.3 * (2 - aim.value);
      return { x1: cx - r, x2: cx + r, y1: cy, y2: cy, opacity: (1 - wave.value) * 0.6 } as Record<
        string,
        number
      >;
    });
    const flashProps = useAnimatedProps(() => {
      'worklet';
      return { r: size * 0.15 * flash.value, opacity: flash.value * 0.8 } as Record<string, number>;
    });
    const waveProps = useAnimatedProps(() => {
      'worklet';
      return { r: wave.value * size * 0.5, opacity: (1 - wave.value) * 0.4 } as Record<
        string,
        number
      >;
    });
    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: 0.8 + childOpacity.value * 0.2 }],
    }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedLine animatedProps={crosshairV} stroke="rgb(255,80,80)" strokeWidth={1.5} />
          <AnimatedLine animatedProps={crosshairH} stroke="rgb(255,80,80)" strokeWidth={1.5} />
          <AnimatedCircle cx={cx} cy={cy} animatedProps={flashProps} fill="rgb(255,255,200)" />
          <AnimatedCircle
            cx={cx}
            cy={cy}
            animatedProps={waveProps}
            fill="none"
            stroke="rgb(255,200,100)"
            strokeWidth={2}
          />
        </Svg>
        <Animated.View
          style={[styles.childWrapper, { width: size, height: size, borderRadius }, childStyle]}
        >
          {children}
        </Animated.View>
      </View>
    );
  },
);
HunterShot.displayName = 'HunterShot';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
