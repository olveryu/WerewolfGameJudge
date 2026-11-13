// @vitest-environment-options {"url": "https://werewolfgamer.com/"}
import { dismissBootSplash } from '@/boot/dismissBootSplash';

const SPLASH_MARKUP = `
  <div id="boot-splash">
    <div id="boot-progress"><span id="boot-progress-bar"></span></div>
    <p id="boot-status">加载中…</p>
    <p id="boot-hint" hidden></p>
  </div>`;

type ObserverCallback = (list: { getEntries: () => PerformanceEntry[] }) => void;

let observerCallback: ObserverCallback | null = null;
const disconnect = vi.fn();

class FakePerformanceObserver {
  constructor(callback: ObserverCallback) {
    observerCallback = callback;
  }
  observe(): void {}
  disconnect(): void {
    disconnect();
  }
}

function resourceEntry(url: string): PerformanceEntry {
  return { name: url, entryType: 'resource', startTime: 0, duration: 0, toJSON: () => ({}) };
}

function emit(...urls: string[]): void {
  if (observerCallback === null) throw new Error('No observer registered');
  observerCallback({ getEntries: () => urls.map(resourceEntry) });
}

/** Mounts the splash markup, with `assets` as the #boot-assets JSON unless null, and runs the driver. */
async function startSplash(assets: unknown, buffered: readonly string[] = []): Promise<void> {
  document.body.innerHTML = SPLASH_MARKUP;
  if (assets !== null) {
    const assetList = document.createElement('script');
    assetList.type = 'application/json';
    assetList.id = 'boot-assets';
    assetList.text = JSON.stringify(assets);
    document.head.append(assetList);
  }
  vi.stubGlobal('PerformanceObserver', FakePerformanceObserver);
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue(buffered.map(resourceEntry));
  vi.resetModules();
  await import('@/boot/bootSplash');
}

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`#${id} missing`);
  return found;
}

describe('boot splash', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    disconnect.mockClear();
    observerCallback = null;
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('weighs progress by the bytes of the start-up files, buffered entries included', async () => {
    await startSplash(
      [
        { url: '/assets/index.js', bytes: 300 },
        { url: '/assets/vendor.js', bytes: 100 },
      ],
      ['https://werewolfgamer.com/assets/vendor.js', 'https://werewolfgamer.com/other.png'],
    );

    expect(element('boot-status').textContent).toBe('加载中… 25%');
    expect(element('boot-progress').getAttribute('aria-valuenow')).toBe('25');

    emit('https://werewolfgamer.com/assets/vendor.js', 'https://werewolfgamer.com/assets/index.js');

    expect(element('boot-status').textContent).toBe('正在启动…');
    expect(element('boot-progress').getAttribute('aria-valuenow')).toBe('100');
    expect(element('boot-progress-bar').style.transform).toBe('scaleX(1)');
    expect(disconnect).toHaveBeenCalled();
  });

  it('shows no progress without the build asset list', async () => {
    await startSplash(null);

    expect(observerCallback).toBeNull();
    expect(element('boot-status').textContent).toBe('加载中…');
  });

  it('rejects a malformed build asset list', async () => {
    await expect(startSplash([{ url: '/assets/index.js' }])).rejects.toThrow(
      '#boot-assets is not a list of { url, bytes }',
    );
  });

  it('stops tracking once the splash is removed', async () => {
    await startSplash([{ url: '/assets/index.js', bytes: 300 }]);
    const status = element('boot-status');
    element('boot-splash').remove();

    emit('https://werewolfgamer.com/assets/index.js');

    expect(status.textContent).toBe('加载中… 0%');
    expect(disconnect).toHaveBeenCalled();
  });

  it('hints and reveals the refresh link when a script fails to load', async () => {
    await startSplash(null);
    const script = document.createElement('script');
    document.head.append(script);

    script.dispatchEvent(new Event('error'));

    expect(element('boot-hint').hidden).toBe(false);
    expect(element('boot-hint').textContent).toBe('部分资源加载失败，请刷新重试');
    expect(element('boot-splash').dataset.stalled).toBe('');
  });

  it('hints while offline and clears the hint back online', async () => {
    await startSplash(null);

    window.dispatchEvent(new Event('offline'));
    expect(element('boot-hint').textContent).toBe('当前无网络连接，请检查网络后刷新');

    window.dispatchEvent(new Event('online'));
    expect(element('boot-hint').hidden).toBe(true);
  });

  it('fades the splash out and removes it when its own transition ends', () => {
    document.body.innerHTML = SPLASH_MARKUP;
    const splash = element('boot-splash');

    dismissBootSplash();
    expect(splash.classList.contains('boot-splash-leaving')).toBe(true);

    element('boot-progress-bar').dispatchEvent(new Event('transitionend', { bubbles: true }));
    expect(splash.isConnected).toBe(true);

    splash.dispatchEvent(new Event('transitionend'));
    expect(splash.isConnected).toBe(false);
  });
});
