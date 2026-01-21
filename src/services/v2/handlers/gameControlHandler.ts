/**
 * Game Control Handler - 游戏控制处理器
 *
 * 处理 START_GAME / RESTART_GAME intent（仅主机）
 */

import type { StartGameIntent, RestartGameIntent } from '../intents/types';
import type { HandlerContext, HandlerResult } from './types';
import type { AssignRolesAction, StartNightAction, RestartGameAction } from '../reducer/types';
import { shuffleArray } from '../../../utils/shuffle';
import type { RoleId } from '../../../models/roles';

/**
 * 处理开始游戏（分配角色 + 开始夜晚）
 */
export function handleStartGame(_intent: StartGameIntent, context: HandlerContext): HandlerResult {
  const { state, isHost } = context;

  // 验证：仅主机可操作
  if (!isHost) {
    return {
      success: false,
      reason: 'host_only',
      actions: [],
    };
  }

  // 验证：游戏状态
  if (state.status !== 'seated') {
    return {
      success: false,
      reason: 'not_all_seated',
      actions: [],
    };
  }

  // 验证：模板角色数量与座位数匹配
  const seatCount = Object.keys(state.players).length;
  if (state.templateRoles.length !== seatCount) {
    return {
      success: false,
      reason: 'role_count_mismatch',
      actions: [],
    };
  }

  // 随机分配角色
  const shuffledRoles = shuffleArray([...state.templateRoles]);
  const assignments: Record<number, RoleId> = {};
  const seats = Object.keys(state.players).map((s) => Number.parseInt(s, 10));

  for (let i = 0; i < seats.length; i++) {
    assignments[seats[i]] = shuffledRoles[i];
  }

  const assignRolesAction: AssignRolesAction = {
    type: 'ASSIGN_ROLES',
    payload: { assignments },
  };

  const startNightAction: StartNightAction = {
    type: 'START_NIGHT',
    payload: { currentActionerIndex: 0 },
  };

  return {
    success: true,
    actions: [assignRolesAction, startNightAction],
    sideEffects: [
      { type: 'BROADCAST_STATE' },
      { type: 'SAVE_STATE' },
      // 音频播放由外层根据 NightFlowController 决定
    ],
  };
}

/**
 * 处理重新开始游戏
 */
export function handleRestartGame(
  _intent: RestartGameIntent,
  context: HandlerContext,
): HandlerResult {
  const { isHost } = context;

  // 验证：仅主机可操作
  if (!isHost) {
    return {
      success: false,
      reason: 'host_only',
      actions: [],
    };
  }

  const action: RestartGameAction = {
    type: 'RESTART_GAME',
  };

  return {
    success: true,
    actions: [action],
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}
