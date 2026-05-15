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

// ── Path-based wxcode extraction (runs at module load, before React Navigation) ──
// 新版小程序把 wxcode 放在 path segment: /wx-auth/<code>/<original-path>
// 模块加载时立即提取并 rewrite URL，防止 React Navigation 路由到不存在的 screen。
let _extractedWxCode: string | null = null;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    const WX_AUTH_PREFIX = '/wx-auth/';
    const pathname = window.location.pathname;
    if (pathname.startsWith(WX_AUTH_PREFIX)) {
      const rest = pathname.slice(WX_AUTH_PREFIX.length);
      const slashIdx = rest.indexOf('/');
      if (slashIdx !== -1) {
        _extractedWxCode = decodeURIComponent(rest.slice(0, slashIdx));
        const realPath = rest.slice(slashIdx) || '/';
        window.history.replaceState(
          null,
          '',
          realPath + window.location.search + window.location.hash,
        );
      }
    }
  } catch {
    // readWxCode() will fall back to hash/query
  }
}

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
 * 读取小程序传入的 wxcode。
 * 从 path segment 提取（模块加载时已提取）。
 * 登录成功后应调用 clearWxCode() 清除。
 */
export function readWxCode(): string | null {
  if (Platform.OS !== 'web') return null;
  return _extractedWxCode;
}

/** 清除 wxcode path 缓存，防止刷新时重复使用过期 code。 */
export function clearWxCode(): void {
  if (Platform.OS !== 'web') return;
  _extractedWxCode = null;
}

/**
 * 调用 wx.miniProgram.reLaunch 让小程序重新加载首页。
 * 用于 wx.login code 失效后获取新 code（onLoad 重新走 wx.login）。
 */
export function wxReLaunch(): void {
  if (Platform.OS !== 'web') return;
  try {
    window.wx?.miniProgram?.reLaunch({ url: '/pages/index/index' });
  } catch (e) {
    log.warn('Failed to call wx.miniProgram.reLaunch', e);
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
