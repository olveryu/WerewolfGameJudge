/**
 * PlatformEnvironment — the single foreground/online source for the client.
 *
 * Owns one platform subscription (Web: document/window events; Native: AppState) and publishes
 * an immutable snapshot that only changes when a field actually changes. Native has no
 * connectivity API in this project, so `online` is constant `true` there and socket failures
 * drive reconnection instead.
 */
import { AppState, Platform } from 'react-native';

/** Immutable environment snapshot; `*SinceMs` record when the current value was entered. */
export interface EnvironmentSnapshot {
  readonly visible: boolean;
  readonly online: boolean;
  readonly visibleSinceMs: number;
  readonly onlineSinceMs: number;
}

/** External-store contract shared by React and imperative consumers. */
export interface PlatformEnvironment {
  getSnapshot(): EnvironmentSnapshot;
  subscribe(listener: () => void): () => void;
}

/** Platform-specific readers and change notification for one environment. */
export interface EnvironmentSource {
  readVisible(): boolean;
  readOnline(): boolean;
  /** Register platform listeners; returns the disposer. Called only while subscribers exist. */
  listen(onChange: () => void): () => void;
}

interface CreatePlatformEnvironmentOptions {
  readonly source: EnvironmentSource;
  readonly now: () => number;
}

/** Build an environment store over one source; listeners attach lazily and detach when unused. */
export function createPlatformEnvironment({
  source,
  now,
}: CreatePlatformEnvironmentOptions): PlatformEnvironment {
  const listeners = new Set<() => void>();
  let dispose: (() => void) | null = null;
  let snapshot = readInitialSnapshot();

  function readInitialSnapshot(): EnvironmentSnapshot {
    const timestamp = now();
    return Object.freeze({
      visible: source.readVisible(),
      online: source.readOnline(),
      visibleSinceMs: timestamp,
      onlineSinceMs: timestamp,
    });
  }

  function publish(): void {
    const visible = source.readVisible();
    const online = source.readOnline();
    if (visible === snapshot.visible && online === snapshot.online) return;
    const timestamp = now();
    snapshot = Object.freeze({
      visible,
      online,
      visibleSinceMs: visible === snapshot.visible ? snapshot.visibleSinceMs : timestamp,
      onlineSinceMs: online === snapshot.online ? snapshot.onlineSinceMs : timestamp,
    });
    for (const listener of listeners) listener();
  }

  return {
    getSnapshot: () => {
      if (dispose === null) snapshot = readInitialSnapshot();
      return snapshot;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      if (dispose === null) {
        snapshot = readInitialSnapshot();
        dispose = source.listen(publish);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0 || dispose === null) return;
        dispose();
        dispose = null;
      };
    },
  };
}

/** Browser source: visibility + focus/pageshow for WebView resume, online/offline for connectivity. */
export function createWebEnvironmentSource(): EnvironmentSource {
  return {
    readVisible: () => document.visibilityState === 'visible',
    readOnline: () => navigator.onLine,
    listen: (onChange) => {
      document.addEventListener('visibilitychange', onChange);
      window.addEventListener('pageshow', onChange);
      window.addEventListener('focus', onChange);
      window.addEventListener('online', onChange);
      window.addEventListener('offline', onChange);
      return () => {
        document.removeEventListener('visibilitychange', onChange);
        window.removeEventListener('pageshow', onChange);
        window.removeEventListener('focus', onChange);
        window.removeEventListener('online', onChange);
        window.removeEventListener('offline', onChange);
      };
    },
  };
}

/** React Native source: AppState only; connectivity is unknown and reported as online. */
export function createNativeEnvironmentSource(): EnvironmentSource {
  return {
    readVisible: () => AppState.currentState === 'active',
    readOnline: () => true,
    listen: (onChange) => {
      const subscription = AppState.addEventListener('change', onChange);
      return () => subscription.remove();
    },
  };
}

/** Application-wide environment store. */
export const platformEnvironment: PlatformEnvironment = createPlatformEnvironment({
  source: Platform.OS === 'web' ? createWebEnvironmentSource() : createNativeEnvironmentSource(),
  now: Date.now,
});
