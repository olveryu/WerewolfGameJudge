/**
 * Platform utilities for RoleRevealEffects
 *
 * Handles platform detection and capability checks.
 */
import { Platform, AccessibilityInfo } from 'react-native';

/**
 * Check if running on web platform
 */
export const isWeb = Platform.OS === 'web';

/**
 * Check if running on iOS
 */
export const isIOS = Platform.OS === 'ios';

/**
 * Check if running on Android
 */
export const isAndroid = Platform.OS === 'android';

/**
 * Check if native driver is available for animations
 * Web doesn't support native driver for all animations
 */
export const canUseNativeDriver = !isWeb;

/**
 * Get system reduced motion preference
 * Returns a promise that resolves to boolean
 */
export async function getReducedMotionPreference(): Promise<boolean> {
  try {
    return await AccessibilityInfo.isReduceMotionEnabled();
  } catch {
    // Default to false if not available
    return false;
  }
}

/**
 * Check if haptics are available on this platform
 */
export function canUseHaptics(): boolean {
  return isIOS || isAndroid;
}

/**
 * Check if audio is likely available
 * This is a heuristic - actual availability requires trying to load audio
 */
export function canUseAudio(): boolean {
  // Audio should work on all platforms, but may fail at runtime
  return true;
}

/**
 * Get optimal particle count based on platform
 * Web and low-end devices get fewer particles
 */
export function getOptimalParticleCount(desired: number): number {
  if (isWeb) {
    return Math.max(1, Math.floor(desired * 0.5));
  }
  return desired;
}

/**
 * Get optimal fragment count based on platform
 */
export function getOptimalFragmentGrid(
  rows: number,
  cols: number
): { rows: number; cols: number } {
  if (isWeb) {
    // Reduce grid size for web performance
    return {
      rows: Math.max(2, Math.floor(rows * 0.75)),
      cols: Math.max(2, Math.floor(cols * 0.75)),
    };
  }
  return { rows, cols };
}
