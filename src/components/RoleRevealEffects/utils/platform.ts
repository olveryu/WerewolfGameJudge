/**
 * platform - 揭示动画平台检测工具
 *
 * 提供平台判断、native driver / haptics / audio 能力检测。
 * 导出平台检测常量与纯函数。不 import service，不含游戏业务逻辑。
 */
import { Platform } from 'react-native';

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
 * Check if haptics are available on this platform
 */
export function canUseHaptics(): boolean {
  return isIOS || isAndroid;
}
