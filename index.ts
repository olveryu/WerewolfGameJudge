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
/**
 * Race self-hosted and jsdelivr CDN for canvaskit.wasm.
 *
 * Self-hosted `/canvaskit.wasm` benefits from `<link rel="preload">` in
 * index.html — the browser starts downloading before JS execution, so the
 * fetch() here is usually an instant cache hit.
 *
 * jsdelivr has Chinese mainland edge nodes, so for users where Cloudflare
 * Pages is slow it can deliver the 7.6 MB WASM significantly faster.
 *
 * `Promise.any` takes the first fulfilled download; the loser's response body
 * is discarded by the browser. If both fail, falls back to the self-hosted
 * URL string so LoadSkiaWeb can surface its own error.
 */
async function raceCanvaskitWasm(): Promise<string> {
  // Version auto-syncs with installed canvaskit-wasm (transitive dep of Skia).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { version } = require('canvaskit-wasm/package.json') as { version: string };
  const SELF = '/canvaskit.wasm';
  const CDN = `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${version}/bin/full/canvaskit.wasm`;

  const fetchBuf = async (url: string) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.arrayBuffer();
  };

  try {
    const buf = await Promise.any([fetchBuf(SELF), fetchBuf(CDN)]);
    return URL.createObjectURL(new Blob([buf], { type: 'application/wasm' }));
  } catch {
    // Both failed — return self-hosted path; LoadSkiaWeb will surface the error.
    return SELF;
  }
}

async function main() {
  // Force `expo` module evaluation before any dynamic import().
  // Metro's `inlineRequires` defers the `require('expo')` generated from the
  // top-level `import { registerRootComponent } from 'expo'` until the symbol
  // is first referenced. But `expo` side-effects (Expo.fx.web.tsx) register
  // `globalThis.__loadBundleAsync` — the lazy-bundle loader that dynamic
  // import() relies on. Without this eager reference, the first `await import()`
  // below falls back to a synchronous `require(moduleId)` for a module that
  // only exists in a split bundle → "Requiring unknown module" crash.
  const register = registerRootComponent;

  if (Platform.OS === 'web') {
    // WeChat browser (non-mini-program) sets this flag in showWechatGuide()
    // before JS finishes — skip Skia WASM download and React mount entirely.
    if ((globalThis as Record<string, unknown>).__SKIP_APP) return;

    const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');

    // Race self-hosted (preloaded) vs jsdelivr CDN — first to deliver wins.
    const wasmUrl = await raceCanvaskitWasm();
    await LoadSkiaWeb({ locateFile: () => wasmUrl });
    // Release blob memory after CanvasKit has consumed the WASM.
    if (wasmUrl.startsWith('blob:')) URL.revokeObjectURL(wasmUrl);

    // Sets global.SkiaViewApi — must happen before App tree evaluation.
    // See REMOVAL note above.
    await import('@shopify/react-native-skia/lib/module/specs/NativeSkiaModule');

    // Re-check after async Skia init — flag may have been set during WASM download.
    if ((globalThis as Record<string, unknown>).__SKIP_APP) return;
  }

  const App = (await import('./App')).default;
  register(App);
}

void main();
