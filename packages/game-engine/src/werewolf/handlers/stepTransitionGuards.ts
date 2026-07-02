/**
 * Step Transition Guards - Night step transition preconditions
 *
 * Pure function module, handles:
 * - ADVANCE_NIGHT / END_NIGHT shared gate validation
 * - SET_AUDIO_PLAYING dedicated gate validation
 *
 * Gates have no IO and do not mutate state.
 */

import { GameStatus } from '../models';
import { WOLF_ROBOT_GATE_ROLES } from './revealPayload';
import type { HandlerContext, HandlerResult, NonNullState } from './types';
import { handlerError } from './types';

/**
 * Validate preconditions (shared by ADVANCE_NIGHT / END_NIGHT)
 *
 * Gate order:
 * 1. no_state
 * 2. invalid_status (must be ongoing)
 * 3. forbidden_while_audio_playing
 * 4. wolfrobot_hunter_status_not_viewed (if learned hunter but not viewed)
 */
export function validateNightFlowPreconditions(
  context: HandlerContext,
): { valid: false; result: HandlerResult } | { valid: true; state: NonNullState } {
  const { state } = context;

  // Gate 1: no_state
  if (!state) {
    return {
      valid: false,
      result: handlerError('no_state'),
    };
  }

  // Gate 2: invalid_status (must be ongoing)
  if (state.status !== GameStatus.Ongoing) {
    return {
      valid: false,
      result: handlerError('invalid_status'),
    };
  }

  // Gate 3: forbidden_while_audio_playing
  if (state.isAudioPlaying) {
    return {
      valid: false,
      result: handlerError('forbidden_while_audio_playing'),
    };
  }

  // Gate 4: wolfrobot_hunter_status_not_viewed
  // If current step is wolfRobotLearn and learned a gate-triggering role but not viewed, reject advance
  if (
    state.currentStepId === 'wolfRobotLearn' &&
    state.wolfRobotReveal?.learnedRoleId != null &&
    WOLF_ROBOT_GATE_ROLES.includes(state.wolfRobotReveal.learnedRoleId) &&
    state.wolfRobotHunterStatusViewed === false
  ) {
    return {
      valid: false,
      result: handlerError('wolfrobot_hunter_status_not_viewed'),
    };
  }

  return { valid: true, state };
}

/**
 * Validate SET_AUDIO_PLAYING preconditions
 *
 * Gate order:
 * 1. no_state
 * 2. invalid_status (must be ongoing or ended)
 *
 * Note: does not check isAudioPlaying, since this handler is what sets it.
 */
export function validateSetAudioPlayingPreconditions(
  context: HandlerContext,
): { valid: false; result: HandlerResult } | { valid: true; state: NonNullState } {
  const { state } = context;

  // Gate 1: no_state
  if (!state) {
    return {
      valid: false,
      result: handlerError('no_state'),
    };
  }

  // Gate 2: invalid_status (must be ongoing or ended)
  // ended is allowed because the daybreak audio plays after endNight
  if (state.status !== GameStatus.Ongoing && state.status !== GameStatus.Ended) {
    return {
      valid: false,
      result: handlerError('invalid_status'),
    };
  }

  return { valid: true, state };
}
