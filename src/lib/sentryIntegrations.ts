/**
 * sentryIntegrations — Sentry integration instances shared between App.tsx and AppNavigator.
 *
 * Extracted to avoid circular dependency (App -> AppNavigator -> App).
 * On web, browserTracingIntegration creates pageload/navigation transactions so that
 * fetch spans and custom spans have a root transaction to attach to.
 * browserReplayIntegration captures session replays for error reproduction.
 * reactNavigationIntegration tracks screen transitions on all platforms.
 */
import { browserTracingIntegration } from '@sentry/browser';
import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

/** React Navigation screen transition tracking integration (includes Time-To-Initial-Display). */
export const reactNavigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

/**
 * Returns the platform-specific list of Sentry integrations for Sentry.init().
 *
 * Web: browserTracingIntegration + browserReplayIntegration
 * Native: mobileReplayIntegration
 *
 * @returns array of Sentry integration instances
 */
export function getSentryIntegrations() {
  const integrations: ReturnType<typeof Sentry.reactNavigationIntegration>[] = [
    reactNavigationIntegration,
  ];
  if (Platform.OS === 'web') {
    integrations.push(
      browserTracingIntegration() as ReturnType<typeof Sentry.reactNavigationIntegration>,
    );
    integrations.push(
      Sentry.browserReplayIntegration({
        maskAllText: true,
        maskAllInputs: true,
      }) as unknown as ReturnType<typeof Sentry.reactNavigationIntegration>,
    );
  } else {
    integrations.push(
      Sentry.mobileReplayIntegration({
        maskAllText: true,
        maskAllImages: true,
      }) as unknown as ReturnType<typeof Sentry.reactNavigationIntegration>,
    );
  }
  return integrations;
}
