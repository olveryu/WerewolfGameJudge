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
 * - Broadcasting (handled by the outer command runtime)
 */

import type { SetWolfRobotHunterStatusViewedAction } from '../reducer/types';
import { WOLF_ROBOT_GATE_ROLES } from './revealPayload';
import type { HandlerContext, HandlerResult } from './types';
import { handlerError, handlerSuccess } from './types';

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
 * 1. currentStepId === 'wolfRobotLearn'
 * 2. wolfRobotReveal.learnedRoleId in WOLF_ROBOT_GATE_ROLES
 * 3. player.role at seat === 'wolfRobot'
 *
 * Returns:
 * - success: true + actions: [SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED]
 * - success: false + reason
 */
export function handleSetWolfRobotHunterStatusViewed(
  ctx: HandlerContext,
  intent: SetWolfRobotHunterStatusViewedIntent,
): HandlerResult {
  const state = ctx.state;

  // Gate 1: current step must be wolfRobotLearn
  if (state.currentStepId !== 'wolfRobotLearn') {
    return handlerError('invalid_step');
  }

  // Gate 2: wolfRobotReveal.learnedRoleId must be in the gate trigger role list
  if (
    !state.wolfRobotReveal?.learnedRoleId ||
    !WOLF_ROBOT_GATE_ROLES.includes(state.wolfRobotReveal.learnedRoleId)
  ) {
    return handlerError('not_learned_hunter');
  }

  // Gate 3: seat must be the wolfRobot's seat
  const player = state.players[intent.seat];
  if (player?.role !== 'wolfRobot') {
    return handlerError('invalid_seat');
  }

  // Build action
  const action: SetWolfRobotHunterStatusViewedAction = {
    type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
    payload: { viewed: true },
  };

  return handlerSuccess([action]);
}
