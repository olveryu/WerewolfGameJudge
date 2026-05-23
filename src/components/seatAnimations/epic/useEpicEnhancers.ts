/**
 * useEpicEnhancers — shared flash overlay for all epic-tier entrance animations.
 *
 * Brief white flash overlay (0 → 0.35 → 0 in ~250ms) that distinguishes epic from rare.
 * Background glow is now handled by the Canvas overlay draw functions.
 */
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/** Flash fade-in duration (ms) */
const FLASH_IN = 100;
/** Flash fade-out duration (ms) */
const FLASH_OUT = 150;

/* eslint-disable react-native/no-color-literals -- intentional camera-flash white, not a theme color */
const epicStyles = StyleSheet.create({
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'white' },
});
/* eslint-enable react-native/no-color-literals */

/** Pre-built StyleSheet for the flash overlay. Use with `flashStyle` from the hook. */
export const EPIC_FLASH_STYLE = epicStyles.flash;

/**
 * Returns animated style for the epic-tier flash overlay.
 * Render an `Animated.View` with this style as the last container child (on top).
 */
export function useEpicFlash() {
  const flashOpacity = useSharedValue(0);

  useEffect(() => {
    flashOpacity.value = withTiming(0.35, { duration: FLASH_IN }, () => {
      'worklet';
      flashOpacity.value = withTiming(0, { duration: FLASH_OUT });
    });
  }, [flashOpacity]);

  return useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));
}
