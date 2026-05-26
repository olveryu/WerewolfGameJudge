/**
 * platform - reveal animation platform detection utilities
 *
 * Provides platform checks and native driver / haptics / audio capability detection.
 * Exports platform detection constants and pure functions. No service imports, no game business logic.
 */
import { Platform } from 'react-native';

/**
 * Check if running on web platform
 */
const _isWeb = Platform.OS === 'web';

/**
 * Check if running on iOS
 */
const isIOS = Platform.OS === 'ios';

/**
 * Check if running on Android
 */
const isAndroid = Platform.OS === 'android';

/**
 * Check if haptics are available on this platform
 */
export function canUseHaptics(): boolean {
  return isIOS || isAndroid;
}
