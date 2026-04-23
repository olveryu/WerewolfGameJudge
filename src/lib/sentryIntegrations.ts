/**
 * sentryIntegrations — Sentry integration instances shared between App.tsx and AppNavigator.
 *
 * Extracted to avoid circular dependency (App → AppNavigator → App).
 */
import * as Sentry from '@sentry/react-native';

export const reactNavigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});
