// Evaluation order matters: the boot mark comes first, then Sentry, which must initialise before
// any other application module (https://docs.sentry.io/platforms/javascript/guides/react/).
import './boot/markBootStart';
import './instrument';
import './global.css';

import { reactErrorHandler } from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { router } from '@/app/router';
import { reportLoadTiming } from '@/boot/loadTiming';
import { resolveRuntimeEnvironment } from '@/boot/runtimeEnvironment';
import { installStaleTabReload, removeLegacyServiceWorkers } from '@/boot/tabLifecycle';
import { WechatBrowserGuide } from '@/boot/WechatBrowserGuide';
import { applyColorTokens } from '@/theme/colors';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('index.html is missing the #root element');
}

applyColorTokens(document.documentElement);
installStaleTabReload();
void removeLegacyServiceWorkers();

const root = createRoot(rootElement, {
  onUncaughtError: reactErrorHandler(),
  onCaughtError: reactErrorHandler(),
  onRecoverableError: reactErrorHandler(),
});

void resolveRuntimeEnvironment().then((environment) => {
  root.render(
    <StrictMode>
      {environment === 'wechatBrowser' ? (
        <WechatBrowserGuide />
      ) : (
        <RouterProvider router={router} />
      )}
    </StrictMode>,
  );
  performance.mark('app:registered');
  window.setTimeout(reportLoadTiming, 0);
});
