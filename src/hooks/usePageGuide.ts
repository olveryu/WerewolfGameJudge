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

/**
 * @param pageKey - 页面标识
 * @param ready - 页面内容是否已加载完成。弹窗会等 ready=true 后才显示，
 *               避免在页面还在 loading 时弹出引导。默认 true（静态页面无需传）。
 */
export function usePageGuide(pageKey: GuidePageKey, ready = true): PageGuideResult {
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
      .then((value) => {
        if (cancelled) return;
        const isPermanentlyDismissed = value === '1';
        setDismissed(isPermanentlyDismissed);
        if (!isPermanentlyDismissed) {
          setShouldShow(true);
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

  // Derive visible: only show when async check passed AND page is ready
  const visible = shouldShow && ready;

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

  return { visible, dontShowAgain, toggleDontShowAgain, dismiss };
}

/** 重置所有页面的新手引导（SettingsScreen 调用） */
export async function resetAllGuides(): Promise<void> {
  sessionDismissed.clear();
  await AsyncStorage.multiRemove(ALL_GUIDE_DISMISSED_KEYS);
}
