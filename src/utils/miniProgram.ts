/**
 * miniProgram - 微信小程序 web-view 环境检测与通信
 *
 * 检测当前页面是否在微信小程序 web-view 内运行。
 * 使用 UA 中的 `miniProgram` 字样（微信 7.0.0+）或 `window.__wxjs_environment`。
 * 提供 postCurrentUrl() 供路由变化时通知小程序保存 URL。
 * 仅在 web 平台有意义；native 侧永远返回 false / no-op。
 */
import { Platform } from 'react-native';

declare global {
  interface Window {
    __wxjs_environment?: string;
    wx?: {
      miniProgram?: {
        postMessage(data: { data: Record<string, unknown> }): void;
        navigateTo(opts: { url: string }): void;
        navigateBack(opts?: { delta?: number }): void;
        getEnv(cb: (res: { miniprogram: boolean }) => void): void;
      };
    };
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

/**
 * 通知小程序当前页面 URL，用于恢复上次浏览位置。
 * postMessage 消息会在后退/销毁/分享/复制链接时批量送达小程序 onMessage。
 */
export function postCurrentUrl(): void {
  if (!isMiniProgram()) return;
  try {
    window.wx?.miniProgram?.postMessage({ data: { url: location.href } });
  } catch {
    // JSSDK 未加载或调用失败，静默忽略
  }
}
