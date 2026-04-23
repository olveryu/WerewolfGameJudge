import './src/wdyr';

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

/**
 * Entry-point blocking pattern (community best practice for react-native-skia web).
 *
 * Web: Two globals must be initialised BEFORE any module that imports from
 * `@shopify/react-native-skia` is evaluated:
 *
 * 1. `global.CanvasKit` — set by LoadSkiaWeb(). `Skia.web.js` captures it at
 *    module scope; a static `import App` would trigger the entire import tree
 *    synchronously, leaving CanvasKit `undefined`.
 *
 * 2. `global.SkiaViewApi` — set by `specs/NativeSkiaModule.web.js`.
 *    `sksg/Container.web.js` and `sksg/StaticContainer.js` use bare-name
 *    `SkiaViewApi` (a global, not an import). Metro's `inlineRequires` defers
 *    side-effect-only imports, so the global is not yet set when referenced.
 *    We pre-import NativeSkiaModule here to guarantee it.
 *
 * Static imports of `expo`, `react-native`, and `@shopify/.../web` are safe —
 * they don't trigger `Skia.web.js`. Only `./App` must be dynamically imported.
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
    // WeChat browser (non-mini-program) sets this flag in showWechatGuide()
    // before JS finishes — skip Skia WASM download and React mount entirely.
    if ((globalThis as Record<string, unknown>).__SKIP_APP) return;

    const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');

    // Load CanvasKit WASM from jsdelivr CDN (has Chinese mainland edge nodes).
    // Emscripten internally uses WebAssembly.instantiateStreaming for this URL,
    // enabling download + compilation to happen in parallel.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { version } = require('canvaskit-wasm/package.json') as { version: string };
    await LoadSkiaWeb({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${version}/bin/full/${file}`,
    });

    // Sets global.SkiaViewApi — must happen before App tree evaluation.
    await import('@shopify/react-native-skia/lib/module/specs/NativeSkiaModule');

    // Re-check after async Skia init — flag may have been set during WASM download.
    if ((globalThis as Record<string, unknown>).__SKIP_APP) return;
  }

  const App = (await import('./App')).default;
  register(App);
}

void main();
