/**
 * useHiddenDebugTrigger.ts - Hidden debug panel trigger (5-tap title)
 *
 * Tracks consecutive tap count on a hidden trigger area, toggles the debug log
 * panel after threshold taps with admin password gate.
 * Does not import services directly, does not contain game logic / policy logic,
 * does not render UI or hold JSX, and does not access any game state.
 */

import { useCallback, useEffect, useRef } from 'react';

import { verifyAdminPassword } from '@/features/admin/services/adminApi';
import {
  clearAdminCredential,
  readAdminCredential,
  writeAdminCredential,
} from '@/features/admin/services/adminCredentialStore';
import { showPrompt } from '@/utils/alert';
import { debugLogStore } from '@/utils/debugLogStore';
import { roomScreenLog } from '@/utils/logger';

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
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Verify cached admin password, toggle debug panel if valid. */
async function verifyAndToggle(cached: string): Promise<void> {
  const valid = await verifyAdminPassword(cached);
  if (valid) {
    debugLogStore.toggleVisibility();
  } else {
    clearAdminCredential();
    roomScreenLog.warn('Cached admin password invalid, cleared');
  }
}

/** Prompt user for admin password, verify, cache on success, toggle panel. */
function promptAdminPassword(): void {
  showPrompt('Admin 密码', {
    placeholder: '请输入管理员密码',
    onConfirm: (value: string) => {
      const credential = value.trim();
      if (!credential) return;
      void (async () => {
        try {
          const valid = await verifyAdminPassword(credential);
          if (valid) {
            writeAdminCredential(credential);
            debugLogStore.toggleVisibility();
          } else {
            roomScreenLog.warn('Admin password rejected');
          }
        } catch (e) {
          roomScreenLog.warn('Admin password verify failed', e);
        }
      })();
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/** Hidden debug panel trigger hook (consecutive title taps). */
export function useHiddenDebugTrigger(): UseHiddenDebugTriggerResult {
  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount to prevent stale setState calls
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  const handleDebugTitleTap = useCallback(() => {
    tapCountRef.current += 1;

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    if (tapCountRef.current >= TAP_THRESHOLD) {
      tapCountRef.current = 0;
      roomScreenLog.debug('Debug trigger activated, verifying admin');

      const cached = readAdminCredential();
      if (cached) {
        void verifyAndToggle(cached);
      } else {
        promptAdminPassword();
      }
    } else {
      tapTimeoutRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, TAP_TIMEOUT_MS);
    }
  }, []);

  return { handleDebugTitleTap };
}
