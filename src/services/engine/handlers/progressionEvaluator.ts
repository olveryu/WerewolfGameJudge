/**
 * Progression Evaluator - 夜晚推进决策评估器（Host-only）
 *
 * 职责：
 * - evaluateNightProgression：基于 BroadcastGameState 事实评估是否需要推进
 * - handleNightProgression：执行推进（调用 advanceNight / endNight）
 * - 幂等保护（同一 {revision, currentStepId} 最多推进一次）
 * - isWolfVoteAllComplete：判断全部狼人是否投票完成（exported 纯函数，evaluator + facade 共用）
 * - shouldTriggerWolfVoteRecovery：前台恢复判断（exported 纯函数）
 * - decideWolfVoteTimerAction：Timer set/clear/noop 决策（exported 纯函数）
 *
 * ✅ 允许：读取 state 事实做推进判断 + 调用 advanceNight/endNight
 * ❌ 禁止：在 Facade / UI / submit 回调里做推进决策（推进权威必须集中在此）
 * ❌ 禁止：IO（网络 / 音频 / Alert）
 */

import { doesRoleParticipateInWolfVote } from '@/models/roles';
import type { BroadcastGameState } from '@/services/protocol/types';
import { nightFlowLog } from '@/utils/logger';

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
type NightProgressionDecision =
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

// =============================================================================
// Wolf Vote Pure Functions（exported，evaluator + facade 共用）
// =============================================================================

/** 狼人投票倒计时毫秒数 */
export const WOLF_VOTE_COUNTDOWN_MS = 5000;

/**
 * 判断全部参与投票的狼人是否都已完成投票（exported 纯函数）。
 *
 * Fail-closed 设计：
 * - player.role 缺失 → return false（无法确定角色 → 不认为全完成）
 * - 0 参与狼人 → return false（wolfKill step 下无狼人是异常，不应推进）
 * - 撤回（-2）的狼人 key 已被 resolver 删除，不在 wolfVotesBySeat 中 → 未投票 → false
 *
 * @invariant player.role !== null when status='ongoing'（此函数仅在 wolfKill step 调用）。
 * 保证链：handleAssignRoles 为全部 seats 写入 role → status='assigned' →
 * handleStartNight 设 status='ongoing'。ongoing 期间 handleTakeSeat 拒绝加入
 * （status !== unseated/seated），handleLeaveMySeat 拒绝离开（status === ongoing）。
 * 因此 fail-closed 的 `return false` 在生产中不会触发 deadlock。
 *
 * ⚠️ 行为变更（vs 旧 isCurrentStepComplete wolfKill 分支）：
 * 旧逻辑 `continue` 跳过 role 缺失的座位，新逻辑 `return false`（fail-closed）。
 */
export function isWolfVoteAllComplete(state: BroadcastGameState): boolean {
  const wolfVotes = state.currentNightResults?.wolfVotesBySeat ?? {};
  const participatingWolfSeats: number[] = [];
  for (const [seatStr, player] of Object.entries(state.players)) {
    const seat = Number.parseInt(seatStr, 10);
    if (!Number.isFinite(seat)) continue;
    if (!player?.role) return false; // fail-closed：role 缺失 → 不确定 → false
    if (doesRoleParticipateInWolfVote(player.role)) {
      participatingWolfSeats.push(seat);
    }
  }
  if (participatingWolfSeats.length === 0) return false; // fail-closed：0 狼人 → 异常 → false
  return participatingWolfSeats.every((seat) => {
    const v = wolfVotes[String(seat)];
    return typeof v === 'number' && (v >= 0 || v === -1);
  });
}

/**
 * 前台恢复判断：是否需要在回到前台时触发狼人投票推进。
 *
 * 当 App 从后台回到前台时，Timer 可能已错过。
 * 通过检查 `wolfVoteDeadline` 是否已过期来决定是否需要补偿推进。
 */
export function shouldTriggerWolfVoteRecovery(
  state: BroadcastGameState,
  now: number,
): boolean {
  return (
    state.currentStepId === 'wolfKill' &&
    state.wolfVoteDeadline != null &&
    now >= state.wolfVoteDeadline
  );
}

/**
 * Timer 决策纯函数结果类型
 */
export type WolfVoteTimerAction =
  | { type: 'set'; deadline: number }
  | { type: 'clear' }
  | { type: 'noop' };

/**
 * 决定狼人投票 Timer 的动作（纯函数）。
 *
 * | allVoted | hasExistingTimer | 动作 |
 * |---------|-----------------|------|
 * | true    | any             | set（设置/重置 deadline） |
 * | false   | true            | clear（撤回导致未全投完） |
 * | false   | false           | noop |
 *
 * 策略 A：任何成功 submit 都调用此函数，allVoted 时一律 set（无论内容是否改变）。
 */
export function decideWolfVoteTimerAction(
  allVoted: boolean,
  hasExistingTimer: boolean,
  now: number,
  countdownMs: number = WOLF_VOTE_COUNTDOWN_MS,
): WolfVoteTimerAction {
  if (allVoted) return { type: 'set', deadline: now + countdownMs };
  if (hasExistingTimer) return { type: 'clear' };
  return { type: 'noop' };
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
    return isWolfVoteAllComplete(state);
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
    // Countdown gate: wolfKill 全投完但倒计时未到 → 不推进
    if (
      state.currentStepId === 'wolfKill' &&
      state.wolfVoteDeadline != null &&
      Date.now() < state.wolfVoteDeadline
    ) {
      return { action: 'none', reason: 'wolf_vote_countdown' };
    }

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
interface NightProgressionCallbacks {
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
interface NightProgressionResult {
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
