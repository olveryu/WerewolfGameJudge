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
// Self-hosted on same origin (public/canvaskit/) to avoid cdn.jsdelivr.net being
// unreachable inside WeChat mini-program web-view in mainland China.
// Metro dev server serves public/ automatically; prod export copies it to dist/.
const CANVASKIT_PATH = '/canvaskit';

async function main() {
  if (Platform.OS === 'web') {
    const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
    await LoadSkiaWeb({
      locateFile: (file: string) => `${CANVASKIT_PATH}/${file}`,
    });
  }

  const App = (await import('./App')).default;
  registerRootComponent(App);
}

main();
