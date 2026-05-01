/**
 * Expo environment variable type augmentation.
 *
 * Expo's ExpoProcessEnv uses `[key: string]: any` for dynamic env vars,
 * which makes `process.env.EXPO_PUBLIC_*` resolve to `any`. This augmentation
 * narrows our known keys to `string | undefined` for type safety.
 */

import 'expo-modules-core';

declare module 'expo-modules-core' {
  interface ExpoProcessEnv {
    EXPO_PUBLIC_SITE_URL?: string;
    EXPO_PUBLIC_CF_API_URL?: string;
    EXPO_PUBLIC_API_REGION?: string;
    EXPO_PUBLIC_API_TIMEOUT_MS?: string;
    EXPO_PUBLIC_DEPLOY_ENV?: string;
    EXPO_PUBLIC_SENTRY_DSN?: string;
  }
}
