import './src/wdyr';

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

/**
 * Entry-point with deferred Skia loading (route-based code splitting).
 *
 * Skia (CanvasKit WASM 7.5 MB) is only used on 3 secondary screens
 * (Room / Gacha / AnimationSettings). Loading it here blocks the
 * entire app — including HomeScreen which doesn't use Skia at all.
 *
 * Instead, Skia globals are initialised via prefetch in AppNavigator
 * after the first screen renders. Screens that import from
 * `@shopify/react-native-skia` are loaded with React.lazy(), ensuring
 * Skia modules are not evaluated until the globals are ready.
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
  }

  performance.mark('app:import-start');
  const App = (await import('./App')).default;
  performance.mark('app:import-end');

  register(App);
  performance.mark('app:registered');
}

void main();
