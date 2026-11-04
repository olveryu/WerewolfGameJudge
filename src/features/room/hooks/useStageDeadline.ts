/**
 * useStageDeadline - Shared stage countdown hook.
 *
 * Derives remaining seconds from an authoritative absolute deadline and
 * the room's one clock (`useNowMs`). When the countdown reaches zero and
 * `shouldExpire` is true, invokes `onExpire`. Any foreground client
 * shares the expiry duty; the server's scheduled settle is the
 * correctness path for games that arm one (avalon, werewolf), so this
 * is acceleration, never authority.
 *
 * Dispatch discipline is keyed by `attemptKey`: a key is attempted at
 * most once — marked before the dispatch is invoked — and never
 * retried for that identity after any outcome (commit, rejection, or
 * the epoch ending). A new key (a new phase identity) resets the
 * discipline. A null key never dispatches. `attemptKey` is required:
 * every caller passes the phase identity it computes, so there is no
 * unkeyed retry path left.
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
   * a user-facing error. When true, a thrown dispatch is logged instead
   * of surfacing an alert. A failed dispatch is never retried for the
   * same phase identity.
   */
  readonly silentExpire?: boolean;
  /**
   * Phase identity for single-shot dispatch discipline, e.g.
   * `${roundId}:${phaseRevision}:${deadlineAt}`. The key is attempted
   * at most once and never retried; a null key never dispatches.
   * Required: callers always compute the identity from the snapshot.
   */
  readonly attemptKey: string | null;
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
  attemptKey,
}: UseStageDeadlineParams): StageDeadline {
  const nowMs = useNowMs(refreshIntervalMs, deadlineAt !== null);
  const remainingSeconds = deriveRemainingSeconds(deadlineAt, nowMs);
  const inFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  // The last phase identity attempted. A single ref suffices because
  // identities only move forward: a new key replaces the old one, and
  // an attempted key is never attempted again.
  const attemptedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Re-evaluated on every tick (nowMs) while the deadline is reached.
  // A key is attempted at most once: it is marked before the dispatch
  // is invoked, so no outcome — commit, rejection, or the epoch
  // ending — retries it. An in-flight dispatch is never duplicated.
  useEffect(() => {
    if (remainingSeconds !== 0 || inFlightRef.current || !shouldExpire()) return;
    if (attemptKey === null) return;
    if (attemptedKeyRef.current === attemptKey) return;
    attemptedKeyRef.current = attemptKey;
    inFlightRef.current = true;
    void onExpire()
      .catch((error: unknown) => {
        if (!isMountedRef.current) return;
        if (silentExpire) {
          roomScreenLog.warn('stage expiry dispatch failed; not retrying this phase identity', {
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
  }, [remainingSeconds, nowMs, shouldExpire, onExpire, label, silentExpire, attemptKey]);

  return { remainingSeconds, nowMs };
}
