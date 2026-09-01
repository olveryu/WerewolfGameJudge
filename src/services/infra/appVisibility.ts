/**
 * Cross-platform foreground visibility store.
 *
 * Owns the single platform subscription shared by React and imperative services.
 * It reports whether the app can perform foreground-only work; it does not infer
 * network connectivity from visibility.
 */
import { AppState, Platform } from 'react-native';

type AppVisibilityListener = () => void;

/** External-store contract for foreground visibility consumers. */
export interface AppVisibilityStore {
  readonly getSnapshot: () => boolean;
  readonly subscribe: (listener: AppVisibilityListener) => () => void;
}

const listeners = new Set<AppVisibilityListener>();
let removePlatformListeners: (() => void) | null = null;

function readPlatformVisibility(): boolean {
  if (Platform.OS === 'web') {
    return typeof document === 'undefined' || document.visibilityState === 'visible';
  }
  return AppState.currentState === 'active';
}

let isAppVisible = readPlatformVisibility();

function publishPlatformVisibility(): void {
  const nextVisibility = readPlatformVisibility();
  if (nextVisibility === isAppVisible) return;

  isAppVisible = nextVisibility;
  listeners.forEach((listener) => listener());
}

function registerPlatformListeners(): () => void {
  isAppVisible = readPlatformVisibility();

  if (Platform.OS !== 'web') {
    const subscription = AppState.addEventListener('change', publishPlatformVisibility);
    return () => subscription.remove();
  }

  if (typeof document === 'undefined') return () => undefined;

  document.addEventListener('visibilitychange', publishPlatformVisibility);
  globalThis.window?.addEventListener('pageshow', publishPlatformVisibility);
  globalThis.window?.addEventListener('focus', publishPlatformVisibility);

  return () => {
    document.removeEventListener('visibilitychange', publishPlatformVisibility);
    globalThis.window?.removeEventListener('pageshow', publishPlatformVisibility);
    globalThis.window?.removeEventListener('focus', publishPlatformVisibility);
  };
}

/** Return whether the app is currently visible in the foreground. */
export function getAppVisibility(): boolean {
  if (listeners.size === 0) isAppVisible = readPlatformVisibility();
  return isAppVisible;
}

/** Subscribe to foreground visibility changes. */
export function subscribeToAppVisibility(listener: AppVisibilityListener): () => void {
  listeners.add(listener);
  removePlatformListeners ??= registerPlatformListeners();

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || removePlatformListeners === null) return;

    removePlatformListeners();
    removePlatformListeners = null;
  };
}

/** Shared foreground visibility store for React and imperative services. */
export const appVisibilityStore: AppVisibilityStore = {
  getSnapshot: getAppVisibility,
  subscribe: subscribeToAppVisibility,
};
