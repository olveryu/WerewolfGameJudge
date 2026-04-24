import './src/wdyr';

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { version } = require('canvaskit-wasm/package.json') as { version: string };
    const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
    await LoadSkiaWeb({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${version}/bin/full/${file}`,
    });
    await import('@shopify/react-native-skia/lib/module/specs/NativeSkiaModule');
  }

  performance.mark('app:import-start');
  const App = (await import('./App')).default;
  performance.mark('app:import-end');

  register(App);
  performance.mark('app:registered');
}

void main();
