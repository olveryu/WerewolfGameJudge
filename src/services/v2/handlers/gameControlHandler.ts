/**
 * Game Control Handler - 游戏控制处理器
 *
 * 处理 ASSIGN_ROLES / START_NIGHT / RESTART_GAME intent（仅主机）
 */

import type {
  AssignRolesIntent,
  StartGameIntent,
  StartNightIntent,
  RestartGameIntent,
} from '../intents/types';
import type { HandlerContext, HandlerResult } from './types';
import type { AssignRolesAction, StartNightAction, RestartGameAction } from '../reducer/types';
import { shuffleArray } from '../../../utils/shuffle';
import type { RoleId } from '../../../models/roles';

/**
 * 处理分配角色（仅 seated → assigned）
 *
 * Legacy 对齐：GameStateService.ts L1455-1478
 * - 前置条件：status === 'seated' && isHost
 * - 洗牌分配角色
 * - 设置 hasViewedRole = false
 * - status → 'assigned'
 * - 广播 STATE_UPDATE
 */
export function handleAssignRoles(
  _intent: AssignRolesIntent,
  context: HandlerContext,
): HandlerResult {
  const { state, isHost } = context;

  // 验证：仅主机可操作（Legacy L1456）
  if (!isHost) {
    return {
      success: false,
      reason: 'host_only',
      actions: [],
    };
  }

  // 验证：state 存在
  if (!state) {
    return {
      success: false,
      reason: 'no_state',
      actions: [],
    };
  }

  // 验证：游戏状态必须是 seated（Legacy L1457）
  if (state.status !== 'seated') {
    return {
      success: false,
      reason: 'invalid_status',
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

  // 随机分配角色（Legacy L1460）
  const shuffledRoles = shuffleArray([...state.templateRoles]);
  const assignments: Record<number, RoleId> = {};
  const seats = Object.keys(state.players).map((s) => Number.parseInt(s, 10));

  for (let i = 0; i < seats.length; i++) {
    assignments[seats[i]] = shuffledRoles[i];
  }

  // 只产生 ASSIGN_ROLES action（不产生 START_NIGHT）
  const assignRolesAction: AssignRolesAction = {
    type: 'ASSIGN_ROLES',
    payload: { assignments },
  };

  return {
    success: true,
    actions: [assignRolesAction],
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}

/**
 * 处理开始游戏（分配角色 + 开始夜晚）
 *
 * 注意：PR3 将修改此函数，使其前置条件为 status === 'ready'
 * 当前保留原实现以便回滚
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

  // 验证：state 存在
  if (!state) {
    return {
      success: false,
      reason: 'no_state',
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
 * 处理开始夜晚（ready → ongoing）
 *
 * Legacy 对齐：GameStateService.ts L1483-1556
 * - 前置条件：status === 'ready' && isHost
 * - 初始化 Night-1 字段
 * - status → 'ongoing'
 * - 广播 STATE_UPDATE
 *
 * PR3 范围：只做状态初始化，不做音频/advance/action 处理
 */
export function handleStartNight(
  _intent: StartNightIntent,
  context: HandlerContext,
): HandlerResult {
  const { state, isHost } = context;

  // Gate: 仅主机可操作
  if (!isHost) {
    return {
      success: false,
      reason: 'host_only',
      actions: [],
    };
  }

  // Gate: state 存在
  if (!state) {
    return {
      success: false,
      reason: 'no_state',
      actions: [],
    };
  }

  // Gate: 前置状态必须是 ready（Legacy L1485）
  if (state.status !== 'ready') {
    return {
      success: false,
      reason: 'invalid_status',
      actions: [],
    };
  }

  // Night-1 only: currentActionerIndex 从 0 开始（首个步骤）
  const startNightAction: StartNightAction = {
    type: 'START_NIGHT',
    payload: { currentActionerIndex: 0 },
  };

  return {
    success: true,
    actions: [startNightAction],
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
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
