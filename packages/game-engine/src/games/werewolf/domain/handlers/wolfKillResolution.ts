/**
 * Wolf Kill Resolution - the single settlement point for the wolf-kill target
 * and its verdict.
 *
 * Pure functions: no IO, no state writes. Handlers return the
 * SET_RESOLVED_WOLF_KILL_TARGET action; the reducer persists the target
 * and the verdict from that one action, so the two can never diverge.
 *
 * @remarks Why this module exists: resolveWolfVotes picks a tied target
 *   at random, and every command used to carry a fresh random seed, so
 *   the witch context, the witch submission validation and END_NIGHT
 *   could each pick a different tied target in one night (witch saved
 *   seat 6, settlement killed seat 3). The settled target and verdict
 *   are therefore computed exactly once, from the same votes and the
 *   same random pick, stored on GameState.resolvedWolfKillTarget and
 *   GameState.resolvedWolfKillVerdict, and every later consumer reuses
 *   them instead of re-resolving the votes. The only fresh resolution
 *   allowed after storage exists is the legacy fallback in
 *   getLegacyWolfKillTarget, used by END_NIGHT for rooms that started
 *   before this field existed; its result is persisted in the same
 *   END_NIGHT command, so it also settles once. The verdict for a
 *   legacy target is classified deterministically from the votes and
 *   that already-known target (classifyWolfKillVerdict), never by
 *   re-rolling the tie: a target that was one of the tied maxima is
 *   tiePicked, a unique maximum is splitKilled, a single distinct
 *   target is sharedTarget, and a null target with votes is splitTied
 *   only because the v12 engine could only produce a null with votes
 *   under cupid unanimity.
 */

import type { Rng } from '../../../../platform/random';
import type { GameState, ResolvedWolfKillVerdict } from '../protocol/types';
import type { SetResolvedWolfKillTargetAction } from '../reducer/types';
import { resolveWolfVotes } from '../resolveWolfVotes';

/**
 * The settled target as stored on state.
 * undefined = not yet settled; null = settled to no kill; a seat
 * number = the settled kill target.
 */
export function getStoredWolfKillTarget(state: GameState): number | null | undefined {
  return state.resolvedWolfKillTarget;
}

/** The wolf votes as a seat -> target map (-1 = abstain). */
function buildWolfVotesMap(state: GameState): Map<number, number> {
  const wolfVotesBySeat = state.currentNightResults?.wolfVotesBySeat ?? {};
  const votes = new Map<number, number>();
  for (const [seatStr, targetSeat] of Object.entries(wolfVotesBySeat)) {
    const seat = Number.parseInt(seatStr, 10);
    if (!Number.isSafeInteger(seat)) {
      throw new Error(`[FAIL-FAST] Invalid wolf-vote seat key: ${seatStr}`);
    }
    votes.set(seat, targetSeat);
  }
  return votes;
}

/**
 * Classify a known wolf-kill target against the current votes, without
 * any randomness: the target is an input, never re-picked here. Used
 * by settleWolfKillFromVotes for the verdict twin of a fresh pick, and
 * by END_NIGHT for a legacy target recovered from an older room.
 * A wolf-kill override has no vote verdict and yields null; it must
 * never be reported as splitTied (the night report's wolfGiveUp card
 * carries the override cause instead).
 */
export function classifyWolfKillVerdict(
  state: GameState,
  target: number | null,
): ResolvedWolfKillVerdict | null {
  if (state.wolfKillOverride) return null;
  const votes = buildWolfVotesMap(state);
  const nonAbstainVotes = Array.from(votes.values()).filter((vote) => vote !== -1);
  if (nonAbstainVotes.length === 0) return { type: 'allAbstain' };
  if (target === null) return { type: 'splitTied' };
  const counts = new Map<number, number>();
  for (const vote of nonAbstainVotes) {
    counts.set(vote, (counts.get(vote) ?? 0) + 1);
  }
  if (counts.size === 1) return { type: 'sharedTarget', targetSeat: target };
  let maxCount = 0;
  let tiedAtMax = false;
  for (const count of counts.values()) {
    if (count > maxCount) {
      maxCount = count;
      tiedAtMax = false;
    } else if (count === maxCount) {
      tiedAtMax = true;
    }
  }
  return tiedAtMax
    ? { type: 'tiePicked', targetSeat: target }
    : { type: 'splitKilled', targetSeat: target };
}

/**
 * The settled wolf-kill target and verdict, computed together.
 * @pre The wolf votes are final (the wolfKill step has passed, or the
 *   plan has no wolfKill step). Callers must not invoke this while
 *   wolves can still change their votes. Exactly one resolveWolfVotes
 *   call runs here, so the verdict's targetSeat is always the picked
 *   target; classifyWolfKillVerdict only reads the votes and that
 *   target and consumes no randomness.
 */
export function settleWolfKillFromVotes(
  state: GameState,
  rng: Rng,
): { readonly target: number | null; readonly verdict: ResolvedWolfKillVerdict | null } {
  if (state.wolfKillOverride) return { target: null, verdict: null };
  const resolved = resolveWolfVotes(buildWolfVotesMap(state), {
    requireUnanimity: state.templateRoles.includes('cupid'),
    rng,
  });
  const target = typeof resolved === 'number' ? resolved : null;
  return { target, verdict: classifyWolfKillVerdict(state, target) };
}

/**
 * Build the persistence action for the settled target and verdict, or
 * null when the target is already stored. Callers must only invoke
 * this when the votes are final (see settleWolfKillFromVotes). The
 * target and the verdict travel in this one action; there is no
 * second action that backfills a verdict after the target.
 */
export function maybeCreateResolvedWolfKillTargetAction(
  state: GameState,
  rng: Rng,
): SetResolvedWolfKillTargetAction | null {
  if (state.resolvedWolfKillTarget !== undefined) return null;
  const settled = settleWolfKillFromVotes(state, rng);
  return {
    type: 'SET_RESOLVED_WOLF_KILL_TARGET',
    payload: { target: settled.target, verdict: settled.verdict },
  };
}

/**
 * Best available wolf-kill target for a state that may predate the
 * stored field (a v12 room migrated to v13, or a night already past
 * the witch step where witchContext was cleared on advance).
 * Order: stored value, then the witch's recorded save (a save was
 * only accepted when it equalled the wolf-kill target at submission
 * time, so a recorded save proves that seat was the target), then
 * the live witch context. undefined means no prior settlement can
 * be recovered and the caller must settle fresh (once) and persist it.
 */
export function getLegacyWolfKillTarget(state: GameState): number | null | undefined {
  if (state.resolvedWolfKillTarget !== undefined) return state.resolvedWolfKillTarget;
  const savedSeat = state.currentNightResults?.savedSeat;
  if (savedSeat !== undefined) return savedSeat;
  const killedSeat = state.witchContext?.killedSeat;
  if (killedSeat !== undefined) return killedSeat >= 0 ? killedSeat : null;
  return undefined;
}
