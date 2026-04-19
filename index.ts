import './src/wdyr';

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

/**
 * Entry-point blocking pattern (community best practice for react-native-skia web).
 *
 * Web: LoadSkiaWeb() must complete BEFORE any module that imports from
 * `@shopify/react-native-skia` is evaluated, because `Skia.web.js` captures
 * `global.CanvasKit` at module-level. A static `import App` would trigger the
 * entire import tree synchronously, causing CanvasKit to be `undefined`.
 *
 * Static imports of `expo`, `react-native`, and `@shopify/.../web` are safe —
 * they don't trigger `Skia.web.js`. Only `./App` must be dynamically imported
 * so its import tree (which includes Skia components) evaluates after CanvasKit.
 *
 * Native: Skia uses native bindings — no async init needed.
 *
 * @see https://shopify.github.io/react-native-skia/docs/getting-started/web
 */
const CANVASKIT_VERSION = '0.40.0';
const CANVASKIT_CDN = `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${CANVASKIT_VERSION}/bin/full`;

async function main() {
  if (Platform.OS === 'web') {
    const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
    await LoadSkiaWeb({
      locateFile: (file: string) => `${CANVASKIT_CDN}/${file}`,
    });
  }

  const App = (await import('./App')).default;
  registerRootComponent(App);
}

main();
