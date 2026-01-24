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
  UpdateTemplateIntent,
} from '../../v2/intents/types';
import type { HandlerContext, HandlerResult } from './types';
import type {
  AssignRolesAction,
  StartNightAction,
  RestartGameAction,
  UpdateTemplateAction,
} from '../reducer/types';
import { shuffleArray } from '../../../utils/shuffle';
import type { RoleId } from '../../../models/roles';
import { buildNightPlan } from '../../../models/roles/spec/plan';
import { getStepSpec } from '../../../models/roles/spec/nightSteps';

/**
 * 处理分配角色（仅 seated → assigned）
 *
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

  // 首步来自 buildNightPlan 表驱动单源（按当前模板角色过滤）
  const nightPlan = buildNightPlan(state.templateRoles);

  // Fail-fast: 如果 nightPlan 为空，说明 templateRoles 没有夜晚行动角色
  if (nightPlan.steps.length === 0) {
    return {
      success: false,
      reason: 'no_night_actions',
      actions: [],
    };
  }

  const firstStepId = nightPlan.steps[0].stepId;

  const startNightAction: StartNightAction = {
    type: 'START_NIGHT',
    payload: { currentActionerIndex: 0, currentStepId: firstStepId },
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

  // 首步来自 buildNightPlan 表驱动单源（按当前模板角色过滤）
  const nightPlan = buildNightPlan(state.templateRoles);

  // Fail-fast: 如果 nightPlan 为空，说明 templateRoles 没有夜晚行动角色
  // 这在有效游戏中不应该发生（至少应该有 wolf）
  if (nightPlan.steps.length === 0) {
    return {
      success: false,
      reason: 'no_night_actions',
      actions: [],
    };
  }

  const firstStepId = nightPlan.steps[0].stepId;
  const firstStepSpec = getStepSpec(firstStepId);

  // Night-1 only: currentActionerIndex 从 0 开始（首个步骤）
  const startNightAction: StartNightAction = {
    type: 'START_NIGHT',
    payload: { currentActionerIndex: 0, currentStepId: firstStepId },
  };

  // 构建 sideEffects：先广播 + 保存，然后播放夜晚开始音频 + 第一步音频
  const sideEffects: HandlerResult['sideEffects'] = [
    { type: 'BROADCAST_STATE' },
    { type: 'SAVE_STATE' },
    // 夜晚开始背景音
    { type: 'PLAY_AUDIO', audioKey: 'night', isEndAudio: false },
  ];

  // 添加第一步（通常是狼人）的开始音频
  if (firstStepSpec) {
    sideEffects.push({
      type: 'PLAY_AUDIO',
      audioKey: firstStepSpec.audioKey,
      isEndAudio: false,
    });
  }

  return {
    success: true,
    actions: [startNightAction],
    sideEffects,
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

/**
 * 处理更新模板（仅“准备看牌前”：unseated | seated）
 *
 * Host 编辑房间配置时调用。
 */
export function handleUpdateTemplate(
  intent: UpdateTemplateIntent,
  context: HandlerContext,
): HandlerResult {
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

  // 验证：仅允许“准备看牌前”修改（unseated/seated）。
  // 一旦进入 assigned/ready/ongoing/ended，修改会造成状态机与玩家认知漂移，因此强制要求先 RESTART_GAME。
  const canUpdateTemplateBeforeView = state.status === 'unseated' || state.status === 'seated';
  if (!canUpdateTemplateBeforeView) {
    return {
      success: false,
      reason:
        '只能在“准备看牌”前修改设置（未入座/已入座阶段）。如果已经不是该阶段，请先点击“重新开始”回到准备阶段再修改。',
      actions: [],
    };
  }

  const action: UpdateTemplateAction = {
    type: 'UPDATE_TEMPLATE',
    payload: { templateRoles: intent.payload.templateRoles },
  };

  return {
    success: true,
    actions: [action],
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}
