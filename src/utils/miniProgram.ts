/**
 * miniProgram - 微信小程序 web-view 环境检测与通信
 *
 * 检测当前页面是否在微信小程序 web-view 内运行。
 * 使用 UA 中的 `miniProgram` 字样（微信 7.0.0+）或 `window.__wxjs_environment`。
 * 仅在 web 平台有意义；native 侧永远返回 false / no-op。
 */
import { Platform } from 'react-native';

import { log } from '@/utils/logger';

declare global {
  interface Window {
    __wxjs_environment?: string;
    wx?: {
      miniProgram?: {
        postMessage(data: { data: Record<string, unknown> }): void;
        navigateTo(opts: { url: string }): void;
        navigateBack(opts?: { delta?: number }): void;
        reLaunch(opts: { url: string }): void;
        getEnv(cb: (res: { miniprogram: boolean }) => void): void;
      };
      previewImage?(opts: {
        current?: string;
        urls: string[];
        success?: () => void;
        fail?: (err: { errMsg: string }) => void;
      }): void;
    };
  }
}

let cached: boolean | null = null;

/** 本次 session 是否曾在 URL 中检测到 wxcode 参数（即来自小程序入口） */
let _hadWxCode = false;

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
 * 从 URL query 中读取小程序传入的 wxcode 参数（不删除）。
 * 登录成功后应调用 clearWxCode() 清除。
 * 仅 web 平台有效；无 wxcode 时返回 null。
 */
export function readWxCode(): string | null {
  if (Platform.OS !== 'web') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('wxcode');
    if (code) _hadWxCode = true;
    return code;
  } catch {
    log.warn('Failed to read wxcode');
    return null;
  }
}

/**
 * 本次 session 是否曾从 URL 中读到过 wxcode 参数。
 * 即使 clearWxCode() 已删除 URL 参数，此标记仍为 true。
 * 用于 UA 检测不可靠时作为"来自小程序"的确定性信号。
 */
export function hadWxCode(): boolean {
  return _hadWxCode;
}

/** 从 URL 中移除 wxcode 参数，防止刷新时重复使用过期 code。 */
export function clearWxCode(): void {
  if (Platform.OS !== 'web') return;
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('wxcode')) return;
    params.delete('wxcode');
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
    window.history.replaceState(null, '', newUrl);
  } catch {
    log.warn('Failed to clear wxcode');
  }
}

/**
 * 调用微信 JSSDK wx.previewImage 展示原生图片预览器。
 * web-view 中可用；用户可长按保存/转发。需要 HTTP(S) URL（不支持 base64）。
 */
export function wxPreviewImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.wx?.previewImage) {
      reject(new Error('wx.previewImage not available'));
      return;
    }
    window.wx.previewImage({
      urls: [url],
      success: () => resolve(),
      fail: (err) => reject(new Error(err.errMsg)),
    });
  });
}
