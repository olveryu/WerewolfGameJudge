/**
 * Wolf Kill Resolution - the single settlement point for the wolf-kill target.
 *
 * Pure functions: no IO, no state writes. Handlers return the
 * SET_RESOLVED_WOLF_KILL_TARGET action; the reducer persists it.
 *
 * @remarks Why this module exists: resolveWolfVotes picks a tied target
 *   at random, and every command used to carry a fresh random seed, so
 *   the witch context, the witch submission validation and END_NIGHT
 *   could each pick a different tied target in one night (witch saved
 *   seat 6, settlement killed seat 3). The settled target is therefore
 *   computed exactly once, stored on GameState.resolvedWolfKillTarget,
 *   and every later consumer reuses it instead of re-resolving the
 *   votes. The only fresh resolution allowed after storage exists is
 *   the legacy fallback in getLegacyWolfKillTarget, used by END_NIGHT
 *   for rooms that started before this field existed; its result is
 *   persisted in the same END_NIGHT command, so it also settles once.
 */

import type { Rng } from '../../../../platform/random';
import type { GameState } from '../protocol/types';
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

/**
 * Resolve the wolf-kill target from the current votes, once.
 * A wolf-kill override settles to no kill regardless of the votes.
 * @pre The wolf votes are final (the wolfKill step has passed, or the
 *   plan has no wolfKill step). Callers must not invoke this while
 *   wolves can still change their votes.
 */
export function resolveWolfKillTargetFromVotes(state: GameState, rng: Rng): number | null {
  if (state.wolfKillOverride) return null;
  const wolfVotesBySeat = state.currentNightResults?.wolfVotesBySeat ?? {};
  const votes = new Map<number, number>();
  for (const [seatStr, targetSeat] of Object.entries(wolfVotesBySeat)) {
    const seat = Number.parseInt(seatStr, 10);
    if (!Number.isSafeInteger(seat)) {
      throw new Error(`[FAIL-FAST] Invalid wolf-vote seat key: ${seatStr}`);
    }
    votes.set(seat, targetSeat);
  }
  const resolved = resolveWolfVotes(votes, {
    requireUnanimity: state.templateRoles.includes('cupid'),
    rng,
  });
  return typeof resolved === 'number' ? resolved : null;
}

/**
 * Build the persistence action for the settled target, or null when
 * the target is already stored. Callers must only invoke this when
 * the votes are final (see resolveWolfKillTargetFromVotes).
 */
export function maybeCreateResolvedWolfKillTargetAction(
  state: GameState,
  rng: Rng,
): SetResolvedWolfKillTargetAction | null {
  if (state.resolvedWolfKillTarget !== undefined) return null;
  return {
    type: 'SET_RESOLVED_WOLF_KILL_TARGET',
    payload: { target: resolveWolfKillTargetFromVotes(state, rng) },
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
