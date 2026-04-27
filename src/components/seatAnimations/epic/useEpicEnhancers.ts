/**
 * useEpicEnhancers — shared flash + glow for all epic-tier entrance animations.
 *
 * Two visual layers that distinguish epic from rare:
 * 1. Brief white flash overlay (0 → 0.35 → 0 in ~250ms)
 * 2. Background glow circle that fades in then out (~600ms in, ~1200ms out)
 */
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { EPIC_DURATION } from '../durations';

/** Flash fade-in duration (ms) */
const FLASH_IN = 100;
/** Flash fade-out duration (ms) */
const FLASH_OUT = 150;
/** Glow fade-in duration (ms) */
const GLOW_IN = EPIC_DURATION * 0.2;
/** Glow fade-out duration (ms) */
const GLOW_OUT = EPIC_DURATION * 0.4;

/* eslint-disable react-native/no-color-literals -- intentional camera-flash white, not a theme color */
const epicStyles = StyleSheet.create({
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'white' },
});
/* eslint-enable react-native/no-color-literals */

/** Pre-built StyleSheet for the flash overlay. Use with `flashStyle` from the hook. */
export const EPIC_FLASH_STYLE = epicStyles.flash;

/**
 * Returns animated styles/props for the epic-tier flash overlay and background glow.
 *
 * - Render an `AnimatedCircle` with `glowProps` as the first SVG child (behind effects)
 * - Render an `Animated.View` with `flashStyle` as the last container child (on top)
 */
export function useEpicEnhancers(size: number) {
  const flashOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    flashOpacity.value = withTiming(0.35, { duration: FLASH_IN }, () => {
      'worklet';
      flashOpacity.value = withTiming(0, { duration: FLASH_OUT });
    });
    glowOpacity.value = withTiming(0.3, { duration: GLOW_IN }, () => {
      'worklet';
      glowOpacity.value = withTiming(0, { duration: GLOW_OUT });
    });
  }, [flashOpacity, glowOpacity]);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const glowProps = useAnimatedProps(() => {
    'worklet';
    return {
      r: size * 0.45,
      opacity: glowOpacity.value,
    } as Record<string, number>;
  });

  return { flashStyle, glowProps };
}
