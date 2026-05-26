/**
 * miniProgram - WeChat mini-program web-view environment detection and communication
 *
 * Detects whether the current page is running inside a WeChat mini-program web-view.
 * Uses the `miniProgram` token in UA (WeChat 7.0.0+) or `window.__wxjs_environment`.
 * Only meaningful on web platform; native side always returns false / no-op.
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

/** Whether the current page is running inside a WeChat mini-program web-view */
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
 * Calls wx.miniProgram.reLaunch to make the mini-program reload the home page.
 * Used to obtain a new code after wx.login code expires (onLoad re-runs wx.login).
 */
export function wxReLaunch(): void {
  if (Platform.OS !== 'web') return;
  try {
    window.wx!.miniProgram!.reLaunch({ url: '/pages/index/index' });
  } catch (e) {
    log.warn('Failed to call wx.miniProgram.reLaunch', e);
  }
}

// ── Claim-based auth flow ───────────────────────────────────────────────────

const WX_CLAIM_NONCE_KEY = 'wx_claim_nonce';

/**
 * Generate or read claim nonce.
 * First call generates a UUID and stores it in localStorage; subsequent calls read it directly.
 */
export function getOrCreateClaimNonce(): string {
  if (Platform.OS !== 'web') return '';
  const existing = localStorage.getItem(WX_CLAIM_NONCE_KEY);
  if (existing) return existing;
  const nonce = crypto.randomUUID();
  localStorage.setItem(WX_CLAIM_NONCE_KEY, nonce);
  return nonce;
}

/** Read existing claim nonce (do not create a new one). */
export function readClaimNonce(): string | null {
  if (Platform.OS !== 'web') return null;
  return localStorage.getItem(WX_CLAIM_NONCE_KEY);
}

/** Clear claim nonce (called after successful claim). */
export function clearClaimNonce(): void {
  if (Platform.OS !== 'web') return;
  localStorage.removeItem(WX_CLAIM_NONCE_KEY);
}

/**
 * Calls wx.miniProgram.reLaunch with a nonce so the mini-program native side completes login.
 * After receiving nonce in onLoad, the mini-program calls /auth/wechat-claim via wx.login + wx.request.
 */
export function wxReLaunchWithNonce(nonce: string): void {
  if (Platform.OS !== 'web') return;
  try {
    window.wx!.miniProgram!.reLaunch({ url: '/pages/index/index?nonce=' + nonce });
  } catch (e) {
    log.warn('Failed to call wx.miniProgram.reLaunch with nonce', e);
  }
}

/**
 * Calls WeChat JSSDK wx.previewImage to show the native image previewer.
 * Available inside web-view; user can long-press to save/forward. Requires HTTP(S) URL (no base64).
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
