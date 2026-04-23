import './src/wdyr';

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

/**
 * Entry-point — dynamic import ensures `expo` side-effects run first.
 *
 * Metro's `inlineRequires` defers the `require('expo')` generated from the
 * top-level `import { registerRootComponent } from 'expo'` until the symbol
 * is first referenced. But `expo` side-effects (Expo.fx.web.tsx) register
 * `globalThis.__loadBundleAsync` — the lazy-bundle loader that dynamic
 * import() relies on. Without this eager reference, the first `await import()`
 * below falls back to a synchronous `require(moduleId)` for a module that
 * only exists in a split bundle → "Requiring unknown module" crash.
 */
async function main() {
  const register = registerRootComponent;

  if (Platform.OS === 'web') {
    // WeChat browser (non-mini-program) sets this flag in showWechatGuide()
    // before JS finishes — skip React mount entirely.
    if ((globalThis as Record<string, unknown>).__SKIP_APP) return;
  }

  const App = (await import('./App')).default;
  register(App);
}

void main();
