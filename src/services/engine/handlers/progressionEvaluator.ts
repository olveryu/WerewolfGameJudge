/**
 * Progression Evaluator - 夜晚推进决策评估器
 *
 * Host-only 幂等推进决策:
 * - evaluateNightProgression: 评估是否需要推进
 * - handleNightProgression: 执行推进
 *
 * 职责:
 * - 基于 BroadcastGameState 事实判断推进时机
 * - 幂等保护（同一 {revision, currentStepId} 最多推进一次）
 * - 调用 advanceNight / endNight
 */

import type { BroadcastGameState } from '../../protocol/types';

import { getRoleSpec } from '../../../models/roles';
import { nightFlowLog } from '../../../utils/logger';

/**
 * 非 null 的 state 类型
 */
type NonNullState = NonNullable<BroadcastGameState>;

// =============================================================================
// Night Progression Evaluator (幂等推进决策)
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

      const spec = getRoleSpec(player.role) as unknown as {
        wolfMeeting?: { participatesInWolfVote?: boolean };
      } | undefined;
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
