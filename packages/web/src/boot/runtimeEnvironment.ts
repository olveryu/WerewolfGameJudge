/**
 * Start-up environment checks that used to be inline scripts in web/index.html.
 *
 * Inside WeChat, the page is either the mini-program web-view (the supported runtime; the
 * JSSDK is loaded for `wx.miniProgram`) or WeChat's in-app browser, which gets a guide to open
 * the site in a real browser instead of the app. Detection follows WeChat's documented order:
 * the `miniProgram` user-agent token (WeChat 7.0.0+), else `window.__wxjs_environment` once
 * `WeixinJSBridgeReady` fires; no bridge within 1 s means the in-app browser.
 */

declare global {
  interface Window {
    WeixinJSBridge?: unknown;
  }
}

const JSSDK_URL = 'https://res.wx.qq.com/open/js/jweixin-1.3.2.js';
const BRIDGE_TIMEOUT_MS = 1000;

export type RuntimeEnvironment = 'browser' | 'miniProgram' | 'wechatBrowser';

function loadJssdk(): void {
  const script = document.createElement('script');
  script.src = JSSDK_URL;
  document.head.append(script);
}

function waitForBridge(): Promise<RuntimeEnvironment> {
  return new Promise((resolve) => {
    const settle = () =>
      resolve(window.__wxjs_environment === 'miniprogram' ? 'miniProgram' : 'wechatBrowser');
    if (window.WeixinJSBridge !== undefined) {
      settle();
      return;
    }
    document.addEventListener('WeixinJSBridgeReady', settle, { once: true });
    window.setTimeout(settle, BRIDGE_TIMEOUT_MS);
  });
}

/** Resolves where the app runs and loads the JSSDK inside the mini-program. */
export async function resolveRuntimeEnvironment(): Promise<RuntimeEnvironment> {
  const userAgent = navigator.userAgent;
  if (!/MicroMessenger/i.test(userAgent) || location.hostname === 'localhost') return 'browser';
  const environment = /miniProgram/i.test(userAgent) ? 'miniProgram' : await waitForBridge();
  if (environment === 'miniProgram') loadJssdk();
  return environment;
}
