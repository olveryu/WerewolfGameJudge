/**
 * useAppVisibility — App 前台/后台可见性检测
 *
 * Web: document.visibilitychange (visible / hidden)
 * Native: AppState.addEventListener('change') (active vs background/inactive)
 *
 * 返回 boolean：true = 前台可见，false = 后台/隐藏。
 * 用于在 App 不可见时卸载装饰性动画（flair / pet），降低 CPU/GPU 开销。
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

/** 返回 app 是否在前台可见（web: document.visibilityState / native: AppState）。 */
export function useAppVisibility(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
