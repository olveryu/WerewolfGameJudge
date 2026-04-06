/**
 * Step Transition Handler - 夜晚步骤切换与结算处理器（Host-only）
 *
 * 职责：
 * - ADVANCE_NIGHT：音频结束后推进到下一步
 * - END_NIGHT：夜晚结束后进行死亡结算
 * - SET_AUDIO_PLAYING：设置音频播放 Gate 状态
 *
 * 返回 StateAction 列表与 SideEffect（PLAY_AUDIO），不包含 IO（网络 / 音频播放 / Alert，
 * 音频 IO 由 Facade 执行），不直接修改 state（返回 StateAction 列表由 reducer 执行），
 * 不手动推进 index（`++` 兜底策略禁止）。
 *
 * Gate validation → stepTransitionGuards.ts
 * Death resolution helpers → deathResolution.ts
 * UI hint calculation → uiHint.ts
 */

import { type SchemaId } from '../../models';
import { buildNightPlan, getStepSpec } from '../../models/roles/spec';
import { Team } from '../../models/roles/spec/types';
import { resolveSeerAudioKey } from '../../utils/audioKeyOverride';
import { getEngineLogger } from '../../utils/logger';
import { calculateDeathsDetailed } from '../DeathCalculator';
import type { AdvanceNightIntent, EndNightIntent, SetAudioPlayingIntent } from '../intents/types';
import type {
  AdvanceToNextActionAction,
  EndNightAction,
  SetAudioPlayingAction,
  StateAction,
} from '../reducer/types';
import { maybeCreateConfirmStatusAction } from './confirmContext';
import {
  buildCheckedSeats,
  buildEffectiveRoleSeatMap,
  buildNightActions,
  buildReflectionSources,
  buildRoleSeatMap,
} from './deathResolution';
import {
  validateNightFlowPreconditions,
  validateSetAudioPlayingPreconditions,
} from './stepTransitionGuards';
import type { HandlerContext, HandlerResult, SideEffect } from './types';
import { maybeCreateUiHintAction } from './uiHint';
import { maybeCreateWitchContextAction } from './witchContext';

const nightFlowLog = getEngineLogger().extend('NightFlow');

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
  // - 如果下一步是 wolfVote 且 wolfKillOverride 存在，设置 wolf_kill_disabled hint
  // - 其他情况清空 hint（null）
  const uiHintAction = maybeCreateUiHintAction(nextStep, state);
  actions.push(uiHintAction);

  // 音频播放：当前步骤的结束音频 + 下一步的开始音频
  // 按顺序添加到 sideEffects，Facade 会按顺序播放
  const currentStepId = state.currentStepId;
  const sideEffects: SideEffect[] = [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }];

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

  // 构建 effective role → seat mapping（共享给 buildRoleSeatMap + buildReflectionSources）
  const effectiveMap = buildEffectiveRoleSeatMap(state);

  // 构建反伤来源（从 spec.deathCalcRole + ProtocolAction 扫描）
  const reflectionSources = buildReflectionSources(effectiveMap, state.actions, nightActions);

  // 构建本夜被查验的目标座位（用于查验致死判定）
  const checkedSeats = buildCheckedSeats(effectiveMap, state.actions, nightActions);

  // 构建 RoleSeatMap（deathCalcRole 驱动）
  const isBonded = state.currentNightResults?.avengerFaction === Team.Third;
  const coupleLinkSeats = state.loverSeats ?? null;
  const roleSeatMap = buildRoleSeatMap(
    effectiveMap,
    reflectionSources,
    isBonded,
    coupleLinkSeats,
    checkedSeats,
  );

  // DEBUG: 打印死亡计算输入
  nightFlowLog.debug('handleEndNight: calculating deaths', {
    wolfVotes: state.currentNightResults?.wolfVotesBySeat,
    wolfKillOverride: !!state.wolfKillOverride,
    nightActions,
    roleSeatMap,
  });

  // 调用 DeathCalculator（复用，不重写）
  const { deaths, deathReasons } = calculateDeathsDetailed(nightActions, roleSeatMap);

  // DEBUG: 打印死亡计算结果
  nightFlowLog.debug('handleEndNight: deaths calculated', { deaths, deathReasons });

  const endNightAction: EndNightAction = {
    type: 'END_NIGHT',
    payload: { deaths, deathReasons },
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
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}
