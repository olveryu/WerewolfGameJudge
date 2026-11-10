/**
 * Boot splash driver. The build loads it as its own module script ahead of the app entry
 * (build-plugins/bootSplash.ts), so it runs while the entry's module graph downloads. It weighs
 * progress by the gzip bytes of the start-up files listed in #boot-assets, shows offline and
 * failed-resource hints, and goes quiet once the app removes the splash.
 */

interface BootAsset {
  readonly url: string;
  readonly bytes: number;
}

const OFFLINE_HINT = '当前无网络连接，请检查网络后刷新';
const RESOURCE_FAILED_HINT = '部分资源加载失败，请刷新重试';

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`index.html is missing #${id}`);
  return element;
}

const splash = requireElement('boot-splash');
const progress = requireElement('boot-progress');
const progressBar = requireElement('boot-progress-bar');
const statusText = requireElement('boot-status');
const hint = requireElement('boot-hint');

function showHint(message: string): void {
  hint.textContent = message;
  hint.hidden = false;
  splash.dataset.stalled = '';
}

function trackProgress(assets: readonly BootAsset[]): void {
  const pendingBytes = new Map(
    assets.map((asset) => [new URL(asset.url, document.baseURI).href, asset.bytes]),
  );
  const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
  let loadedBytes = 0;

  const record = (entries: readonly PerformanceEntry[]): void => {
    for (const entry of entries) {
      const bytes = pendingBytes.get(entry.name);
      if (bytes === undefined) continue;
      pendingBytes.delete(entry.name);
      loadedBytes += bytes;
    }
    const fraction = loadedBytes / totalBytes;
    const percent = Math.floor(fraction * 100);
    progress.setAttribute('aria-valuenow', String(percent));
    progressBar.style.transform = `scaleX(${fraction})`;
    statusText.textContent = pendingBytes.size === 0 ? '正在启动…' : `加载中… ${percent}%`;
  };

  const observer = new PerformanceObserver((list) => {
    if (splash.isConnected) record(list.getEntries());
    if (!splash.isConnected || pendingBytes.size === 0) observer.disconnect();
  });
  // `entryTypes` rather than `{ type, buffered }`: the latter needs Safari 14.1+, above the build floor.
  observer.observe({ entryTypes: ['resource'] });
  record(performance.getEntriesByType('resource'));
}

function isBootAsset(value: unknown): value is BootAsset {
  return (
    typeof value === 'object' &&
    value !== null &&
    'url' in value &&
    typeof value.url === 'string' &&
    'bytes' in value &&
    typeof value.bytes === 'number'
  );
}

/** Parses the build-generated #boot-assets list; a malformed list is a build bug and throws. */
function parseBootAssets(text: string): readonly BootAsset[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed) || !parsed.every(isBootAsset)) {
    throw new Error('#boot-assets is not a list of { url, bytes }');
  }
  return parsed;
}

const assetList = document.querySelector<HTMLScriptElement>('#boot-assets');
// The dev server has no build output to weigh, so progress runs in builds only.
if (assetList !== null) trackProgress(parseBootAssets(assetList.text));

if (!navigator.onLine) showHint(OFFLINE_HINT);
window.addEventListener('offline', () => showHint(OFFLINE_HINT));
window.addEventListener('online', () => {
  hint.hidden = true;
});
// Capture phase: resource load errors do not bubble.
window.addEventListener(
  'error',
  (event) => {
    if (event.target instanceof HTMLScriptElement || event.target instanceof HTMLLinkElement) {
      showHint(navigator.onLine ? RESOURCE_FAILED_HINT : OFFLINE_HINT);
    }
  },
  true,
);

export {};
