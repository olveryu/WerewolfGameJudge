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
 * The one exception is the host self-rescue retry (D3 follow-up):
 * once the deadline has passed and the grace below has elapsed, the
 * settle is overdue and the host may re-drive it through the game's
 * existing settle dispatch (`<game>.phase.retrySettle`). The overdue
 * decision lives here, once — every game's rescue UI reads
 * `isOverdue` from this hook and only the displayed sentences differ
 * per game.
 *
 * Game-specific concerns stay with the caller: which deadline is armed
 * and how the remaining seconds are rendered.
 */

import { NOW_MS_DEFAULT_INTERVAL_MS, useNowMs } from './useNowMs';

/**
 * Grace after the deadline before a stuck settle is shown as overdue
 * (D3 follow-up): the server alarm can arrive seconds late under load,
 * so the rescue button appears only once the deadline has been passed
 * for this long. One place — every game's rescue decision reads it
 * from here.
 */
const SETTLE_RETRY_GRACE_MS = 5_000;

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
  /** True once the deadline passed and the grace elapsed: the settle is overdue. */
  readonly isOverdue: boolean;
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
  return {
    remainingSeconds: deriveRemainingSeconds(deadlineAt, nowMs),
    nowMs,
    isOverdue: deadlineAt !== null && nowMs >= deadlineAt + SETTLE_RETRY_GRACE_MS,
  };
}
