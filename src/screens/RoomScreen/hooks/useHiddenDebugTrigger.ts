/**
 * useHiddenDebugTrigger.ts - Hidden debug panel trigger (5-tap title)
 *
 * ✅ Allowed:
 *   - Track consecutive tap count on a hidden trigger area
 *   - Toggle mobileDebug panel after threshold taps
 *   - Reset counter after timeout
 *
 * ❌ Do NOT:
 *   - Import services directly
 *   - Contain game logic / policy logic
 *   - Render UI or hold JSX
 *   - Access any game state
 */

import { useCallback, useRef } from 'react';
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
      mobileDebug.toggle();
    } else {
      tapTimeoutRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, TAP_TIMEOUT_MS);
    }
  }, []);

  return { handleDebugTitleTap };
}
