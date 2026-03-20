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

export function usePageGuide(pageKey: GuidePageKey): PageGuideResult {
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);
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
      .then((value) => {
        if (cancelled) return;
        const isPermanentlyDismissed = value === '1';
        setDismissed(isPermanentlyDismissed);
        if (!isPermanentlyDismissed) {
          setVisible(true);
        }
      })
      .catch(() => {
        // If read fails, don't show guide (fail safe)
        if (!cancelled) setDismissed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageKey]);

  const toggleDontShowAgain = useCallback(() => {
    setDontShowAgain((prev) => !prev);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    sessionDismissed.add(pageKey);
    if (dontShowAgain) {
      const key = guideStorageKey(pageKey);
      AsyncStorage.setItem(key, '1').catch(() => {
        // Best-effort persist; non-critical failure
      });
    }
  }, [dontShowAgain, pageKey]);

  // While loading, keep visible=false to avoid flash
  if (loading || dismissed) {
    return {
      visible: false,
      dontShowAgain,
      toggleDontShowAgain,
      dismiss,
    };
  }

  return { visible, dontShowAgain, toggleDontShowAgain, dismiss };
}

/** 重置所有页面的新手引导（SettingsScreen 调用） */
export async function resetAllGuides(): Promise<void> {
  sessionDismissed.clear();
  await AsyncStorage.multiRemove(ALL_GUIDE_DISMISSED_KEYS);
}
