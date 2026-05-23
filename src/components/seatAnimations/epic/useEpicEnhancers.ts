/**
 * useEpicEnhancers — shared flash overlay for all epic-tier entrance animations.
 *
 * Brief white flash overlay (0 → 0.35 → 0 in ~250ms) that distinguishes epic from rare.
 * Background glow is now handled by the Canvas overlay draw functions.
 */
import { StyleSheet } from 'react-native';

import { buildAnimationStyle } from '../cssAnimations';

/* eslint-disable react-native/no-color-literals -- intentional camera-flash white, not a theme color */
const epicStyles = StyleSheet.create({
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'white', opacity: 0 },
});
/* eslint-enable react-native/no-color-literals */

/** Pre-built StyleSheet for the flash overlay. Use with `EPIC_FLASH_ANIM_STYLE`. */
export const EPIC_FLASH_STYLE = epicStyles.flash;

/** CSS animation style for the epic flash overlay (250ms pulse). */
export const EPIC_FLASH_ANIM_STYLE = buildAnimationStyle({
  name: 'seatEpicFlash',
  duration: 250,
  easing: 'linear',
});
