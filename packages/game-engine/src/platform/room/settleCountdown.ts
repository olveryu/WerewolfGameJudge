/**
 * Settle countdown chassis: the one arm decision every
 * "all submitted -> arm -> settle on expiry" round close runs.
 *
 * Moved as-is from the werewolf wolf vote timer decision
 * (`games/werewolf/domain/handlers/progressionEvaluator.ts`,
 * `decideWolfVoteTimerAction`, Strategy A); werewolf is the
 * baseline implementation and now calls this skeleton like every
 * other adopter. The decision is a pure function of three facts
 * the caller supplies: whether the submission set is complete,
 * the deadline a previous arm left behind (null when unarmed),
 * and the current time. Everything else stays injected per game:
 * the completeness predicate (a game's predicate may fail fast on
 * corrupt state; the skeleton never swallows that), the arming
 * landing form (werewolf appends step-deadline state actions,
 * avalon emits an event plus a settle.due effect), and the
 * settlement function itself.
 *
 * Adopters are registered per access point in
 * `__tests__/settleCountdown.contract.test.ts`, together with each
 * point's clear reachability and the no-manual-close weld.
 */

/** Settle countdown in milliseconds, shared by every adopter. */
export const SETTLE_COUNTDOWN_MS = 5000;

/** Result type for the settle countdown arm decision pure function. */
export type SettleCountdownArmAction =
  | { type: 'set'; deadlineAt: number }
  | { type: 'clear' }
  | { type: 'noop' };

/** Inputs for {@link decideSettleCountdownArm}. */
export interface SettleCountdownArmInput {
  /** Whether every required submission for this access point is in. */
  readonly complete: boolean;
  /** The deadline a previous arm set, or null when no countdown is armed. */
  readonly armedDeadlineAt: number | null;
  /** Current time (epoch ms) the decision is made at. */
  readonly nowMs: number;
  /** Countdown length override; defaults to {@link SETTLE_COUNTDOWN_MS}. */
  readonly countdownMs?: number;
}

/**
 * Decide the settle countdown arm action (pure function).
 *
 * | complete | armedDeadlineAt | Action |
 * |----------|-----------------|--------|
 * | true     | any             | set (arm, or refresh the deadline when already armed) |
 * | false    | non-null        | clear (completion retracted after arming) |
 * | false    | null            | noop |
 *
 * Strategy A: any successful submit calls this function; when
 * complete, always set (regardless of content change).
 */
export function decideSettleCountdownArm(input: SettleCountdownArmInput): SettleCountdownArmAction {
  const countdownMs = input.countdownMs ?? SETTLE_COUNTDOWN_MS;
  if (input.complete) return { type: 'set', deadlineAt: input.nowMs + countdownMs };
  if (input.armedDeadlineAt !== null) return { type: 'clear' };
  return { type: 'noop' };
}
