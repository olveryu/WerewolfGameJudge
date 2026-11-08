/**
 * WeChat mini-program web-view detection and the claim-login nonce.
 *
 * Detection uses the `miniProgram` user-agent token (WeChat 7.0.0+) or
 * `window.__wxjs_environment`.
 */

declare global {
  interface Window {
    __wxjs_environment?: string;
  }
}

let cachedIsMiniProgram: boolean | null = null;

/** Whether the page runs inside a WeChat mini-program web-view. */
export function isMiniProgram(): boolean {
  cachedIsMiniProgram ??=
    /miniProgram/i.test(navigator.userAgent) || window.__wxjs_environment === 'miniprogram';
  return cachedIsMiniProgram;
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
