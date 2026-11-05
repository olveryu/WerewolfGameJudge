/**
 * useStageDeadline - Shared stage countdown hook.
 *
 * Derives remaining seconds from an authoritative absolute deadline and
 * the room's one clock (`useNowMs`). Display only: the client never
 * sends expiry. Stage deadlines are settled server-side — the engine
 * arms a `*.settle.due` effect with the deadline and the Worker
 * delivers it at the deadline as the system actor. No phone, host or
 * seated or spectator, sends any expiry command.
 *
 * Game-specific concerns stay with the caller: which deadline is armed
 * and how the remaining seconds are rendered.
 */

import { NOW_MS_DEFAULT_INTERVAL_MS, useNowMs } from './useNowMs';

export interface UseStageDeadlineParams {
  /** Absolute deadline timestamp (ms); null means no countdown. */
  readonly deadlineAt: number | null;
  /** Tick interval in ms; defaults to 1000. */
  readonly refreshIntervalMs?: number;
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
  refreshIntervalMs = NOW_MS_DEFAULT_INTERVAL_MS,
}: UseStageDeadlineParams): StageDeadline {
  const nowMs = useNowMs(refreshIntervalMs, deadlineAt !== null);
  return { remainingSeconds: deriveRemainingSeconds(deadlineAt, nowMs), nowMs };
}
