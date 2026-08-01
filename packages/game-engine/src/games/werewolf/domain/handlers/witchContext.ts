/**
 * Witch Context - witch context computation
 *
 * Pure function module, responsible for:
 * - Computing the context the witch needs when acting (killedSeat, canSave, canPoison)
 * - Deciding whether witchContext needs to be set and returning the action
 *
 * Design principles:
 * - Single source of truth: witchContext lives only in GameState.witchContext
 * - Pure function: no IO, no external reads, no state writes
 * - Schema-first: canSave logic aligns with witchAction.steps[0].constraints['notSelf']
 * - Night-1-only: canPoison is always true (project rule: poison available on Night-1)
 */

import type { Rng } from '../../../../platform/random';
import { GameStatus } from '../models';
import type { SchemaId } from '../models/roles/spec';
import { isVacantBottomCardStep, resolveNightStepActor } from '../playerHelpers';
import type { GameState } from '../protocol/types';
import type { SetWitchContextAction } from '../reducer/types';
import { resolveWolfVotes } from '../resolveWolfVotes';

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
function computeWitchContext(
  state: GameState,
  rng: Rng,
): {
  killedSeat: number;
  canSave: boolean;
  canPoison: boolean;
} {
  // 1. Compute the attack target (killedSeat)
  let killedSeat = -1;

  if (!state.wolfKillOverride) {
    if (!state.currentNightResults && state.status !== GameStatus.Ready) {
      throw new Error('[FAIL-FAST] witchAction step has no currentNightResults');
    }
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
    if (typeof resolved === 'number') {
      killedSeat = resolved;
    }
  }

  // 2. Find the witch's seat, used for the notSelf constraint
  const witchActor = resolveNightStepActor(state, 'witch');
  if (witchActor === null) {
    throw new Error('[FAIL-FAST] witchAction step has no assigned witch seat');
  }

  // 3. Schema-first: witchAction.steps[0] (save) has the notSelf constraint
  // canSave must be false when:
  //   (1) no one was killed (killedSeat < 0)
  //   (2) the killed seat is the witch herself (killedSeat === witchSeat)
  const canSave = killedSeat >= 0 && killedSeat !== witchActor.seat;

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
  state: GameState,
  rng: Rng,
): SetWitchContextAction | null {
  const hasWitch = state.templateRoles.includes('witch');

  // Only trigger when entering the witchAction step and witchContext has not yet been set
  if (
    nextStepId !== 'witchAction' ||
    !hasWitch ||
    state.witchContext ||
    isVacantBottomCardStep(state, nextStepId)
  ) {
    return null;
  }

  return {
    type: 'SET_WITCH_CONTEXT',
    payload: computeWitchContext(state, rng),
  };
}
