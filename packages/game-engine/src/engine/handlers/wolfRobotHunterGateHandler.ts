/**
 * WolfRobot Hunter Gate Handler
 *
 * 处理机械狼人人学到猎人后的"查看状态"gate。
 *
 * 职责：
 * - 校验 gate 条件（host_only、step、learnedRoleId、seat）
 * - 返回 SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED action
 *
 * 不负责：
 * - 直接修改 state（由 reducer 处理）
 * - broadcast（由 facade 层处理）
 */

import { getEngineLogger } from '../../utils/logger';
import type { SetWolfRobotHunterStatusViewedAction } from '../reducer/types';
import { WOLF_ROBOT_GATE_ROLES } from './revealPayload';
import type { HandlerContext, HandlerResult } from './types';
import { handlerError, handlerSuccess, STANDARD_SIDE_EFFECTS } from './types';

const handlerLog = getEngineLogger().extend('WolfRobotHunterGateHandler');

/**
 * Intent 类型：设置机械狼人人查看猎人状态
 */
interface SetWolfRobotHunterStatusViewedIntent {
  type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED';
  seat: number;
}

/**
 * 处理机械狼人人查看猎人状态
 *
 * 校验：
 * 1. state 存在
 * 2. currentStepId === 'wolfRobotLearn'
 * 3. wolfRobotReveal.learnedRoleId in WOLF_ROBOT_GATE_ROLES
 * 4. seat 对应的 player.role === 'wolfRobot'
 *
 * 返回：
 * - success: true + actions: [SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED]
 * - success: false + reason
 */
export function handleSetWolfRobotHunterStatusViewed(
  intent: SetWolfRobotHunterStatusViewedIntent,
  ctx: HandlerContext,
): HandlerResult {
  handlerLog.debug('handleSetWolfRobotHunterStatusViewed', {
    seat: intent.seat,
  });

  // Gate 1: state 存在
  const state = ctx.state;
  if (!state) {
    handlerLog.debug('rejected: no_state');
    return handlerError('no_state');
  }

  // Gate 2: 当前 step 必须是 wolfRobotLearn
  if (state.currentStepId !== 'wolfRobotLearn') {
    handlerLog.warn('rejected: invalid_step', {
      currentStepId: state.currentStepId,
      expected: 'wolfRobotLearn',
    });
    return handlerError('invalid_step');
  }

  // Gate 3: wolfRobotReveal.learnedRoleId 必须在 gate 触发角色列表中
  if (
    !state.wolfRobotReveal?.learnedRoleId ||
    !WOLF_ROBOT_GATE_ROLES.includes(state.wolfRobotReveal.learnedRoleId)
  ) {
    handlerLog.warn('rejected: not_learned_gate_role', {
      learnedRoleId: state.wolfRobotReveal?.learnedRoleId,
    });
    return handlerError('not_learned_hunter');
  }

  // Gate 4: seat 必须是 wolfRobot 的 seat
  const player = state.players[intent.seat];
  if (player?.role !== 'wolfRobot') {
    handlerLog.warn('rejected: invalid_seat', {
      seat: intent.seat,
      playerRole: player?.role,
    });
    return handlerError('invalid_seat');
  }

  // 构建 action
  const action: SetWolfRobotHunterStatusViewedAction = {
    type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
    payload: { viewed: true },
  };

  handlerLog.debug('success: returning SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED action');

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}
