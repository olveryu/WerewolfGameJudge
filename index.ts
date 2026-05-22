import './src/wdyr';

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

/**
 * Entry-point.
 *
 * Web: eager performance marks for boot timing.
 * Native: direct registration.
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const App = (require('./App') as { default: React.ComponentType }).default;
  performance.mark('app:import-end');

  register(App);
  performance.mark('app:registered');
}

void main();
