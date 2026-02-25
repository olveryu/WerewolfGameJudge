/**
 * Step Transition Handler - 夜晚步骤切换与结算处理器（Host-only）
 *
 * 职责：
 * - ADVANCE_NIGHT：音频结束后推进到下一步
 * - END_NIGHT：夜晚结束后进行死亡结算
 * - SET_AUDIO_PLAYING：设置音频播放 Gate 状态
 * - Gate validation（host_only / no_state / invalid_status / forbidden_while_audio_playing）
 * - 调用 resolveWolfVotes / calculateDeaths（复用，不重写）
 *
 * 返回 StateAction 列表与 SideEffect（PLAY_AUDIO），不包含 IO（网络 / 音频播放 / Alert，
 * 音频 IO 由 Facade 执行），不直接修改 state（返回 StateAction 列表由 reducer 执行），
 * 不手动推进 index（`++` 兜底策略禁止）。
 */

import type { WitchAction } from '../../models/actions/WitchAction';
import { makeWitchNone, makeWitchPoison, makeWitchSave } from '../../models/actions/WitchAction';
import type { RoleId } from '../../models/roles';
import { getWolfRoleIds, ROLE_SPECS } from '../../models/roles';
import type { SchemaId } from '../../models/roles/spec';
import { getStepSpec } from '../../models/roles/spec/nightSteps';
import { buildNightPlan, type NightPlanStep } from '../../models/roles/spec/plan';
import { BLOCKED_UI_DEFAULTS, type SchemaUi } from '../../models/roles/spec/schema.types';
import { SCHEMAS } from '../../models/roles/spec/schemas';
import type { RoleSpec } from '../../models/roles/spec/spec.types';
import type { ProtocolAction } from '../../protocol/types';
import { getRoleAfterSwap } from '../../resolvers/types';
import { resolveSeerAudioKey } from '../../utils/audioKeyOverride';
import { getEngineLogger } from '../../utils/logger';
import type { NightActions, RoleSeatMap } from '../DeathCalculator';
import { calculateDeaths } from '../DeathCalculator';
import type { AdvanceNightIntent, EndNightIntent, SetAudioPlayingIntent } from '../intents/types';
import type {
  AdvanceToNextActionAction,
  EndNightAction,
  SetAudioPlayingAction,
  SetUiHintAction,
  StateAction,
} from '../reducer/types';
import { resolveWolfVotes } from '../resolveWolfVotes';

const nightFlowLog = getEngineLogger().extend('NightFlow');

import { GameStatus } from '../../models/GameStatus';
import { maybeCreateConfirmStatusAction } from './confirmContext';
import type { HandlerContext, HandlerResult } from './types';
import { maybeCreateWitchContextAction } from './witchContext';

/**
 * 非 null 的 state 类型
 */
type NonNullState = NonNullable<HandlerContext['state']>;

// =============================================================================
// Gate Validation
// =============================================================================

/**
 * 验证前置条件（ADVANCE_NIGHT / END_NIGHT 共用）
 *
 * Gate 顺序：
 * 1. host_only
 * 2. no_state
 * 3. invalid_status (must be ongoing)
 * 4. forbidden_while_audio_playing
 * 5. wolfrobot_hunter_status_not_viewed (if learned hunter but not viewed)
 */
function validateNightFlowPreconditions(
  context: HandlerContext,
): { valid: false; result: HandlerResult } | { valid: true; state: NonNullState } {
  const { state, isHost } = context;

  // Gate 1: host_only
  if (!isHost) {
    return {
      valid: false,
      result: { success: false, reason: 'host_only', actions: [] },
    };
  }

  // Gate 2: no_state
  if (!state) {
    return {
      valid: false,
      result: { success: false, reason: 'no_state', actions: [] },
    };
  }

  // Gate 3: invalid_status (must be ongoing)
  if (state.status !== GameStatus.Ongoing) {
    return {
      valid: false,
      result: { success: false, reason: 'invalid_status', actions: [] },
    };
  }

  // Gate 4: forbidden_while_audio_playing
  if (state.isAudioPlaying) {
    return {
      valid: false,
      result: { success: false, reason: 'forbidden_while_audio_playing', actions: [] },
    };
  }

  // Gate 5: wolfrobot_hunter_status_not_viewed
  // If current step is wolfRobotLearn and learned hunter but not viewed, reject advance
  if (
    state.currentStepId === 'wolfRobotLearn' &&
    state.wolfRobotReveal?.learnedRoleId === 'hunter' &&
    state.wolfRobotHunterStatusViewed === false
  ) {
    return {
      valid: false,
      result: { success: false, reason: 'wolfrobot_hunter_status_not_viewed', actions: [] },
    };
  }

  return { valid: true, state };
}

/**
 * 验证 SET_AUDIO_PLAYING 前置条件
 *
 * Gate 顺序：
 * 1. host_only
 * 2. no_state
 * 3. invalid_status (must be ongoing or ended)
 *
 * 注：不检查 isAudioPlaying，因为这个 handler 就是用来设置它的
 */
function validateSetAudioPlayingPreconditions(
  context: HandlerContext,
): { valid: false; result: HandlerResult } | { valid: true; state: NonNullState } {
  const { state, isHost } = context;

  // Gate 1: host_only
  if (!isHost) {
    return {
      valid: false,
      result: { success: false, reason: 'host_only', actions: [] },
    };
  }

  // Gate 2: no_state
  if (!state) {
    return {
      valid: false,
      result: { success: false, reason: 'no_state', actions: [] },
    };
  }

  // Gate 3: invalid_status (must be ongoing or ended)
  // 允许 ended 状态是因为天亮音频在 endNight 之后播放
  if (state.status !== GameStatus.Ongoing && state.status !== GameStatus.Ended) {
    return {
      valid: false,
      result: { success: false, reason: 'invalid_status', actions: [] },
    };
  }

  return { valid: true, state };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * 从 state.players 构建 RoleSeatMap（magician swap 感知）
 *
 * 统一身份解析：遍历所有 seat，用 getRoleAfterSwap 获取交换后的有效身份，
 * 再反向查找每个关键角色所在的「有效座位」。
 * 这样 DeathCalculator 中灵骑反弹、毒药免疫等规则自动跟着交换后的身份走。
 * 毒药免疫由 ROLE_SPECS[role].flags.immuneToPoison 驱动，无需逐角色硬编码。
 *
 * Constraint 校验仍使用原始 players map（玩家不知道 swap，操作合法性按已知信息判定）。
 */
function buildRoleSeatMap(state: NonNullState): RoleSeatMap {
  const swappedSeats = state.currentNightResults?.swappedSeats;

  // Build original players map once (seat → roleId)
  const players = new Map<number, RoleId>();
  for (const [seatStr, player] of Object.entries(state.players)) {
    if (player?.role) players.set(Number.parseInt(seatStr, 10), player.role);
  }

  // Build effective role → seat mapping (swap-aware)
  const effectiveRoleSeatMap = new Map<RoleId, number>();
  for (const [seat] of players) {
    const effectiveRole = getRoleAfterSwap(seat, players, swappedSeats);
    if (effectiveRole) {
      effectiveRoleSeatMap.set(effectiveRole, seat);
    }
  }

  // Collect flag-driven seat arrays
  const poisonImmuneSeats: number[] = [];
  const reflectsDamageSeats: number[] = [];
  for (const [roleId, seat] of effectiveRoleSeatMap) {
    const spec: RoleSpec = ROLE_SPECS[roleId];
    if (spec.flags?.immuneToPoison) {
      poisonImmuneSeats.push(seat);
    }
    if (spec.flags?.reflectsDamage) {
      reflectsDamageSeats.push(seat);
    }
  }

  return {
    wolfQueen: effectiveRoleSeatMap.get('wolfQueen') ?? -1,
    dreamcatcher: effectiveRoleSeatMap.get('dreamcatcher') ?? -1,
    seer: effectiveRoleSeatMap.get('seer') ?? -1,
    witch: effectiveRoleSeatMap.get('witch') ?? -1,
    guard: effectiveRoleSeatMap.get('guard') ?? -1,
    poisonImmuneSeats,
    reflectsDamageSeats,
  };
}

/**
 * 从 ProtocolAction 列表中按 schemaId 查找 action
 */
function findActionBySchemaId(
  actions: readonly ProtocolAction[],
  schemaId: SchemaId,
): ProtocolAction | undefined {
  return actions.find((a) => a.schemaId === schemaId);
}

/**
 * 根据 roleId 从 state.players 中找到座位号
 */
function findSeatByRoleId(state: NonNullState, roleId: RoleId): number | null {
  for (const [seatStr, player] of Object.entries(state.players)) {
    if (player?.role === roleId) {
      return Number.parseInt(seatStr, 10);
    }
  }
  return null;
}

/**
 * 创建 UI Hint Action
 *
 * 规则：
 * 1. 如果下一步的行动者被 nightmare 封锁，设置 blocked_by_nightmare hint
 * 2. 如果下一步是 wolfVote 且 wolfKillDisabled，设置 wolf_kill_disabled hint
 * 3. 其他情况清空 hint（null）
 *
 * @param nextStep - 下一步的 NightPlanStep（null 表示夜晚结束）
 * @param state - 当前游戏状态
 */
function maybeCreateUiHintAction(
  nextStep: NightPlanStep | null,
  state: NonNullState,
): SetUiHintAction {
  // 夜晚结束或没有下一步：清空 hint
  if (!nextStep) {
    nightFlowLog.debug('[UI Hint] nextStep is null, clearing hint');
    return { type: 'SET_UI_HINT', payload: { currentActorHint: null } };
  }

  const { stepId, roleId } = nextStep;
  const schema = SCHEMAS[stepId];

  // DEBUG: Log the hint decision inputs
  const nextActorSeat = findSeatByRoleId(state, roleId);
  nightFlowLog.debug('[UI Hint] evaluating', {
    stepId,
    roleId,
    nextActorSeat,
    nightmareBlockedSeat: state.nightmareBlockedSeat,
    wolfKillDisabled: state.wolfKillDisabled,
    schemaKind: schema?.kind,
  });

  // Schema-driven blocked UI: 优先使用 schema.ui 的 per-role 覆盖，否则用默认值
  // 使用类型断言因为 SCHEMAS 使用 as const 推断，字面量类型不含可选的 blocked* 字段
  const schemaUi = schema?.ui as Partial<SchemaUi> | undefined;
  const blockedTitle = schemaUi?.blockedTitle ?? BLOCKED_UI_DEFAULTS.title;
  const blockedMessage = schemaUi?.blockedMessage ?? BLOCKED_UI_DEFAULTS.message;
  const blockedSkipButtonText =
    schemaUi?.blockedSkipButtonText ?? BLOCKED_UI_DEFAULTS.skipButtonText;

  // Case 1: wolfVote 且 wolfKillDisabled → 所有狼人看到 wolf_kill_disabled hint
  if (schema?.kind === 'wolfVote' && state.wolfKillDisabled) {
    // 所有狼人阵营角色都能看到这个 hint
    const wolfRoleIds = getWolfRoleIds();
    nightFlowLog.debug('[UI Hint] setting wolf_kill_disabled hint', { wolfRoleIds });
    return {
      type: 'SET_UI_HINT',
      payload: {
        currentActorHint: {
          kind: 'wolf_kill_disabled',
          targetRoleIds: wolfRoleIds,
          message: blockedMessage,
          bottomAction: 'wolfEmptyOnly',
          promptOverride: {
            title: blockedTitle,
            text: '今晚狼队无法刀人', // Wolf 特殊文案：狼刀被禁用
          },
        },
      },
    };
  }

  // Case 2: 下一步行动者被 nightmare 封锁
  if (nextActorSeat !== null && state.nightmareBlockedSeat === nextActorSeat) {
    nightFlowLog.debug('[UI Hint] setting blocked_by_nightmare hint', { nextActorSeat, roleId });
    return {
      type: 'SET_UI_HINT',
      payload: {
        currentActorHint: {
          kind: 'blocked_by_nightmare',
          targetRoleIds: [roleId], // 只有被封锁的角色能看到
          message: blockedSkipButtonText, // 用于 skip 按钮文案
          bottomAction: 'skipOnly',
          promptOverride: {
            title: blockedTitle,
            text: blockedMessage,
          },
        },
      },
    };
  }

  // Case 3: 正常步骤，清空 hint
  nightFlowLog.debug('[UI Hint] no hint needed, clearing');
  return { type: 'SET_UI_HINT', payload: { currentActorHint: null } };
}

/**
 * 从 currentNightResults 还原 WitchAction
 *
 * wire protocol: witch 的 save/poison 结果已经写入 currentNightResults.savedSeat / poisonedSeat
 * 这里直接从 currentNightResults 读取，不再依赖 ProtocolAction.targetSeat
 */
function extractWitchAction(currentNightResults?: {
  savedSeat?: number;
  poisonedSeat?: number;
}): WitchAction | undefined {
  const savedSeat = currentNightResults?.savedSeat;
  const poisonedSeat = currentNightResults?.poisonedSeat;

  // 优先判断 save（因为 save 和 poison 不会同时有效）
  if (savedSeat !== undefined) {
    return makeWitchSave(savedSeat);
  }

  if (poisonedSeat !== undefined) {
    return makeWitchPoison(poisonedSeat);
  }

  // 没有使用技能
  return makeWitchNone();
}

/**
 * Build NightActions from state for death resolution
 */
function buildNightActions(state: NonNullState): NightActions {
  const actions = state.actions;
  const nightActions: NightActions = {};

  // Wolf kill - resolve final target from wolfVotesBySeat
  // Single source of truth is the votes table; final target is derived.
  if (!state.wolfKillDisabled) {
    if (!state.currentNightResults) {
      throw new Error(
        '[FAIL-FAST] buildNightActions: currentNightResults missing in ongoing state',
      );
    }
    const wolfVotesBySeat = state.currentNightResults.wolfVotesBySeat ?? {};
    const votes = new Map<number, number>();
    for (const [seatStr, targetSeat] of Object.entries(wolfVotesBySeat)) {
      const seat = Number.parseInt(seatStr, 10);
      if (!Number.isFinite(seat) || typeof targetSeat !== 'number') continue;
      votes.set(seat, targetSeat);
    }

    const resolved = resolveWolfVotes(votes);
    if (typeof resolved === 'number') {
      nightActions.wolfKill = resolved;
    }
  }

  // 检查 nightmare 封锁的是否是狼人
  if (state.wolfKillDisabled) {
    nightActions.isWolfBlockedByNightmare = true;
  }

  // Guard protect
  const guardAction = findActionBySchemaId(actions, 'guardProtect');
  if (guardAction?.targetSeat !== undefined) {
    nightActions.guardProtect = guardAction.targetSeat;
  }

  // Witch action - 从 currentNightResults.savedSeat / poisonedSeat 读取
  nightActions.witchAction = extractWitchAction(state.currentNightResults);

  // Wolf Queen charm
  const wolfQueenAction = findActionBySchemaId(actions, 'wolfQueenCharm');
  if (wolfQueenAction?.targetSeat !== undefined) {
    nightActions.wolfQueenCharm = wolfQueenAction.targetSeat;
  }

  // Dreamcatcher dream
  const dreamcatcherAction = findActionBySchemaId(actions, 'dreamcatcherDream');
  if (dreamcatcherAction?.targetSeat !== undefined) {
    nightActions.dreamcatcherDream = dreamcatcherAction.targetSeat;
  }

  // Magician swap - 从 currentNightResults.swappedSeats 获取
  if (state.currentNightResults?.swappedSeats) {
    const [first, second] = state.currentNightResults.swappedSeats;
    nightActions.magicianSwap = { first, second };
  }

  // Seer check (for spirit knight reflection)
  const seerAction = findActionBySchemaId(actions, 'seerCheck');
  if (seerAction?.targetSeat !== undefined) {
    nightActions.seerCheck = seerAction.targetSeat;
  }

  // Nightmare block
  const nightmareAction = findActionBySchemaId(actions, 'nightmareBlock');
  if (nightmareAction?.targetSeat !== undefined) {
    nightActions.nightmareBlock = nightmareAction.targetSeat;
  }

  return nightActions;
}

// =============================================================================
// ADVANCE_NIGHT Handler
// =============================================================================

/**
 * 推进夜晚到下一步
 *
 * Gate:
 * 1. host_only
 * 2. no_state
 * 3. invalid_status
 * 4. forbidden_while_audio_playing
 *
 * 逻辑:
 * - 从当前 currentStepIndex 推进到下一个
 * - 计算下一个 stepId
 * - 返回 ADVANCE_TO_NEXT_ACTION action
 */
export function handleAdvanceNight(
  _intent: AdvanceNightIntent,
  context: HandlerContext,
): HandlerResult {
  const validation = validateNightFlowPreconditions(context);
  if (!validation.valid) {
    return (validation as { valid: false; result: HandlerResult }).result;
  }

  const { state } = validation;
  const currentIndex = state.currentStepIndex;

  // 计算下一个 index
  const nextIndex = currentIndex + 1;

  // ⚠️ 使用 buildNightPlan 过滤后的步骤，而不是全量 NIGHT_STEPS
  // 这样在 2-player 模板（只有 wolf + villager）中，wolfKill 之后不会有其他步骤
  const nightPlan = buildNightPlan(state.templateRoles, state.seerLabelMap);

  // 计算下一个 stepId（若超出范围则为 null，表示夜晚结束）
  const nextStep = nightPlan.steps[nextIndex] ?? null;
  const nextStepId: SchemaId | null = nextStep?.stepId ?? null;

  const advanceAction: AdvanceToNextActionAction = {
    type: 'ADVANCE_TO_NEXT_ACTION',
    payload: {
      nextStepIndex: nextIndex,
      nextStepId,
    },
  };

  // 收集所有需要返回的 actions
  const actions: StateAction[] = [advanceAction];

  // 统一入口：如果即将进入 witchAction，设置 witchContext
  // Guard: nextStepId 必须存在（夜晚结束时为 undefined，不应设置 witchContext）
  const witchContextAction = nextStepId ? maybeCreateWitchContextAction(nextStepId, state) : null;
  if (witchContextAction) {
    actions.push(witchContextAction);
  }

  // 统一入口：如果即将进入 hunterConfirm / darkWolfKingConfirm，设置 confirmStatus
  const confirmStatusAction = nextStepId ? maybeCreateConfirmStatusAction(nextStepId, state) : null;
  if (confirmStatusAction) {
    actions.push(confirmStatusAction);
  }

  // ==========================================================================
  // UI Hint：Host 广播驱动，UI 只读展示
  // ==========================================================================
  // 在推进到下一步时，检查是否需要设置 UI hint。
  // - 如果下一步的行动者被 nightmare 封锁，设置 blocked_by_nightmare hint
  // - 如果下一步是 wolfVote 且 wolfKillDisabled，设置 wolf_kill_disabled hint
  // - 其他情况清空 hint（null）
  const uiHintAction = maybeCreateUiHintAction(nextStep, state);
  actions.push(uiHintAction);

  // 音频播放：当前步骤的结束音频 + 下一步的开始音频
  // 按顺序添加到 sideEffects，Facade 会按顺序播放
  const currentStepId = state.currentStepId;
  const sideEffects: HandlerResult['sideEffects'] = [
    { type: 'BROADCAST_STATE' },
    { type: 'SAVE_STATE' },
  ];

  // 1) 当前步骤的结束音频
  if (currentStepId) {
    const currentStep = getStepSpec(currentStepId);
    if (currentStep) {
      const audioEndKey = currentStep.audioEndKey ?? currentStep.audioKey;
      sideEffects.push({
        type: 'PLAY_AUDIO',
        audioKey: resolveSeerAudioKey(audioEndKey, state.seerLabelMap),
        isEndAudio: true, // 标记这是结束音频，走 audio_end 目录
      });
    }
  }

  // 2) 下一步的开始音频（如果有下一步）
  if (nextStepId) {
    const nextStepSpec = getStepSpec(nextStepId);
    if (nextStepSpec) {
      sideEffects.push({
        type: 'PLAY_AUDIO',
        audioKey: resolveSeerAudioKey(nextStepSpec.audioKey, state.seerLabelMap),
        isEndAudio: false, // 开始音频，走正常目录
      });
    }
  }

  return {
    success: true,
    actions,
    sideEffects,
  };
}

// =============================================================================
// END_NIGHT Handler
// =============================================================================

/**
 * 结束夜晚，进行死亡结算
 *
 * Gate:
 * 1. host_only
 * 2. no_state
 * 3. invalid_status
 * 4. forbidden_while_audio_playing
 * 5. night_not_complete (currentStepId must be undefined - all steps must be finished)
 *
 * 逻辑:
 * - 从 wolfVotes 调用 resolveWolfVotes 得到 wolfKill
 * - 从 actions 构建 NightActions
 * - 调用 calculateDeaths 计算死亡
 * - 返回 END_NIGHT action
 */
export function handleEndNight(_intent: EndNightIntent, context: HandlerContext): HandlerResult {
  const validation = validateNightFlowPreconditions(context);
  if (!validation.valid) {
    return (validation as { valid: false; result: HandlerResult }).result;
  }

  const { state } = validation;

  // Gate 5 (END_NIGHT specific): night_not_complete
  // currentStepId 必须为 undefined，表示所有步骤已完成（advanceNight 将 nextStepId 设为 null 后）
  // 中途调用 endNight 是严重的架构违规，必须 fail-fast
  if (state.currentStepId !== undefined) {
    nightFlowLog.error('handleEndNight: night_not_complete - currentStepId is still set', {
      currentStepId: state.currentStepId,
    });
    return {
      success: false,
      reason: 'night_not_complete',
      actions: [],
    };
  }

  // 构建 NightActions
  const nightActions = buildNightActions(state);

  // 构建 RoleSeatMap
  const roleSeatMap = buildRoleSeatMap(state);

  // DEBUG: 打印死亡计算输入
  nightFlowLog.debug('handleEndNight: calculating deaths', {
    wolfVotes: state.currentNightResults?.wolfVotesBySeat,
    wolfKillDisabled: state.wolfKillDisabled,
    nightActions,
    roleSeatMap,
  });

  // 调用 DeathCalculator（复用，不重写）
  const deaths = calculateDeaths(nightActions, roleSeatMap);

  // DEBUG: 打印死亡计算结果
  nightFlowLog.debug('handleEndNight: deaths calculated', { deaths });

  const endNightAction: EndNightAction = {
    type: 'END_NIGHT',
    payload: { deaths },
  };

  return {
    success: true,
    actions: [endNightAction],
    sideEffects: [
      { type: 'BROADCAST_STATE' },
      { type: 'SAVE_STATE' },
      // P0-1: 返回夜晚结束音频播放副作用
      { type: 'PLAY_AUDIO', audioKey: 'night_end' },
    ],
  };
}

// =============================================================================
// SET_AUDIO_PLAYING Handler
// =============================================================================

/**
 * 设置音频播放状态
 *
 * 音频时序控制
 *
 * Gate:
 * 1. host_only
 * 2. no_state
 * 3. invalid_status (must be ongoing or ended)
 *
 * 逻辑:
 * - 设置 isAudioPlaying = payload.isPlaying
 * - broadcast 状态
 */
export function handleSetAudioPlaying(
  intent: SetAudioPlayingIntent,
  context: HandlerContext,
): HandlerResult {
  const validation = validateSetAudioPlayingPreconditions(context);
  if (!validation.valid) {
    return (validation as { valid: false; result: HandlerResult }).result;
  }

  const setAudioAction: SetAudioPlayingAction = {
    type: 'SET_AUDIO_PLAYING',
    payload: { isPlaying: intent.payload.isPlaying },
  };

  return {
    success: true,
    actions: [setAudioAction],
    sideEffects: [{ type: 'BROADCAST_STATE' }],
  };
}
