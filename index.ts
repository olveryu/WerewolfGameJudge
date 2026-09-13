import './src/wdyr';

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// Polyfill crypto.randomUUID for iOS < 15.4 (Safari < 15.4).
// crypto.getRandomValues is available from iOS 11+.
if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  crypto.randomUUID = function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version 4 (0100) and variant 1 (10xx)
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

// Polyfill Array.prototype.at for iOS < 15.4 (Safari < 15.4).
if (typeof Array.prototype.at !== 'function') {
  Array.prototype.at = function at<T>(this: T[], index: number): T | undefined {
    const i = index >= 0 ? index : this.length + index;
    return this[i];
  };
}

/**
 * Entry-point with eager Skia loading on web.
 *
 * Official pattern: LoadSkiaWeb() sets global.CanvasKit + SkiaViewApi
 * before any module is imported. This guarantees module-level Skia.*()
 * calls (Skia.Paint(), Skia.Color(), etc.) in effect files are safe.
 *
 * Native: Skia uses native bindings — no async init needed.
 *
 * @see https://shopify.github.io/react-native-skia/docs/getting-started/web
 */
async function main() {
  // Force `expo` module evaluation before any dynamic import().
  // Metro's `inlineRequires` defers the `require('expo')` until the symbol
  // is first referenced, but `expo` side-effects register `__loadBundleAsync`
  // which dynamic import() relies on.
  const register = registerRootComponent;

  if (Platform.OS === 'web') {
    performance.mark('boot:start');

    // WeChat browser (non-mini-program) sets this flag in showWechatGuide()
    // before JS finishes — skip React mount entirely.
    if ((globalThis as Record<string, unknown>).__SKIP_APP) return;

    // Load Skia WASM before importing App so that all module-level
    // Skia.*() calls execute after SkiaViewApi is available.
    // CanvasKit is a boot-critical dependency. Keep it same-origin so startup
    // does not add a second CDN dependency before React can mount.
    const { LoadSkiaWeb } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@shopify/react-native-skia/lib/module/web') as typeof import('@shopify/react-native-skia/lib/module/web');
    await LoadSkiaWeb({
      locateFile: (file: string) => `/${file}`,
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@shopify/react-native-skia/lib/module/specs/NativeSkiaModule');
  }

  performance.mark('app:import-start');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const App = (require('./App') as { default: React.ComponentType }).default;
  performance.mark('app:import-end');

  register(App);
  performance.mark('app:registered');
}

void main().catch((error: unknown) => {
  if (Platform.OS !== 'web') throw error;

  const hint = document.getElementById('splash-network-hint');
  const refreshButton = document.getElementById('splash-refresh');
  if (hint) {
    hint.textContent = '启动资源加载失败，请检查网络后刷新';
    hint.style.display = 'block';
  }
  if (refreshButton) refreshButton.style.display = 'inline-block';
});
