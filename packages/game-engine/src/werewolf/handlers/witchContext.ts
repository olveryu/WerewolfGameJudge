/**
 * Witch Context - witch context computation
 *
 * Pure function module, responsible for:
 * - Computing the context the witch needs when acting (killedSeat, canSave, canPoison)
 * - Deciding whether witchContext needs to be set and returning the action
 *
 * Design principles:
 * - Single source of truth: witchContext lives only in WerewolfState.witchContext
 * - Pure function: no IO, no external reads, no state writes
 * - Schema-first: canSave logic aligns with witchAction.steps[0].constraints['notSelf']
 * - Night-1-only: canPoison is always true (project rule: poison available on Night-1)
 */

import { findSeatByRole } from '../../utils/playerHelpers';
import type { SchemaId } from '../models/roles/spec';
import type { SetWitchContextAction } from '../reducer/types';
import { resolveWolfVotes } from '../resolveWolfVotes';
import type { NonNullState } from './types';

/**
 * Compute the witch context (pure function)
 *
 * Called before entering the witchAction step, uniformly computes:
 * - killedSeat: attack target (-1 means no death)
 * - canSave: whether the antidote can be used
 * - canPoison: whether poison can be used
 *
 * @param state current game state
 * @returns witchContext payload
 */
function computeWitchContext(state: NonNullState): {
  killedSeat: number;
  canSave: boolean;
  canPoison: boolean;
} {
  // 1. Compute the attack target (killedSeat)
  let killedSeat = -1;

  if (!state.wolfKillOverride) {
    const wolfVotesBySeat = state.currentNightResults?.wolfVotesBySeat ?? {};
    const votes = new Map<number, number>();
    for (const [seatStr, targetSeat] of Object.entries(wolfVotesBySeat)) {
      const seat = Number.parseInt(seatStr, 10);
      if (!Number.isFinite(seat) || typeof targetSeat !== 'number') continue;
      votes.set(seat, targetSeat);
    }
    const resolved = resolveWolfVotes(votes, {
      requireUnanimity: state.templateRoles.includes('cupid'),
    });
    if (typeof resolved === 'number') {
      killedSeat = resolved;
    }
  }

  // 2. Find the witch's seat, used for the notSelf constraint
  const witchSeat = findSeatByRole(state.players, 'witch') ?? -1;

  // 3. Schema-first: witchAction.steps[0] (save) has the notSelf constraint
  // canSave must be false when:
  //   (1) no one was killed (killedSeat < 0)
  //   (2) the killed seat is the witch herself (killedSeat === witchSeat)
  //   (3) the witch's seat is not found (witchSeat === -1; defensive: forbid save to avoid mishandling abnormal state)
  const canSave = killedSeat >= 0 && witchSeat >= 0 && killedSeat !== witchSeat;

  // Night-1 only (project rule): poison is always available
  // If multi-night becomes supported, switch to reading whether the witch has already used poison from state
  const canPoison = true;

  return { killedSeat, canSave, canPoison };
}

/**
 * Check whether witchContext needs to be set, and return the action if so
 *
 * Unified entry point: any code path entering the witchAction step calls this function
 *
 * @param nextStepId the step ID being entered
 * @param state current game state
 * @returns SET_WITCH_CONTEXT action or null
 */
export function maybeCreateWitchContextAction(
  nextStepId: SchemaId,
  state: NonNullState,
): SetWitchContextAction | null {
  const hasWitch = state.templateRoles.includes('witch');

  // Only trigger when entering the witchAction step and witchContext has not yet been set
  if (nextStepId !== 'witchAction' || !hasWitch || state.witchContext) {
    return null;
  }

  return {
    type: 'SET_WITCH_CONTEXT',
    payload: computeWitchContext(state),
  };
}
