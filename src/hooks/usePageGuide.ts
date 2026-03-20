/**
 * usePageGuide — 页面级新手引导 Hook
 *
 * 读取 AsyncStorage 判断是否应展示引导弹窗。
 * 返回弹窗可见状态、用户勾选状态、关闭回调。
 * 仅在 mount 后异步完成加载才可能展示，避免闪烁。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { ALL_GUIDE_DISMISSED_KEYS, type GuidePageKey, guideStorageKey } from '@/config/storageKeys';
import { appReadyPromise } from '@/utils/appReady';

/** Session-level dismissed set (cleared on app refresh, not persisted) */
const sessionDismissed = new Set<GuidePageKey>();

export interface PageGuideResult {
  /** true = 弹窗应该显示（已加载 + 未被永久 dismiss） */
  visible: boolean;
  /** "下次不再显示" 勾选状态 */
  dontShowAgain: boolean;
  /** 切换勾选状态 */
  toggleDontShowAgain: () => void;
  /** 关闭弹窗。若 dontShowAgain=true，同时写入 AsyncStorage */
  dismiss: () => void;
}

/** Minimum delay (ms) after app ready before showing guide, ensures page has painted */
const SHOW_DELAY_MS = 300;

export function usePageGuide(pageKey: GuidePageKey): PageGuideResult {
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const key = guideStorageKey(pageKey);
    // Check session-level dismissal first (no async needed)
    if (sessionDismissed.has(pageKey)) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    AsyncStorage.getItem(key)
      .then(async (value) => {
        if (cancelled) return;
        const isPermanentlyDismissed = value === '1';
        setDismissed(isPermanentlyDismissed);
        if (!isPermanentlyDismissed) {
          // Wait for splash screen to hide (appReadyPromise) before showing guide.
          // For guides triggered after app init (e.g. room:assigned), the promise
          // is already resolved so this is effectively a no-op await.
          await appReadyPromise;
          if (cancelled) return;
          const timer = setTimeout(() => {
            if (!cancelled) setShouldShow(true);
          }, SHOW_DELAY_MS);
          cleanupTimer = timer;
        }
      })
      .catch(() => {
        // If read fails, don't show guide (fail safe)
        if (!cancelled) setDismissed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
    return () => {
      cancelled = true;
      if (cleanupTimer != null) clearTimeout(cleanupTimer);
    };
  }, [pageKey]);

  const toggleDontShowAgain = useCallback(() => {
    setDontShowAgain((prev) => !prev);
  }, []);

  const dismiss = useCallback(() => {
    setShouldShow(false);
    sessionDismissed.add(pageKey);
    if (dontShowAgain) {
      const key = guideStorageKey(pageKey);
      AsyncStorage.setItem(key, '1').catch(() => {
        // Best-effort persist; non-critical failure
      });
    }
  }, [dontShowAgain, pageKey]);

  // While loading or permanently dismissed, keep visible=false
  if (loading || dismissed) {
    return { visible: false, dontShowAgain, toggleDontShowAgain, dismiss };
  }

  return { visible: shouldShow, dontShowAgain, toggleDontShowAgain, dismiss };
}

/** 重置所有页面的新手引导（SettingsScreen 调用） */
export async function resetAllGuides(): Promise<void> {
  sessionDismissed.clear();
  await AsyncStorage.multiRemove(ALL_GUIDE_DISMISSED_KEYS);
}
