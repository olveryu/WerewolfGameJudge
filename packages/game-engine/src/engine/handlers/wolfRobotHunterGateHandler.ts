/**
 * WolfRobot Hunter Gate Handler
 *
 * 处理机械狼学到猎人后的"查看状态"gate。
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
import type { HandlerContext, HandlerResult } from './types';

const handlerLog = getEngineLogger().extend('WolfRobotHunterGateHandler');

/**
 * Intent 类型：设置机械狼查看猎人状态
 */
interface SetWolfRobotHunterStatusViewedIntent {
  type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED';
  seat: number;
}

/**
 * 处理机械狼查看猎人状态
 *
 * 校验：
 * 1. host_only
 * 2. state 存在
 * 3. currentStepId === 'wolfRobotLearn'
 * 4. wolfRobotReveal.learnedRoleId === 'hunter'
 * 5. seat 对应的 player.role === 'wolfRobot'
 *
 * 返回：
 * - success: true + actions: [SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED]
 * - success: false + reason
 */
export function handleSetWolfRobotHunterStatusViewed(
  ctx: HandlerContext,
  intent: SetWolfRobotHunterStatusViewedIntent,
): HandlerResult {
  handlerLog.debug('handleSetWolfRobotHunterStatusViewed', {
    isHost: ctx.isHost,
    seat: intent.seat,
  });

  // Gate 1: host_only
  if (!ctx.isHost) {
    handlerLog.debug('rejected: host_only');
    return { success: false, reason: 'host_only', actions: [] };
  }

  // Gate 2: state 存在
  const state = ctx.state;
  if (!state) {
    handlerLog.debug('rejected: no_state');
    return { success: false, reason: 'no_state', actions: [] };
  }

  // Gate 3: 当前 step 必须是 wolfRobotLearn
  if (state.currentStepId !== 'wolfRobotLearn') {
    handlerLog.warn('rejected: invalid_step', {
      currentStepId: state.currentStepId,
      expected: 'wolfRobotLearn',
    });
    return { success: false, reason: 'invalid_step', actions: [] };
  }

  // Gate 4: wolfRobotReveal.learnedRoleId 必须是 hunter
  if (state.wolfRobotReveal?.learnedRoleId !== 'hunter') {
    handlerLog.warn('rejected: not_learned_hunter', {
      learnedRoleId: state.wolfRobotReveal?.learnedRoleId,
    });
    return { success: false, reason: 'not_learned_hunter', actions: [] };
  }

  // Gate 5: seat 必须是 wolfRobot 的 seat
  const player = state.players[intent.seat];
  if (player?.role !== 'wolfRobot') {
    handlerLog.warn('rejected: invalid_seat', {
      seat: intent.seat,
      playerRole: player?.role,
    });
    return { success: false, reason: 'invalid_seat', actions: [] };
  }

  // 构建 action
  const action: SetWolfRobotHunterStatusViewedAction = {
    type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
    payload: { viewed: true },
  };

  handlerLog.debug('success: returning SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED action');

  return {
    success: true,
    actions: [action],
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}
