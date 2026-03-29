/**
 * Inline Progression — 服务端内联推进（纯函数）
 *
 * 职责：
 * - 在 action 处理完成后，同一请求内评估并执行夜晚推进（advance / endNight）
 * - 收集推进过程中产生的 PLAY_AUDIO sideEffects → AudioEffect[]
 * - 所有 StateAction 按序累积，由外层统一 reduce
 *
 * 设计：
 * - 纯函数，不做 IO（DB / 网络 / 音频）
 * - 使用 evaluateNightProgression（服务端始终有权限）
 * - 递归推进直到 decision=none（与客户端 handleNightProgression 等价）
 * - 最多 MAX_PROGRESSION_LOOPS 次防止无限循环
 *
 * 可读取 state、调用 handler 纯函数并返回 actions/effects，
 * 不包含 IO、副作用或时间依赖（Date.now 由调用方传入）。
 */

import { GameStatus, type SchemaId, SCHEMAS } from '../models';
import { getStepSpec } from '../models/roles/spec/nightSteps';
import type { AudioEffect, GameState } from '../protocol/types';
import { getEngineLogger } from '../utils/logger';
import { randomIntInclusive } from '../utils/random';
import { isWolfVoteAllComplete } from './handlers/progressionEvaluator';
import { handleAdvanceNight, handleEndNight } from './handlers/stepTransitionHandler';
import type { HandlerContext, SideEffect } from './handlers/types';
import { gameReducer } from './reducer/gameReducer';
import type { StateAction } from './reducer/types';

const log = getEngineLogger().extend('InlineProgression');

/** 底牌空步骤随机延迟范围（ms） */
export const AUTO_SKIP_DELAY_MIN_MS = 5000;
export const AUTO_SKIP_DELAY_MAX_MS = 10000;

/** 最大推进循环次数（防止无限循环） */
const MAX_PROGRESSION_LOOPS = 20;

/**
 * Inline progression 结果
 */
interface InlineProgressionResult {
  /** 推进过程中累积的所有 StateAction（不含触发 action 本身） */
  actions: StateAction[];
  /** 推进过程中收集的待播放音频 */
  audioEffects: AudioEffect[];
  /** 最终 state（已 apply 所有 actions） */
  finalState: GameState;
  /** 推进步数（0 = 未推进） */
  stepsAdvanced: number;
}

/**
 * 检查当前步骤是否完成（与 progressionEvaluator.isCurrentStepComplete 等价）
 *
 * 内联在此处避免导出 private 函数。
 */
function isStepComplete(state: GameState): boolean {
  const stepId = state.currentStepId;
  if (!stepId) return true; // 没有当前步骤 → 完成（进入 endNight）

  if (stepId === 'wolfKill') {
    return isWolfVoteAllComplete(state);
  }

  // groupConfirm steps: complete when all seated players have acked.
  const schema = SCHEMAS[stepId as SchemaId];
  if (schema?.kind === 'groupConfirm') {
    const acks =
      stepId === 'awakenedGargoyleConvertReveal'
        ? (state.conversionRevealAcks ?? [])
        : (state.piperRevealAcks ?? []);
    // All seated (non-null) players must ack
    const seatedCount = Object.values(state.players).filter((p) => p !== null).length;
    return acks.length >= seatedCount;
  }

  const actions = state.actions;
  return actions.some((a) => a.schemaId === stepId);
}

/**
 * Check if the current step belongs to an unchosen bottom card role.
 *
 * When treasureMaster picks a card, the unchosen bottom card roles' steps
 * have no player operating them → auto-advance immediately after audio.
 */
function isUnchosenBottomCardStep(state: GameState): boolean {
  const { currentStepId, bottomCardStepRoles, treasureMasterChosenCard } = state;
  if (!currentStepId || !bottomCardStepRoles || !treasureMasterChosenCard) return false;

  const step = getStepSpec(currentStepId);
  if (!step) return false;

  // Not a bottom card role → not applicable
  if (!bottomCardStepRoles.includes(step.roleId)) return false;

  // This IS the chosen card's step → treasureMaster will act, don't skip
  if (step.roleId === treasureMasterChosenCard) return false;

  // Role also exists as a player (e.g. wolf in bottom + wolf players) → don't skip
  const hasPlayerWithRole = Object.values(state.players).some((p) => p?.role === step.roleId);
  if (hasPlayerWithRole) return false;

  return true;
}

/**
 * 服务端内联评估推进决策
 *
 * 与 evaluateNightProgression 等价，但：
 * - 不使用 ProgressionTracker（服务端无状态）
 * - 接受 nowMs 用于 stepDeadline 检查
 */
function evaluateProgression(state: GameState, nowMs: number): 'advance' | 'end_night' | 'none' {
  if (state.status !== GameStatus.Ongoing) return 'none';
  if (state.isAudioPlaying) return 'none';
  if (state.pendingRevealAcks && state.pendingRevealAcks.length > 0) return 'none';

  if (state.currentStepId === undefined) return 'end_night';

  if (isStepComplete(state)) {
    // Unified deadline gate: step complete but deadline not yet reached → wait
    if (state.stepDeadline != null && nowMs < state.stepDeadline) {
      return 'none';
    }
    return 'advance';
  }

  // Auto-skip: unchosen bottom card role steps advance after random delay
  if (isUnchosenBottomCardStep(state)) {
    // No deadline set yet → signal 'none' so runInlineProgression can set it
    if (state.stepDeadline == null) return 'none';
    // Deadline not yet reached → wait
    if (nowMs < state.stepDeadline) return 'none';
    // Deadline passed → advance
    return 'advance';
  }

  return 'none';
}

/**
 * 从 sideEffects 提取 AudioEffect[]
 */
function extractAudioEffects(sideEffects: readonly SideEffect[] | undefined): AudioEffect[] {
  if (!sideEffects) return [];
  return sideEffects
    .filter(
      (e): e is { type: 'PLAY_AUDIO'; audioKey: string; isEndAudio?: boolean } =>
        e.type === 'PLAY_AUDIO',
    )
    .map((e) => ({ audioKey: e.audioKey, isEndAudio: e.isEndAudio }));
}

/**
 * 服务端内联推进（纯函数）
 *
 * 在 action 处理完成后，同一请求内评估并执行推进链：
 * action complete → evaluate → advance → evaluate → ... → none/end_night
 *
 * @param state - action 处理后的 state
 * @param hostUid - Host UID（用于构建 HandlerContext）
 * @param nowMs - 当前时间戳（用于 stepDeadline 检查，默认 Date.now()）
 * @returns 推进结果（actions + audioEffects + finalState）
 */
export function runInlineProgression(
  state: GameState,
  hostUid: string,
  nowMs: number = Date.now(),
): InlineProgressionResult {
  const allActions: StateAction[] = [];
  const allAudioEffects: AudioEffect[] = [];
  let currentState = state;
  let stepsAdvanced = 0;

  for (let i = 0; i < MAX_PROGRESSION_LOOPS; i++) {
    const decision = evaluateProgression(currentState, nowMs);

    if (decision === 'none') break;

    const ctx: HandlerContext = {
      state: currentState,
      myUid: hostUid,
      mySeat: null, // 服务端不需要 mySeat
    };

    if (decision === 'advance') {
      const result = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, ctx);
      if (!result.success) {
        log.warn('Inline advance failed', { reason: result.reason });
        break;
      }

      // Apply actions to get new state
      for (const action of result.actions) {
        currentState = gameReducer(currentState, action);
      }
      allActions.push(...result.actions);
      allAudioEffects.push(...extractAudioEffects(result.sideEffects));
      stepsAdvanced++;

      // Continue loop to evaluate next step
      continue;
    }

    if (decision === 'end_night') {
      const result = handleEndNight({ type: 'END_NIGHT' }, ctx);
      if (!result.success) {
        log.warn('Inline endNight failed', { reason: result.reason });
        break;
      }

      for (const action of result.actions) {
        currentState = gameReducer(currentState, action);
      }
      allActions.push(...result.actions);
      allAudioEffects.push(...extractAudioEffects(result.sideEffects));
      stepsAdvanced++;

      // end_night terminates progression
      break;
    }
  }

  // Set stepDeadline if we stopped at a vacant bottom card step without one.
  // Only when there are NO pending audio effects — if audio is about to play,
  // defer deadline to the audio-ack's inline progression so the random delay
  // starts AFTER audio finishes (avoids server clock race where audio duration
  // overlaps with the deadline window).
  if (
    isUnchosenBottomCardStep(currentState) &&
    currentState.stepDeadline == null &&
    allAudioEffects.length === 0
  ) {
    const deadline = nowMs + randomIntInclusive(AUTO_SKIP_DELAY_MIN_MS, AUTO_SKIP_DELAY_MAX_MS);
    const setDeadlineAction: StateAction = {
      type: 'SET_STEP_DEADLINE',
      payload: { deadline },
    };
    currentState = gameReducer(currentState, setDeadlineAction);
    allActions.push(setDeadlineAction);
    log.info('Set stepDeadline for vacant bottom card step', {
      stepId: currentState.currentStepId,
      deadline,
    });
  }

  // If there are audio effects, add SET_PENDING_AUDIO_EFFECTS + SET_AUDIO_PLAYING actions
  if (allAudioEffects.length > 0) {
    const setEffectsAction: StateAction = {
      type: 'SET_PENDING_AUDIO_EFFECTS',
      payload: { effects: allAudioEffects },
    };
    const setAudioPlayingAction: StateAction = {
      type: 'SET_AUDIO_PLAYING',
      payload: { isPlaying: true },
    };
    currentState = gameReducer(currentState, setEffectsAction);
    currentState = gameReducer(currentState, setAudioPlayingAction);
    allActions.push(setEffectsAction, setAudioPlayingAction);
  }

  log.debug('runInlineProgression complete', {
    stepsAdvanced,
    audioEffects: allAudioEffects.length,
  });

  return {
    actions: allActions,
    audioEffects: allAudioEffects,
    finalState: currentState,
    stepsAdvanced,
  };
}
