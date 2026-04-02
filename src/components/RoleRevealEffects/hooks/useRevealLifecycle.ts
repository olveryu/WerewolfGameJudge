/**
 * useRevealLifecycle — 揭示动画共享生命周期 hook
 *
 * 统一 9 个揭示效果组件中重复的完成守卫、hold timer 清理、auto-timeout 警告逻辑。
 * 不处理动画本身或 reducedMotion 跳过（各组件各异）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { CONFIG } from '@/components/RoleRevealEffects/config';

// ─── Types ─────────────────────────────────────────────────────────────

interface UseRevealLifecycleOptions {
  /** Parent onComplete callback — called exactly once when reveal finishes */
  onComplete: () => void;
  /**
   * Hold duration (ms) after overlay animation completes before calling onComplete.
   * 0 (default) = call immediately.
   */
  revealHoldDurationMs?: number;
}

interface UseRevealLifecycleReturn {
  /** Guard ref — true after fireComplete has been invoked once */
  onCompleteCalledRef: React.MutableRefObject<boolean>;
  /**
   * Call when AlignmentRevealOverlay finishes (or directly for reducedMotion path).
   * Internally guards against double-fire and schedules hold delay.
   */
  fireComplete: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────

export function useRevealLifecycle(options: UseRevealLifecycleOptions): UseRevealLifecycleReturn {
  const { onComplete, revealHoldDurationMs = 0 } = options;

  const onCompleteCalledRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up hold timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const fireComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    if (revealHoldDurationMs > 0) {
      holdTimerRef.current = setTimeout(onComplete, revealHoldDurationMs);
    } else {
      onComplete();
    }
  }, [onComplete, revealHoldDurationMs]);

  return { onCompleteCalledRef, fireComplete };
}

// ─── Auto-timeout warning ──────────────────────────────────────────────

/**
 * useAutoTimeoutWarning — manages the "hurry up" warning state.
 *
 * Returns `true` when `CONFIG.common.autoTimeout - autoTimeoutWarningLeadTime` ms
 * have elapsed since `active` became `true`. Resets when `active` becomes `false`.
 */
export function useAutoTimeoutWarning(active: boolean): boolean {
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    if (!active) {
      setWarning(false);
      return;
    }
    const timer = setTimeout(
      () => setWarning(true),
      CONFIG.common.autoTimeout - CONFIG.common.autoTimeoutWarningLeadTime,
    );
    return () => {
      clearTimeout(timer);
      setWarning(false);
    };
  }, [active]);

  return warning;
}
