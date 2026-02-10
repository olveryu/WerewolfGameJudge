/**
 * Game Control Handler - 游戏控制处理器（Host-only）
 *
 * 职责：
 * - 处理 ASSIGN_ROLES / START_NIGHT / RESTART_GAME / UPDATE_TEMPLATE intent
 * - 角色分配逻辑（shuffle + 写入 state）
 * - NightPlan 构建（基于 template 生成步骤计划）
 *
 * ✅ 允许：角色分配 + NightPlan 构建 + 返回 StateAction 列表
 * ❌ 禁止：IO（网络 / 音频 / Alert）
 * ❌ 禁止：直接修改 state（返回 StateAction 列表由 reducer 执行）
 */

import type { RoleId } from '@/models/roles';
import { getStepSpec } from '@/models/roles/spec/nightSteps';
import { buildNightPlan } from '@/models/roles/spec/plan';
import type {
  AssignRolesIntent,
  FillWithBotsIntent,
  MarkAllBotsViewedIntent,
  RestartGameIntent,
  SetRoleRevealAnimationIntent,
  StartNightIntent,
  UpdateTemplateIntent,
} from '@/services/engine/intents/types';
import type {
  AssignRolesAction,
  FillWithBotsAction,
  MarkAllBotsViewedAction,
  RestartGameAction,
  SetRoleRevealAnimationAction,
  StartNightAction,
  StateAction,
  UpdateTemplateAction,
} from '@/services/engine/reducer/types';
import type { BroadcastPlayer } from '@/services/protocol/types';
import { shuffleArray } from '@/utils/shuffle';

import { maybeCreateConfirmStatusAction } from './confirmContext';
import type { HandlerContext, HandlerResult } from './types';
import { maybeCreateWitchContextAction } from './witchContext';

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

  // Gate: host only
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

  // Gate: game status must be 'seated'
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

  // Shuffle and assign roles
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

  // Gate: status must be 'ready'
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

  // 收集需要返回的 actions
  const actions: StateAction[] = [];

  // Night-1 only: currentStepIndex 从 0 开始（首个步骤）
  const startNightAction: StartNightAction = {
    type: 'START_NIGHT',
    payload: { currentStepIndex: 0, currentStepId: firstStepId },
  };
  actions.push(startNightAction);

  // 使用统一函数检查是否需要设置 witchContext（无狼板子首步为 witchAction 的情况）
  const witchContextAction = maybeCreateWitchContextAction(firstStepId, state);
  if (witchContextAction) {
    actions.push(witchContextAction);
  }

  // 使用统一函数检查是否需要设置 confirmStatus（首步为 hunterConfirm 的极端情况）
  const confirmStatusAction = maybeCreateConfirmStatusAction(firstStepId, state);
  if (confirmStatusAction) {
    actions.push(confirmStatusAction);
  }

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
    actions,
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

/**
 * 处理设置开牌动画（Host-only）
 *
 * Host 在房间内选择开牌动画时调用。
 * 前置条件：仅 Host 可操作（无状态阶段限制）
 */
export function handleSetRoleRevealAnimation(
  intent: SetRoleRevealAnimationIntent,
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

  const action: SetRoleRevealAnimationAction = {
    type: 'SET_ROLE_REVEAL_ANIMATION',
    animation: intent.animation,
  };

  return {
    success: true,
    actions: [action],
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}

/**
 * 处理填充机器人（Debug-only, Host-only）
 *
 * 前置条件：
 * - isHost === true
 * - status === 'unseated'
 *
 * 结果：
 * - 为所有空座位创建 bot player（isBot: true）
 * - 设置 debugMode.botsEnabled = true
 */
export function handleFillWithBots(
  _intent: FillWithBotsIntent,
  context: HandlerContext,
): HandlerResult {
  const { state, isHost } = context;

  // Gate: host only
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

  // Gate: 只允许在 unseated 阶段填充 bot
  if (state.status !== 'unseated') {
    return {
      success: false,
      reason: 'invalid_status',
      actions: [],
    };
  }

  // 计算空座位并生成 bot players
  const seatCount = state.templateRoles.length;
  // 只有 player !== null 的座位才算已占用
  const occupiedSeats = new Set(
    Object.entries(state.players)
      .filter(([, player]) => player !== null)
      .map(([seat]) => Number.parseInt(seat, 10)),
  );
  const bots: Record<number, BroadcastPlayer> = {};

  for (let seat = 0; seat < seatCount; seat++) {
    if (!occupiedSeats.has(seat)) {
      bots[seat] = {
        uid: `bot-${seat}`,
        seatNumber: seat,
        displayName: `Bot ${seat}`,
        hasViewedRole: false,
        isBot: true,
      };
    }
  }

  const action: FillWithBotsAction = {
    type: 'FILL_WITH_BOTS',
    payload: { bots },
  };

  return {
    success: true,
    actions: [action],
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}

/**
 * 处理标记所有机器人已查看角色（Debug-only, Host-only）
 *
 * 前置条件：
 * - isHost === true
 * - debugMode.botsEnabled === true
 * - status === 'assigned'
 *
 * 结果：仅对 isBot === true 的玩家设置 hasViewedRole = true
 */
export function handleMarkAllBotsViewed(
  _intent: MarkAllBotsViewedIntent,
  context: HandlerContext,
): HandlerResult {
  const { state, isHost } = context;

  // Gate: host only
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

  // Gate: debugMode.botsEnabled 必须为 true
  if (!state.debugMode?.botsEnabled) {
    return {
      success: false,
      reason: 'debug_not_enabled',
      actions: [],
    };
  }

  // Gate: status 必须是 assigned
  if (state.status !== 'assigned') {
    return {
      success: false,
      reason: 'invalid_status',
      actions: [],
    };
  }

  const action: MarkAllBotsViewedAction = {
    type: 'MARK_ALL_BOTS_VIEWED',
  };

  return {
    success: true,
    actions: [action],
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}
