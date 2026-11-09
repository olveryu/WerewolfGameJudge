/**
 * WeChat mini-program web-view detection and the claim-login nonce.
 *
 * Detection uses the `miniProgram` user-agent token (WeChat 7.0.0+) or
 * `window.__wxjs_environment`.
 */

declare global {
  interface Window {
    __wxjs_environment?: string;
    wx?: {
      miniProgram?: {
        reLaunch(options: { url: string }): void;
      };
    };
  }
}

let cachedIsMiniProgram: boolean | null = null;

/** Whether the page runs inside a WeChat mini-program web-view. */
export function isMiniProgram(): boolean {
  cachedIsMiniProgram ??=
    /miniProgram/i.test(navigator.userAgent) || window.__wxjs_environment === 'miniprogram';
  return cachedIsMiniProgram;
}

/**
 * Reloads the mini-program home page so it runs `wx.login` again. Needs the JSSDK, which the
 * entry loads inside the mini-program.
 */
export function wxReLaunch(): void {
  const bridge = window.wx?.miniProgram;
  if (!bridge) throw new Error('wx.miniProgram is unavailable: the WeChat JSSDK is not loaded');
  bridge.reLaunch({ url: '/pages/index/index' });
}

const WX_CLAIM_NONCE_KEY = 'wx_claim_nonce';

/** Reads the claim nonce the mini-program login flow left behind. */
export function readClaimNonce(): string | null {
  return localStorage.getItem(WX_CLAIM_NONCE_KEY);
}

/** Clears the claim nonce after a successful claim. */
export function clearClaimNonce(): void {
  localStorage.removeItem(WX_CLAIM_NONCE_KEY);
}
