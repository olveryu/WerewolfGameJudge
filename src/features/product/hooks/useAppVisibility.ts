/**
 * useAppVisibility — detects foreground/background visibility of the app.
 *
 * Web: document.visibilitychange (visible / hidden)
 * Native: AppState.addEventListener('change') (active vs background/inactive)
 *
 * Returns boolean: true = foreground visible, false = background/hidden.
 * Used to unmount decorative animations (flair / pet) when the app is not visible, reducing CPU/GPU overhead.
 */
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

// ── Web implementation ────────────────────────────────────────────────

function subscribeWeb(callback: () => void): () => void {
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
}

function getSnapshotWeb(): boolean {
  return document.visibilityState === 'visible';
}

// ── Native implementation ─────────────────────────────────────────────

let nativeVisible = AppState.currentState === 'active';
const nativeListeners = new Set<() => void>();
let nativeSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

function ensureNativeListener(): void {
  if (nativeSubscription) return;
  nativeSubscription = AppState.addEventListener('change', (state) => {
    const next = state === 'active';
    if (next !== nativeVisible) {
      nativeVisible = next;
      for (const cb of nativeListeners) cb();
    }
  });
}

function subscribeNative(callback: () => void): () => void {
  ensureNativeListener();
  nativeListeners.add(callback);
  return () => {
    nativeListeners.delete(callback);
  };
}

function getSnapshotNative(): boolean {
  return nativeVisible;
}

// ── Server snapshot (SSR safety) ──────────────────────────────────────

function getServerSnapshot(): boolean {
  return true;
}

// ── Hook ──────────────────────────────────────────────────────────────

const isWeb = Platform.OS === 'web';

const subscribe = isWeb ? subscribeWeb : subscribeNative;
const getSnapshot = isWeb ? getSnapshotWeb : getSnapshotNative;

/** Returns whether the app is visible in the foreground (web: document.visibilityState / native: AppState). */
export function useAppVisibility(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
