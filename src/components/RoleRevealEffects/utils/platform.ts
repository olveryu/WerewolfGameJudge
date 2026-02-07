/**
 * platform - 揭示动画平台检测工具
 *
 * 提供平台判断、native driver / haptics / audio 能力检测。
 *
 * ✅ 允许：平台检测常量与纯函数
 * ❌ 禁止：import service / 游戏业务逻辑
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
