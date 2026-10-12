/**
 * useStageDeadline - Shared stage countdown hook.
 *
 * Recomputes remaining seconds from an authoritative absolute deadline.
 * When the countdown reaches zero and `shouldExpire` is true, invokes `onExpire`
 * (single-flight per tick). Foreground clients share the expiry duty.
 *
 * Game-specific concerns (session snapshot guards, dispatch payload) stay with
 * the caller via `shouldExpire` and `onExpire`.
 *
 * Scope (AU-27, registered divergence): this hook is the any-foreground-
 * client expiry notifier for avalon/drawguess/pictionary/storyrelay.
 * It deliberately does NOT cover werewolf's step progression:
 * useStepDeadlineCountdown is a host-only progression driver with
 * retry-until-success and engine audio-ack coupling - a different
 * duty, kept separate on purpose.
 */

import { useEffect, useState } from 'react';

import { useAppVisibility } from '@/features/product/hooks/useAppVisibility';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

const DEFAULT_REFRESH_MS = 1000;

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

/**
 * Returns remaining seconds (null if no deadline).
 * Recomputes from `deadlineAt - Date.now()` on each tick to survive timer throttling.
 */
export function useStageDeadline({
  deadlineAt,
  shouldExpire,
  onExpire,
  label,
  refreshIntervalMs = DEFAULT_REFRESH_MS,
  silentExpire = false,
}: UseStageDeadlineParams): number | null {
  const isVisible = useAppVisibility();
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    let isRunning = false;
    let isMounted = true;

    const tick = async (): Promise<void> => {
      const remaining =
        deadlineAt === null ? null : Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining !== 0 || isRunning || !shouldExpire()) return;
      isRunning = true;
      try {
        await onExpire();
      } catch (error: unknown) {
        if (isMounted && silentExpire) {
          roomScreenLog.warn('stage expiry dispatch failed; retrying on next tick', {
            label,
            error: error instanceof Error ? error.message : String(error),
          });
        } else if (isMounted) {
          handleError(error, {
            label,
            logger: roomScreenLog,
            alertMessage: `${label}失败，请重试`,
          });
        }
      } finally {
        isRunning = false;
      }
    };

    if (!isVisible) return;
    void tick();
    const interval = setInterval(() => void tick(), refreshIntervalMs);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [deadlineAt, isVisible, shouldExpire, onExpire, label, refreshIntervalMs, silentExpire]);

  return remainingSeconds;
}
