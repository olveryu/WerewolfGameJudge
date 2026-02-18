/**
 * useHiddenDebugTrigger.ts - Hidden debug panel trigger (5-tap title)
 *
 * Tracks consecutive tap count on a hidden trigger area, toggles mobileDebug
 * panel after threshold taps, and resets counter after timeout. Does not import
 * services directly, does not contain game logic / policy logic, does not render
 * UI or hold JSX, and does not access any game state.
 */

import { useCallback, useRef } from 'react';

import { roomScreenLog } from '@/utils/logger';
import { mobileDebug } from '@/utils/mobileDebug';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Number of consecutive taps required to activate debug panel */
const TAP_THRESHOLD = 5;
/** Time window (ms) in which all taps must occur */
const TAP_TIMEOUT_MS = 2000;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UseHiddenDebugTriggerResult {
  /** Callback to attach to the hidden trigger area (e.g., header title) */
  handleDebugTitleTap: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useHiddenDebugTrigger(): UseHiddenDebugTriggerResult {
  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDebugTitleTap = useCallback(() => {
    tapCountRef.current += 1;

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    if (tapCountRef.current >= TAP_THRESHOLD) {
      tapCountRef.current = 0;
      roomScreenLog.debug('[DebugTrigger] Toggling mobile debug panel');
      mobileDebug.toggle();
    } else {
      tapTimeoutRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, TAP_TIMEOUT_MS);
    }
  }, []);

  return { handleDebugTitleTap };
}
