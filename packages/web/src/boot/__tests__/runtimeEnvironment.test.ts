// @vitest-environment-options {"url": "https://werewolfgamer.com/"}
import { resolveRuntimeEnvironment } from '@/boot/runtimeEnvironment';

const WECHAT_UA = 'Mozilla/5.0 (iPhone) AppleWebKit Mobile MicroMessenger/8.0.50';

function useUserAgent(userAgent: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
}

describe('resolveRuntimeEnvironment', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete window.__wxjs_environment;
    document.head.querySelectorAll('script').forEach((script) => script.remove());
  });

  it('treats non-WeChat user agents as a plain browser', async () => {
    useUserAgent('Mozilla/5.0 (Macintosh) Chrome/140');
    await expect(resolveRuntimeEnvironment()).resolves.toBe('browser');
  });

  it('recognises the mini-program from the user agent and loads the JSSDK', async () => {
    useUserAgent(`${WECHAT_UA} miniProgram`);
    await expect(resolveRuntimeEnvironment()).resolves.toBe('miniProgram');
    expect(document.head.querySelector('script')?.src).toBe(
      'https://res.wx.qq.com/open/js/jweixin-1.3.2.js',
    );
  });

  it('confirms the mini-program once the WeChat bridge is ready', async () => {
    useUserAgent(WECHAT_UA);
    const environment = resolveRuntimeEnvironment();
    window.__wxjs_environment = 'miniprogram';
    document.dispatchEvent(new Event('WeixinJSBridgeReady'));
    await expect(environment).resolves.toBe('miniProgram');
  });

  it('falls back to the WeChat in-app browser when no bridge appears within 1 s', async () => {
    vi.useFakeTimers();
    useUserAgent(WECHAT_UA);
    const environment = resolveRuntimeEnvironment();
    await vi.advanceTimersByTimeAsync(1000);
    await expect(environment).resolves.toBe('wechatBrowser');
    expect(document.head.querySelector('script')).toBeNull();
  });
});
