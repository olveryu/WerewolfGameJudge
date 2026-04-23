/**
 * sentryIntegrations — Sentry integration instances shared between App.tsx and AppNavigator.
 *
 * Extracted to avoid circular dependency (App → AppNavigator → App).
 * On web, browserTracingIntegration creates pageload/navigation transactions so that
 * fetch spans and custom spans have a root transaction to attach to.
 * reactNavigationIntegration tracks screen transitions on all platforms.
 */
import { browserTracingIntegration } from '@sentry/browser';
import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

export const reactNavigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

/** Platform-specific integrations for Sentry.init() */
export function getSentryIntegrations() {
  const integrations: ReturnType<typeof Sentry.reactNavigationIntegration>[] = [
    reactNavigationIntegration,
  ];
  if (Platform.OS === 'web') {
    integrations.push(
      browserTracingIntegration() as ReturnType<typeof Sentry.reactNavigationIntegration>,
    );
  }
  return integrations;
}
