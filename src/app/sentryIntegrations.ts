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

type SentryIntegrationList = Extract<
  NonNullable<Sentry.ReactNativeOptions['integrations']>,
  readonly unknown[]
>;

/**
 * Returns the platform-specific list of Sentry integrations for Sentry.init().
 *
 * Web: browserTracingIntegration + browserReplayIntegration
 * Native: mobileReplayIntegration
 *
 * @returns array of Sentry integration instances
 */
export function getSentryIntegrations() {
  const integrations: SentryIntegrationList = [reactNavigationIntegration];
  if (Platform.OS === 'web') {
    integrations.push(browserTracingIntegration());
    integrations.push(
      Sentry.browserReplayIntegration({
        maskAllText: true,
        maskAllInputs: true,
      }),
    );
  } else {
    integrations.push(
      Sentry.mobileReplayIntegration({
        maskAllText: true,
        maskAllImages: true,
      }),
    );
  }
  return integrations;
}
