/**
 * miniProgram - 微信小程序 web-view 环境检测
 *
 * 检测当前页面是否在微信小程序 web-view 内运行。
 * 使用 UA 中的 `miniProgram` 字样（微信 7.0.0+）或 `window.__wxjs_environment`。
 * 仅在 web 平台有意义；native 侧永远返回 false。
 */
import { Platform } from 'react-native';

declare global {
  interface Window {
    __wxjs_environment?: string;
  }
}

let cached: boolean | null = null;

/** 当前页面是否在微信小程序 web-view 内运行 */
export function isMiniProgram(): boolean {
  if (Platform.OS !== 'web') return false;
  if (cached !== null) return cached;
  if (typeof navigator === 'undefined') {
    cached = false;
    return false;
  }
  cached =
    /miniProgram/i.test(navigator.userAgent) ||
    (typeof window !== 'undefined' && window.__wxjs_environment === 'miniprogram');
  return cached;
}
