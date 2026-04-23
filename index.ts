import './src/wdyr';

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

/**
 * Entry-point — registers the root React component.
 *
 * Web: uses dynamic `import('./App')` so that Metro's `inlineRequires` +
 * code-splitting can resolve `__loadBundleAsync` (registered by Expo's
 * `Expo.fx.web.tsx` side-effect) before the App module tree loads.
 * The eager `registerRootComponent` reference forces `expo` evaluation.
 *
 * WeChat browser (non-mini-program) sets `__SKIP_APP` in showWechatGuide()
 * before JS finishes — we skip React mount entirely in that case.
 */
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
    if ((globalThis as Record<string, unknown>).__SKIP_APP) return;
  }

  const App = (await import('./App')).default;
  register(App);
}

void main();
