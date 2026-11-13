// Evaluation order matters: the boot mark comes first, then Sentry, which must initialise before
// any other application module (https://docs.sentry.io/platforms/javascript/guides/react/).
// global.css loads from index.html so the boot splash is styled before any script runs.
import './boot/markBootStart';
import './instrument';

import { reactErrorHandler } from '@sentry/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { queryClient } from '@/app/queryClient';
import { router } from '@/app/router';
import { scheduleBootSplashDismiss } from '@/boot/dismissBootSplash';
import { reportLoadTiming } from '@/boot/loadTiming';
import { capturePwaInstallPrompt } from '@/boot/pwaInstallPrompt';
import { resolveRuntimeEnvironment } from '@/boot/runtimeEnvironment';
import { installStaleTabReload, removeLegacyServiceWorkers } from '@/boot/tabLifecycle';
import { WechatBrowserGuide } from '@/boot/WechatBrowserGuide';
import { MaintenanceGate } from '@/features/maintenance/MaintenanceGate';
import { applyColorTokens } from '@/theme/colors';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('index.html is missing the #root element');
}

applyColorTokens(document.documentElement);
installStaleTabReload();
capturePwaInstallPrompt();
void removeLegacyServiceWorkers();

/** The router renders its first route once the matched lazy route modules have loaded. */
function dismissBootSplashOnceRouted(): void {
  if (router.state.initialized) {
    scheduleBootSplashDismiss();
    return;
  }
  const unsubscribe = router.subscribe((state) => {
    if (!state.initialized) return;
    unsubscribe();
    scheduleBootSplashDismiss();
  });
}

const root = createRoot(rootElement, {
  onUncaughtError: reactErrorHandler(),
  onCaughtError: reactErrorHandler(),
  onRecoverableError: reactErrorHandler(),
});

void resolveRuntimeEnvironment().then((environment) => {
  root.render(
    <StrictMode>
      {environment === 'wechatBrowser' ? (
        <QueryClientProvider client={queryClient}>
          <MaintenanceGate>
            <WechatBrowserGuide />
          </MaintenanceGate>
        </QueryClientProvider>
      ) : (
        <RouterProvider router={router} />
      )}
    </StrictMode>,
  );
  performance.mark('app:registered');
  if (environment === 'wechatBrowser') {
    scheduleBootSplashDismiss();
  } else {
    dismissBootSplashOnceRouted();
  }
  window.setTimeout(reportLoadTiming, 0);
});
