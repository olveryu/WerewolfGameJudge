/**
 * WolfRobot Hunter Gate Handler
 *
 * Handles the "view status" gate after Wolf Robot learns the hunter role.
 *
 * Responsibilities:
 * - Validate gate conditions (host_only, step, learnedRoleId, seat)
 * - Return SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED action
 *
 * Not responsible for:
 * - Directly mutating state (handled by the reducer)
 * - Broadcasting (handled by the facade layer)
 */

import { getEngineLogger } from '../../utils/logger';
import type { SetWolfRobotHunterStatusViewedAction } from '../reducer/types';
import { WOLF_ROBOT_GATE_ROLES } from './revealPayload';
import type { HandlerContext, HandlerResult } from './types';
import { handlerError, handlerSuccess, STANDARD_SIDE_EFFECTS } from './types';

const handlerLog = getEngineLogger().extend('WolfRobotHunterGateHandler');

/**
 * Intent type: set Wolf Robot hunter status as viewed
 */
interface SetWolfRobotHunterStatusViewedIntent {
  type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED';
  seat: number;
}

/**
 * Handle Wolf Robot viewing the hunter status
 *
 * Validation:
 * 1. state exists
 * 2. currentStepId === 'wolfRobotLearn'
 * 3. wolfRobotReveal.learnedRoleId in WOLF_ROBOT_GATE_ROLES
 * 4. player.role at seat === 'wolfRobot'
 *
 * Returns:
 * - success: true + actions: [SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED]
 * - success: false + reason
 */
export function handleSetWolfRobotHunterStatusViewed(
  ctx: HandlerContext,
  intent: SetWolfRobotHunterStatusViewedIntent,
): HandlerResult {
  handlerLog.debug('handleSetWolfRobotHunterStatusViewed', {
    seat: intent.seat,
  });

  // Gate 1: state exists
  const state = ctx.state;
  if (!state) {
    handlerLog.debug('rejected: no_state');
    return handlerError('no_state');
  }

  // Gate 2: current step must be wolfRobotLearn
  if (state.currentStepId !== 'wolfRobotLearn') {
    handlerLog.warn('rejected: invalid_step', {
      currentStepId: state.currentStepId,
      expected: 'wolfRobotLearn',
    });
    return handlerError('invalid_step');
  }

  // Gate 3: wolfRobotReveal.learnedRoleId must be in the gate trigger role list
  if (
    !state.wolfRobotReveal?.learnedRoleId ||
    !WOLF_ROBOT_GATE_ROLES.includes(state.wolfRobotReveal.learnedRoleId)
  ) {
    handlerLog.warn('rejected: not_learned_gate_role', {
      learnedRoleId: state.wolfRobotReveal?.learnedRoleId,
    });
    return handlerError('not_learned_hunter');
  }

  // Gate 4: seat must be the wolfRobot's seat
  const player = state.players[intent.seat];
  if (player?.role !== 'wolfRobot') {
    handlerLog.warn('rejected: invalid_seat', {
      seat: intent.seat,
      playerRole: player?.role,
    });
    return handlerError('invalid_seat');
  }

  // Build action
  const action: SetWolfRobotHunterStatusViewedAction = {
    type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
    payload: { viewed: true },
  };

  handlerLog.debug('success: returning SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED action');

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}
