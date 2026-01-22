/**
 * Night Flow Handler - 夜晚流程处理器
 *
 * PR6: ADVANCE_NIGHT / END_NIGHT (Night-1 only)
 *
 * 处理夜晚推进和结算:
 * - ADVANCE_NIGHT: 音频结束后，推进到下一步
 * - END_NIGHT: 夜晚结束音频结束后，进行死亡结算
 *
 * 职责:
 * - Gate validation (host_only / no_state / invalid_status / forbidden_while_audio_playing)
 * - 调用 resolveWolfVotes (复用，不重写)
 * - 调用 calculateDeaths (复用，不重写)
 * - 返回 StateAction 列表
 */

import type { AdvanceNightIntent, EndNightIntent, SetAudioPlayingIntent } from '../intents/types';
import type { HandlerContext, HandlerResult } from './types';
import type {
  AdvanceToNextActionAction,
  EndNightAction,
  SetAudioPlayingAction,
  SetWitchContextAction,
} from '../reducer/types';
import type { SchemaId } from '../../../models/roles/spec';
import type { RoleId } from '../../../models/roles';
import type { NightActions, RoleSeatMap } from '../../DeathCalculator';
import type { WitchAction } from '../../../models/actions/WitchAction';
import type { ProtocolAction } from '../../protocol/types';

import { buildNightPlan } from '../../../models/roles/spec/plan';
import { resolveWolfVotes } from '../../WolfVoteResolver';
import { calculateDeaths } from '../../DeathCalculator';
import { isWolfRole } from '../../../models/roles';
import { makeWitchSave, makeWitchPoison, makeWitchNone } from '../../../models/actions/WitchAction';

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
  if (state.status !== 'ongoing') {
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

  return { valid: true, state };
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
 * - 从当前 currentActionerIndex 推进到下一个
 * - 计算下一个 stepId
 * - 返回 ADVANCE_TO_NEXT_ACTION action
 */
export function handleAdvanceNight(
  _intent: AdvanceNightIntent,
  context: HandlerContext,
): HandlerResult {
  const validation = validateNightFlowPreconditions(context);
  if (!validation.valid) {
    return validation.result;
  }

  const { state } = validation;
  const currentIndex = state.currentActionerIndex;

  // 计算下一个 index
  const nextIndex = currentIndex + 1;

  // ⚠️ 使用 buildNightPlan 过滤后的步骤，而不是全量 NIGHT_STEPS
  // 这样在 2-player 模板（只有 wolf + villager）中，wolfKill 之后不会有其他步骤
  const nightPlan = buildNightPlan(state.templateRoles);

  // 计算下一个 stepId（若超出范围则为 null，表示夜晚结束）
  const nextStep = nightPlan.steps[nextIndex] ?? null;
  const nextStepId: SchemaId | null = nextStep?.stepId ?? null;

  const advanceAction: AdvanceToNextActionAction = {
    type: 'ADVANCE_TO_NEXT_ACTION',
    payload: {
      nextActionerIndex: nextIndex,
      nextStepId,
    },
  };

  // 收集所有需要返回的 actions
  const actions: (AdvanceToNextActionAction | SetWitchContextAction)[] = [advanceAction];

  // 当从 wolfKill 步骤推进出去时，如果模板包含女巫，需要设置 witchContext
  // （女巫需要知道狼刀的结果，不管女巫在夜晚序列的哪个位置）
  const currentStepId = state.currentStepId;
  const hasWitch = state.templateRoles.includes('witch');

  if (currentStepId === 'wolfKill' && hasWitch) {
    // 计算狼刀目标（killedIndex）
    const wolfVotes = state.wolfVotes ?? {};
    const voteMap = new Map<number, number>();
    for (const [voterSeatStr, targetSeat] of Object.entries(wolfVotes)) {
      voteMap.set(Number.parseInt(voterSeatStr, 10), targetSeat);
    }

    // 如果 wolfKillDisabled（nightmare 封锁狼人），则没有被杀者
    let killedIndex = -1;
    if (!state.wolfKillDisabled) {
      const wolfKillTarget = resolveWolfVotes(voteMap);
      killedIndex = wolfKillTarget ?? -1;
    }

    const setWitchContextAction: SetWitchContextAction = {
      type: 'SET_WITCH_CONTEXT',
      payload: {
        killedIndex,
        canSave: killedIndex >= 0, // 只有有被杀者时才能救
        canPoison: true, // Night-1 总是可以毒
      },
    };

    actions.push(setWitchContextAction);
  }

  return {
    success: true,
    actions,
    sideEffects: [{ type: 'BROADCAST_STATE' }],
  };
}

// =============================================================================
// END_NIGHT Handler
// =============================================================================

/**
 * 从 state.players 构建 RoleSeatMap
 */
function buildRoleSeatMap(state: NonNullState): RoleSeatMap {
  const findSeatByRole = (role: RoleId): number => {
    for (const [seatStr, player] of Object.entries(state.players)) {
      if (player?.role === role) {
        return Number.parseInt(seatStr, 10);
      }
    }
    return -1;
  };

  return {
    witcher: findSeatByRole('witcher'),
    wolfQueen: findSeatByRole('wolfQueen'),
    dreamcatcher: findSeatByRole('dreamcatcher'),
    spiritKnight: findSeatByRole('spiritKnight'),
    seer: findSeatByRole('seer'),
    witch: findSeatByRole('witch'),
    guard: findSeatByRole('guard'),
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
 * 从 state.actions 还原 WitchAction
 * witchAction 是 compound schema，v2 存储为 targetSeat（save 或 poison）
 * 需要根据 witchContext 判断是 save 还是 poison
 */
function extractWitchAction(
  actions: readonly ProtocolAction[],
  witchContext?: { killedIndex: number; canSave: boolean; canPoison: boolean },
): WitchAction | undefined {
  const witchAction = findActionBySchemaId(actions, 'witchAction');
  if (!witchAction) {
    return undefined;
  }

  // 如果有 target，需要判断是 save 还是 poison
  if (witchAction.targetSeat !== undefined) {
    // 如果 target 等于被杀者且 canSave 为 true，则是 save
    if (
      witchContext &&
      witchAction.targetSeat === witchContext.killedIndex &&
      witchContext.canSave
    ) {
      return makeWitchSave(witchAction.targetSeat);
    }
    // 否则是 poison
    return makeWitchPoison(witchAction.targetSeat);
  }

  // 没有 target 表示没有使用技能
  return makeWitchNone();
}

/**
 * 从 v2 state 构建 NightActions（对齐 legacy buildNightActions）
 */
function buildNightActions(state: NonNullState): NightActions {
  const actions = state.actions ?? [];
  const nightActions: NightActions = {};

  // Wolf kill - 从 wolfVotes 解析
  const wolfVotes = state.wolfVotes ?? {};
  const voteMap = new Map<number, number>();
  for (const [voterSeatStr, targetSeat] of Object.entries(wolfVotes)) {
    voteMap.set(Number.parseInt(voterSeatStr, 10), targetSeat);
  }

  // 如果 wolfKillDisabled (nightmare 封锁狼人)，wolf kill 无效
  if (!state.wolfKillDisabled) {
    const wolfKillTarget = resolveWolfVotes(voteMap);
    if (wolfKillTarget !== null) {
      nightActions.wolfKill = wolfKillTarget;
    }
  }
  // 检查 nightmare 封锁的是否是狼人
  if (state.wolfKillDisabled) {
    nightActions.nightmareBlockedWolf = true;
  }

  // Guard protect
  const guardAction = findActionBySchemaId(actions, 'guardProtect');
  if (guardAction?.targetSeat !== undefined) {
    nightActions.guardProtect = guardAction.targetSeat;
  }

  // Witch action
  nightActions.witchAction = extractWitchAction(actions, state.witchContext);

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

    // 检查被封锁的是否是狼人
    const blockedSeat = nightmareAction.targetSeat;
    const blockedPlayer = state.players[blockedSeat];
    if (blockedPlayer?.role && isWolfRole(blockedPlayer.role)) {
      nightActions.nightmareBlockedWolf = true;
    }
  }

  return nightActions;
}

/**
 * 结束夜晚，进行死亡结算
 *
 * Gate:
 * 1. host_only
 * 2. no_state
 * 3. invalid_status
 * 4. forbidden_while_audio_playing
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
    return validation.result;
  }

  const { state } = validation;

  // 构建 NightActions
  const nightActions = buildNightActions(state);

  // 构建 RoleSeatMap
  const roleSeatMap = buildRoleSeatMap(state);

  // 调用 DeathCalculator（复用，不重写）
  const deaths = calculateDeaths(nightActions, roleSeatMap);

  const endNightAction: EndNightAction = {
    type: 'END_NIGHT',
    payload: { deaths },
  };

  return {
    success: true,
    actions: [endNightAction],
    sideEffects: [{ type: 'BROADCAST_STATE' }],
  };
}

// =============================================================================
// SET_AUDIO_PLAYING Handler (PR7)
// =============================================================================

/**
 * 验证 SET_AUDIO_PLAYING 前置条件
 *
 * Gate 顺序：
 * 1. host_only
 * 2. no_state
 * 3. invalid_status (must be ongoing)
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

  // Gate 3: invalid_status (must be ongoing)
  if (state.status !== 'ongoing') {
    return {
      valid: false,
      result: { success: false, reason: 'invalid_status', actions: [] },
    };
  }

  return { valid: true, state };
}

/**
 * 设置音频播放状态
 *
 * PR7: 音频时序控制
 *
 * Gate:
 * 1. host_only
 * 2. no_state
 * 3. invalid_status (must be ongoing)
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
    return validation.result;
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
