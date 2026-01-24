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

import type { AdvanceNightIntent, EndNightIntent, SetAudioPlayingIntent } from '../../v2/intents/types';
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
import { getStepSpec } from '../../../models/roles/spec/nightSteps';
import { getRoleSpec } from '../../../models/roles';
import { calculateDeaths } from '../../DeathCalculator';
import { isWolfRole } from '../../../models/roles';
import { makeWitchSave, makeWitchPoison, makeWitchNone } from '../../../models/actions/WitchAction';
import { nightFlowLog } from '../../../utils/logger';
import { resolveWolfVotes } from '../../resolveWolfVotes';

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
      let killedIndex = -1;

      // Resolve from wolfVotesBySeat (legacy-compatible)
      if (!state.wolfKillDisabled) {
        const wolfVotesBySeat = state.currentNightResults?.wolfVotesBySeat ?? {};
        const votes = new Map<number, number>();
        for (const [seatStr, targetSeat] of Object.entries(wolfVotesBySeat)) {
          const seat = Number.parseInt(seatStr, 10);
          if (!Number.isFinite(seat) || typeof targetSeat !== 'number') continue;
          votes.set(seat, targetSeat);
        }
        const resolved = resolveWolfVotes(votes);
        if (typeof resolved === 'number') {
          killedIndex = resolved;
        }
      }

    // 查找女巫座位，用于 notSelf 约束
    let witchSeat = -1;
    for (const [seatStr, player] of Object.entries(state.players)) {
      if (player?.role === 'witch') {
        witchSeat = Number.parseInt(seatStr, 10);
        break;
      }
    }

    // Schema-first: witchAction.steps[0] (save) 有 notSelf 约束
    // canSave 必须为 false 当：(1) 没有被杀者 或 (2) 被杀者是女巫自己
    const canSave = killedIndex >= 0 && killedIndex !== witchSeat;

    const setWitchContextAction: SetWitchContextAction = {
      type: 'SET_WITCH_CONTEXT',
      payload: {
        killedIndex,
        canSave,
        canPoison: true, // Night-1 总是可以毒
      },
    };

    actions.push(setWitchContextAction);
  }


  // Case 2: 推进到 witchAction，但 witchContext 未设置（无狼板子）
  // 当模板没有狼人时，buildNightPlan() 跳过 wolfKill 步骤，导致 Case 1 不触发
  // 此时需要在进入 witchAction 前设置 witchContext
  if (
    nextStepId === 'witchAction' &&
    hasWitch &&
    !state.witchContext &&
    currentStepId !== 'wolfKill' // Case 1 已经处理了从 wolfKill 推进的情况
  ) {
    actions.push({
      type: 'SET_WITCH_CONTEXT',
      payload: {
        killedIndex: -1, // 无狼杀，无人死亡
        canSave: false, // 没有人需要救
        canPoison: true, // Night-1 毒药可用
      },
    });
  }
  // 音频播放：当前步骤的结束音频 + 下一步的开始音频
  // 按顺序添加到 sideEffects，Facade 会按顺序播放
  const sideEffects: HandlerResult['sideEffects'] = [{ type: 'BROADCAST_STATE' }];

  // 1) 当前步骤的结束音频
  if (currentStepId) {
    const currentStep = getStepSpec(currentStepId);
    if (currentStep) {
      const audioEndKey = currentStep.audioEndKey ?? currentStep.audioKey;
      sideEffects.push({
        type: 'PLAY_AUDIO',
        audioKey: audioEndKey,
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
        audioKey: nextStepSpec.audioKey,
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
 * 从 currentNightResults 还原 WitchAction
 *
 * v2 wire protocol: witch 的 save/poison 结果已经写入 currentNightResults.savedSeat / poisonedSeat
 * 这里直接从 currentNightResults 读取，不再依赖 ProtocolAction.targetSeat
 */
function extractWitchAction(
  currentNightResults?: { savedSeat?: number; poisonedSeat?: number },
): WitchAction | undefined {
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
 * 从 v2 state 构建 NightActions（对齐 legacy buildNightActions）
 */
function buildNightActions(state: NonNullState): NightActions {
  const actions = state.actions ?? [];
  const nightActions: NightActions = {};

  // Wolf kill - legacy-compatible: resolve final target from wolfVotesBySeat.
  // Single source of truth is the votes table; final target is derived.
  if (!state.wolfKillDisabled) {
    const wolfVotesBySeat = state.currentNightResults?.wolfVotesBySeat ?? {};
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
    nightActions.nightmareBlockedWolf = true;
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
      // P0-1: 返回夜晚结束音频播放副作用
      { type: 'PLAY_AUDIO', audioKey: 'night_end' },
    ],
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

  // Gate 3: invalid_status (must be ongoing or ended)
  // 允许 ended 状态是因为天亮音频在 endNight 之后播放
  if (state.status !== 'ongoing' && state.status !== 'ended') {
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

// =============================================================================
// Night Progression Evaluator (PR-refactor: 幂等推进决策)
// =============================================================================

/**
 * 夜晚推进决策结果
 */
export type NightProgressionDecision =
  | { action: 'none'; reason: string }
  | { action: 'advance'; reason: string }
  | { action: 'end_night'; reason: string };

/**
 * 幂等推进状态追踪器
 *
 * 用于防止重复推进：同一 {revision, currentStepId} 组合最多推进一次。
 */
export interface ProgressionTracker {
  lastProcessedKey: string | null;
}

/**
 * 创建推进追踪器
 */
export function createProgressionTracker(): ProgressionTracker {
  return { lastProcessedKey: null };
}

/**
 * 基于 state 事实生成幂等 key
 *
 * 使用 {revision, currentStepId} 组合确保同一游戏状态最多推进一次。
 * revision 由 GameStore 管理，每次 setState 自动递增。
 *
 * @param revision - 来自 GameStore.getRevision()
 * @param currentStepId - state.currentStepId
 */
export function buildProgressionKey(revision: number, currentStepId: string | undefined): string {
  return `${revision}:${currentStepId ?? 'null'}`;
}

/**
 * 检查当前步骤的所有必要行动是否已完成
 *
 * 判断逻辑：
 * - wolfKill: 检查所有参与投票的狼人是否都已投票
 * - 其他步骤: 检查对应角色是否已提交行动
 */
function isCurrentStepComplete(state: NonNullState): boolean {
  const currentStepId = state.currentStepId;

  if (!currentStepId) {
    // 没有当前步骤，视为"完成"（应该进入 endNight）
    return true;
  }

  if (currentStepId === 'wolfKill') {
    const wolfVotes = state.currentNightResults?.wolfVotesBySeat ?? {};

    const participatingWolfSeats: number[] = [];
    for (const [seatStr, player] of Object.entries(state.players)) {
      const seat = Number.parseInt(seatStr, 10);
      if (!Number.isFinite(seat) || !player?.role) continue;

    const spec = getRoleSpec(player.role) as unknown as { wolfMeeting?: { participatesInWolfVote?: boolean } } | undefined;
    if (spec?.wolfMeeting?.participatesInWolfVote) {
        participatingWolfSeats.push(seat);
      }
    }

    // Completion contract:
    // - A wolf is considered "done" only if they made a valid choice:
    //   - target seat number (>= 0)
    //   - empty knife (-1)
    // - Forbidden target attempts (-2) do NOT count; player must re-vote.
    return participatingWolfSeats.every((seat) => {
      const v = wolfVotes[String(seat)];
      return typeof v === 'number' && (v >= 0 || v === -1);
    });
  }

  // 其他步骤：检查是否已有对应 schemaId 的 action
  const actions = state.actions ?? [];
  return actions.some((a) => a.schemaId === currentStepId);
}

/**
 * 评估夜晚推进决策（Host-only, 幂等）
 *
 * 基于 BroadcastGameState 事实判断：
 * 1. 如果 status !== 'ongoing'，返回 none
 * 2. 如果 isAudioPlaying === true，返回 none
 * 3. 如果 currentStepId === undefined 且 status === 'ongoing'，返回 end_night
 * 4. 如果当前步骤的行动已完成，返回 advance
 * 5. 否则返回 none
 *
 * 幂等保护：
 * - 同一 {revision, currentStepId} 最多推进一次
 * - 重复调用返回 none + debug log
 *
 * @param state - 当前 BroadcastGameState
 * @param revision - 来自 GameStore.getRevision()
 * @param tracker - 幂等追踪器（可选，用于防止重复推进）
 * @param isHost - 是否为 Host
 */
export function evaluateNightProgression(
  state: NonNullState | null,
  revision: number,
  tracker?: ProgressionTracker,
  isHost?: boolean,
): NightProgressionDecision {
  // Gate: host_only
  if (isHost === false) {
    return { action: 'none', reason: 'not_host' };
  }

  // Gate: no_state
  if (!state) {
    return { action: 'none', reason: 'no_state' };
  }

  // Gate: status !== 'ongoing'
  if (state.status !== 'ongoing') {
    return { action: 'none', reason: 'not_ongoing' };
  }

  // Gate: audio playing
  if (state.isAudioPlaying) {
    return { action: 'none', reason: 'audio_playing' };
  }

  // Gate: pending reveal acks - 等待用户确认查验结果后再推进
  if (state.pendingRevealAcks && state.pendingRevealAcks.length > 0) {
    return { action: 'none', reason: 'pending_reveal_acks' };
  }

  // 幂等检查
  if (tracker) {
    const key = buildProgressionKey(revision, state.currentStepId);
    if (tracker.lastProcessedKey === key) {
      return { action: 'none', reason: 'already_processed' };
    }
  }

  // 判断是否需要 endNight
  if (state.currentStepId === undefined) {
    // 没有下一步了，应该结束夜晚
    if (tracker) {
      tracker.lastProcessedKey = buildProgressionKey(revision, state.currentStepId);
    }
    return { action: 'end_night', reason: 'no_more_steps' };
  }

  // 判断当前步骤是否完成
  if (isCurrentStepComplete(state)) {
    if (tracker) {
      tracker.lastProcessedKey = buildProgressionKey(revision, state.currentStepId);
    }
    return { action: 'advance', reason: 'step_complete' };
  }

  return { action: 'none', reason: 'step_not_complete' };
}

// =============================================================================
// 夜晚推进控制器（Host-only, 幂等）
// =============================================================================

/**
 * 模块级推进追踪器（单例）
 *
 * 使用 {revision, currentStepId} 作为幂等 key，
 * 确保同一游戏状态最多推进一次。
 */
let progressionTracker: ProgressionTracker = createProgressionTracker();

/**
 * 重置推进追踪器
 *
 * 必须在游戏开始/重启时调用，清除幂等状态。
 * 调用位置：restartGame / startNight
 */
export function resetProgressionTracker(): void {
  progressionTracker = createProgressionTracker();
  nightFlowLog.debug('progressionTracker reset');
}

/**
 * 夜晚推进回调接口
 *
 * 用于 handleNightProgression 执行推进时调用 facade 层的方法
 */
export interface NightProgressionCallbacks {
  /** 获取当前 revision */
  getRevision: () => number;
  /** 获取当前 state */
  getState: () => NonNullState | null;
  /** 是否为 Host */
  isHost: boolean;
  /** 执行 advanceNight */
  advanceNight: () => Promise<{ success: boolean; reason?: string }>;
  /** 执行 endNight */
  endNight: () => Promise<{ success: boolean; reason?: string }>;
}

/**
 * 夜晚推进结果
 */
export interface NightProgressionResult {
  advanced: boolean;
  decision: 'advance' | 'end_night' | 'none';
  reason?: string;
}

/**
 * Host-only: 幂等评估并执行夜晚推进
 *
 * 这是 Host-only 的夜晚推进决策中心。
 *
 * 幂等保护：
 * - 使用 {revision, currentStepId} 作为幂等 key
 * - 同一游戏状态最多推进一次
 * - 重复调用安全（返回 advanced=false, reason='already_processed'）
 *
 * 调用时机：
 * - submitAction 成功后
 * - submitWolfVote 成功后
 * - setAudioPlaying(false) 后
 *
 * @param callbacks - 回调接口，由 facade 层提供
 * @returns 推进结果
 */
export async function handleNightProgression(
  callbacks: NightProgressionCallbacks,
): Promise<NightProgressionResult> {
  const state = callbacks.getState();
  const revision = callbacks.getRevision();

  // 评估推进决策
  const decision = evaluateNightProgression(state, revision, progressionTracker, callbacks.isHost);

  nightFlowLog.debug('handleNightProgression evaluated', {
    action: decision.action,
    reason: decision.reason,
    currentStepId: state?.currentStepId,
    revision,
    idempotentKey: buildProgressionKey(revision, state?.currentStepId),
  });

  if (decision.action === 'none') {
    return { advanced: false, decision: 'none', reason: decision.reason };
  }

  if (decision.action === 'advance') {
    const result = await callbacks.advanceNight();
    if (!result.success) {
      nightFlowLog.warn('handleNightProgression: advanceNight failed', { reason: result.reason });
      return { advanced: false, decision: 'advance', reason: result.reason };
    }

    // 推进成功后，递归检查是否需要继续推进（如 endNight）
    // 注意：此时 revision 已经变化，幂等 key 不同，不会死循环
    return handleNightProgression(callbacks);
  }

  if (decision.action === 'end_night') {
    const result = await callbacks.endNight();
    if (!result.success) {
      nightFlowLog.warn('handleNightProgression: endNight failed', { reason: result.reason });
      return { advanced: false, decision: 'end_night', reason: result.reason };
    }
    return { advanced: true, decision: 'end_night' };
  }

  // 不应该到达这里
  return { advanced: false, decision: 'none', reason: 'unknown_decision' };
}
