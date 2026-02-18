/**
 * Wolf Vote Pure Functions — 狼人投票相关纯函数
 *
 * 职责：
 * - isWolfVoteAllComplete：判断全部狼人是否投票完成（server + evaluator 共用）
 * - decideWolfVoteTimerAction：Timer set/clear/noop 决策
 *
 * ✅ 允许：读取 state 事实做判断
 * ❌ 禁止：IO（网络 / 音频 / Alert）
 *
 * 推进决策与执行由服务端 runInlineProgression 负责（见 inlineProgression.ts）。
 */

import { doesRoleParticipateInWolfVote } from '../../models/roles';
import type { BroadcastGameState } from '../../protocol/types';

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
