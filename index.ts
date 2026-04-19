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
 *    `SkiaViewApi` (a global, not an import). They do `import "../views/api"`
 *    as a side-effect-only import to initialise the global first. However,
 *    Metro's `inlineRequires` defers side-effect-only imports to first-use,
 *    so the global is not yet set when the bare-name reference evaluates →
 *    `ReferenceError`. We pre-import NativeSkiaModule here to guarantee the
 *    global exists before the App module tree loads.
 *
 *    This was "fixed" upstream in v1.11.6 (PR #2954) but regressed in v2.x
 *    with new bare-name references. As of v2.4.18 the issue persists.
 *
 * REMOVAL: safe to remove once `@shopify/react-native-skia` no longer has
 * bare-name `SkiaViewApi` references in worklet/module scope. Check with:
 *   grep -rn "SkiaViewApi" node_modules/@shopify/react-native-skia/lib/module/sksg/
 * If all hits are proper imports (not bare globals), this workaround is dead.
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
 * @see https://github.com/Shopify/react-native-skia/pull/2954
 */
async function main() {
  if (Platform.OS === 'web') {
    const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
    // WASM is self-hosted in public/canvaskit.wasm (copied by postinstall).
    // Same-origin eliminates CDN DNS+TLS overhead; paired with <link rel="preload">
    // in web/index.html for early fetch before JS execution.
    await LoadSkiaWeb({
      locateFile: (file: string) => `/${file}`,
    });
    // Sets global.SkiaViewApi — must happen before App tree evaluation.
    // See REMOVAL note above.
    await import('@shopify/react-native-skia/lib/module/specs/NativeSkiaModule');
  }

  const App = (await import('./App')).default;
  registerRootComponent(App);
}

void main();
