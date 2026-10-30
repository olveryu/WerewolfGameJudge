/**
 * useStageDeadline - Shared stage countdown hook.
 *
 * Derives remaining seconds from an authoritative absolute deadline and
 * the room's one clock (`useNowMs`). When the countdown reaches zero and
 * `shouldExpire` is true, invokes `onExpire` (single-flight: a dispatch
 * in flight is never duplicated by later ticks; a failed one is retried
 * on the next tick). Any foreground client shares the expiry duty; the
 * server's scheduled settle is the correctness path for games that arm
 * one (avalon, werewolf), so this is acceleration, never authority.
 *
 * Game-specific concerns (session snapshot guards, dispatch payload) stay
 * with the caller via `shouldExpire` and `onExpire`.
 */

import { useEffect, useRef } from 'react';

import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import { NOW_MS_DEFAULT_INTERVAL_MS, useNowMs } from './useNowMs';

export interface UseStageDeadlineParams {
  /** Absolute deadline timestamp (ms); null means no countdown. */
  readonly deadlineAt: number | null;
  /**
   * Whether expiry should be attempted when countdown reaches zero.
   * Called on each tick to get fresh state (e.g. session snapshot guards).
   */
  readonly shouldExpire: () => boolean;
  /** Game-specific expiry dispatch (e.g. session.dispatch with phase expire command). */
  readonly onExpire: () => Promise<unknown>;
  /** Label for error messages, e.g. '推进故事阶段'. */
  readonly label: string;
  /** Tick interval in ms; defaults to 1000. */
  readonly refreshIntervalMs?: number;
  /**
   * Expiry dispatch is best-effort and revision-guarded: a rejection is
   * an expected outcome (another client may have settled first), never
   * a user-facing error. When true, a thrown dispatch is logged and
   * retried on the next tick instead of surfacing an alert.
   */
  readonly silentExpire?: boolean;
}

export interface StageDeadline {
  /** Remaining whole seconds, 0 once reached; null without a deadline. */
  readonly remainingSeconds: number | null;
  /** The clock the countdown is derived from, for sibling countdowns. */
  readonly nowMs: number;
}

/** Remaining whole seconds of `deadlineAt` at `nowMs`; null without a deadline. */
function deriveRemainingSeconds(deadlineAt: number | null, nowMs: number): number | null {
  return deadlineAt === null ? null : Math.max(0, Math.ceil((deadlineAt - nowMs) / 1000));
}

export function useStageDeadline({
  deadlineAt,
  shouldExpire,
  onExpire,
  label,
  refreshIntervalMs = NOW_MS_DEFAULT_INTERVAL_MS,
  silentExpire = false,
}: UseStageDeadlineParams): StageDeadline {
  const nowMs = useNowMs(refreshIntervalMs, deadlineAt !== null);
  const remainingSeconds = deriveRemainingSeconds(deadlineAt, nowMs);
  const inFlightRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Re-evaluated on every tick (nowMs) while the deadline is reached, so a
  // failed or rejected dispatch is retried next tick and an in-flight one
  // is never duplicated.
  useEffect(() => {
    if (remainingSeconds !== 0 || inFlightRef.current || !shouldExpire()) return;
    inFlightRef.current = true;
    void onExpire()
      .catch((error: unknown) => {
        if (!isMountedRef.current) return;
        if (silentExpire) {
          roomScreenLog.warn('stage expiry dispatch failed; retrying on next tick', {
            label,
            error: error instanceof Error ? error.message : String(error),
          });
          return;
        }
        handleError(error, { label, logger: roomScreenLog, alertMessage: `${label}失败，请重试` });
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [remainingSeconds, nowMs, shouldExpire, onExpire, label, silentExpire]);

  return { remainingSeconds, nowMs };
}
