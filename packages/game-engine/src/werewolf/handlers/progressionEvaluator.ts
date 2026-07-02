/**
 * Wolf Vote Pure Functions
 *
 * Responsibilities:
 * - isWolfVoteAllComplete: determine whether all wolves have completed voting (shared by server + evaluator)
 * - decideWolfVoteTimerAction: Timer set/clear/noop decision
 *
 * Only reads state facts to make decisions; contains no IO (network / audio / Alert).
 * Progression decision and execution handled by server-side runInlineProgression (see inlineProgression.ts).
 */

import {
  getBottomCardEffectiveRole,
  isBottomCardWolfVoteExcluded,
} from '../../utils/playerHelpers';
import { doesRoleParticipateInWolfVote } from '../models';
import type { WerewolfState } from '../protocol/types';

/** Wolf vote countdown in milliseconds */
export const WOLF_VOTE_COUNTDOWN_MS = 5000;

/**
 * Determine whether all wolves participating in the vote have voted (exported pure function).
 *
 * Fail-closed design:
 * - player.role missing -> return false (cannot determine role -> not considered all-complete)
 * - 0 participating wolves -> return false (no wolves under wolfKill step is abnormal, should not progress)
 * - Retracted (-2) wolf key already removed by resolver, not in wolfVotesBySeat -> not voted -> false
 *
 * @invariant player.role !== null when status=Ongoing (this function only called during wolfKill step).
 * Guarantee chain: handleAssignRoles writes role for all seats -> status=Assigned ->
 * handleStartNight sets status=Ongoing. During Ongoing, handleTakeSeat rejects joining
 * (status !== Unseated/Seated), handleLeaveMySeat rejects leaving (status === Ongoing).
 * Thus the fail-closed `return false` will not trigger deadlock in production.
 *
 * Behavior change (vs old isCurrentStepComplete wolfKill branch):
 * Old logic `continue` skipped seats with missing role; new logic `return false` (fail-closed).
 */
export function isWolfVoteAllComplete(state: WerewolfState): boolean {
  const wolfVotes = state.currentNightResults?.wolfVotesBySeat ?? {};
  const participatingWolfSeats: number[] = [];
  for (const [seatStr, player] of Object.entries(state.players)) {
    const seat = Number.parseInt(seatStr, 10);
    if (!Number.isFinite(seat)) continue;
    if (!player?.role) return false; // fail-closed: role missing -> uncertain -> false
    const effectiveRole = getBottomCardEffectiveRole(
      player.role,
      state.thiefChosenCard,
      state.treasureMasterChosenCard,
    );
    if (
      doesRoleParticipateInWolfVote(effectiveRole) &&
      !isBottomCardWolfVoteExcluded(player.role)
    ) {
      participatingWolfSeats.push(seat);
    }
  }
  if (participatingWolfSeats.length === 0) return false; // fail-closed: 0 wolves -> abnormal -> false
  return participatingWolfSeats.every((seat) => {
    const v = wolfVotes[String(seat)];
    return typeof v === 'number' && (v >= 0 || v === -1);
  });
}

/**
 * Result type for the Timer decision pure function
 */
type WolfVoteTimerAction = { type: 'set'; deadline: number } | { type: 'clear' } | { type: 'noop' };

/**
 * Decide the wolf vote Timer action (pure function).
 *
 * | allVoted | hasExistingTimer | Action |
 * |---------|-----------------|------|
 * | true    | any             | set (set/reset deadline) |
 * | false   | true            | clear (retract caused vote no longer complete) |
 * | false   | false           | noop |
 *
 * Strategy A: any successful submit calls this function; when allVoted, always set (regardless of content change).
 */
export function decideWolfVoteTimerAction(
  allVoted: boolean,
  hasExistingTimer: boolean,
  now: number,
  countdownMs: number = WOLF_VOTE_COUNTDOWN_MS,
): WolfVoteTimerAction {
  if (allVoted) return { type: 'set', deadline: now + countdownMs };
  if (hasExistingTimer) return { type: 'clear' };
  return { type: 'noop' };
}
