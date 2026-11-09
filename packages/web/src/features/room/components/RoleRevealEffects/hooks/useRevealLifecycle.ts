import { useCallback, useEffect, useRef, useState } from 'react';

import { CONFIG } from '../config';

interface RevealLifecycle {
  /** Fires `onComplete` once, after the effect's hold when it has one. */
  readonly fireComplete: () => void;
}

/** The once-only completion every reveal effect shares, with an optional hold before it. */
export function useRevealLifecycle(
  onComplete: () => void,
  revealHoldDurationMs = 0,
): RevealLifecycle {
  const completedRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    },
    [],
  );

  const fireComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (revealHoldDurationMs > 0) {
      holdTimerRef.current = setTimeout(onComplete, revealHoldDurationMs);
    } else {
      onComplete();
    }
  }, [onComplete, revealHoldDurationMs]);

  return { fireComplete };
}

/**
 * Reveals automatically after `CONFIG.common.autoTimeout` of inactivity while `active`, and returns
 * whether the "about to reveal" warning shows.
 */
export function useAutoTimeout(active: boolean, onTimeout: () => void): boolean {
  const [warning, setWarning] = useState(false);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  });

  useEffect(() => {
    if (!active) return;
    const warningTimer = setTimeout(
      () => setWarning(true),
      CONFIG.common.autoTimeout - CONFIG.common.autoTimeoutWarningLeadTime,
    );
    const timeoutTimer = setTimeout(() => onTimeoutRef.current(), CONFIG.common.autoTimeout);
    return () => {
      clearTimeout(warningTimer);
      clearTimeout(timeoutTimer);
      setWarning(false);
    };
  }, [active]);

  return active && warning;
}
