import { addIntegration, init } from '@sentry/react';
import { reactRouterBrowserTracingIntegration } from '@sentry/react/react-router';

import { APP_VERSION } from '@/config/version';

init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  release: `werewolfjudge@${APP_VERSION}`,
  enabled: import.meta.env.PROD,
  environment: import.meta.env.PROD
    ? (import.meta.env.VITE_DEPLOY_ENV ?? 'production')
    : 'development',
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [reactRouterBrowserTracingIntegration()],
  ignoreErrors: [
    'ResizeObserver loop',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    // WebKit internals injected by the iOS WebView.
    "Can't find variable: __gCrWeb",
  ],
  denyUrls: [/extensions\//i, /^chrome:\/\//i, /^chrome-extension:\/\//i, /^moz-extension:\/\//i],
});

// Session Replay is the heaviest integration, so it loads in its own chunk after start-up
// (https://docs.sentry.io/platforms/javascript/session-replay/#lazy-loading-replay).
if (import.meta.env.PROD) {
  void import('./sentryReplay').then(({ createReplayIntegration }) => {
    addIntegration(createReplayIntegration());
  });
}
