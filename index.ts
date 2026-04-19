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
 *    Reanimated's babel plugin transforms `"worklet"` functions (e.g. in
 *    `sksg/Container.web.js`) into IIFEs that capture closure variables at
 *    **module-evaluation time**:
 *      `_f.__closure = { SkiaViewApi: SkiaViewApi };`
 *    If the module evaluates before NativeSkiaModule.web has set the global,
 *    this is a `ReferenceError`. Metro's `inlineRequires.blockList` cannot
 *    prevent this — it only controls `require()` reordering, not worklet
 *    closure captures. We must explicitly import NativeSkiaModule before the
 *    App tree loads.
 *
 * Static imports of `expo`, `react-native`, and `@shopify/.../web` are safe —
 * they don't trigger `Skia.web.js`. Only `./App` must be dynamically imported
 * so its import tree (which includes Skia components) evaluates after both
 * globals are ready.
 *
 * Native: Skia uses native bindings — no async init needed.
 *
 * @see https://shopify.github.io/react-native-skia/docs/getting-started/web
 * @see https://github.com/Shopify/react-native-skia/issues/2914
 */
const CANVASKIT_VERSION = '0.40.0';
const CANVASKIT_CDN = `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${CANVASKIT_VERSION}/bin/full`;

async function main() {
  if (Platform.OS === 'web') {
    const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
    await LoadSkiaWeb({
      locateFile: (file: string) => `${CANVASKIT_CDN}/${file}`,
    });
    // Sets global.SkiaViewApi — must happen before App tree evaluation.
    await import('@shopify/react-native-skia/lib/module/specs/NativeSkiaModule');
  }

  const App = (await import('./App')).default;
  registerRootComponent(App);
}

void main();
