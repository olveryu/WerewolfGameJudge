// Sentry must initialise before any other application module evaluates
// (https://docs.sentry.io/platforms/javascript/guides/react/), so this import stays first.
import './instrument';
import './global.css';

import { reactErrorHandler } from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { router } from '@/app/router';
import { applyColorTokens } from '@/theme/colors';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('index.html is missing the #root element');
}

applyColorTokens(document.documentElement);

createRoot(rootElement, {
  onUncaughtError: reactErrorHandler(),
  onCaughtError: reactErrorHandler(),
  onRecoverableError: reactErrorHandler(),
}).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
