/**
 * State Normalization - 状态归一化
 *
 * 广播前规范化状态，确保：
 * - 新增字段的 seat-map keys 是 string
 * - wolfVoteStatus 从 wolfVotes 派生（如果存在）
 * - 可选字段正确透传
 */

import type { BroadcastGameState } from '../../protocol/types';

/**
 * 规范化座位键记录（canonicalize），确保所有 key 都是 string。
 * 用于任何 Record<string, T> 在运行时可能收到 number key 的场景。
 */
export function canonicalizeSeatKeyRecord<T>(
  record: Record<string | number, T> | undefined,
): Record<string, T> | undefined {
  if (record === undefined) return undefined;
  const result: Record<string, T> = {};
  for (const [k, v] of Object.entries(record)) {
    result[String(k)] = v;
  }
  return result;
}

/**
 * 从 wolfVotes 派生 wolfVoteStatus。
 * 仅当 wolfVotes 存在时调用。
 */
function deriveWolfVoteStatus(wolfVotes: Record<string, number>): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const seatStr of Object.keys(wolfVotes)) {
    result[seatStr] = true;
  }
  return result;
}

/**
 * 广播前归一化状态（normalizeState）。
 * - 填充可选字段的默认值
 * - 规范化 seat-map 键为 string（仅新增字段）
 * - 从 wolfVotes 派生 wolfVoteStatus（如果 wolfVotes 存在）
 *
 * ⚠️ 设计意图（Phase 1）
 * - normalize 的核心职责是：形态规范化（canonicalize keys）与派生字段（wolfVotes -> wolfVoteStatus）
 * - 对"旧的核心必填字段"（roomCode/hostUid/status 等）在真实运行中更推荐 fail-fast，避免用默认值掩盖状态损坏
 * - 如果需要为测试工厂提供便捷默认值，建议拆分：
 *   - normalizeStateForBroadcast(state: BroadcastGameState): BroadcastGameState
 *   - normalizeStateForTests(partial: Partial<BroadcastGameState>): BroadcastGameState
 */
export function normalizeState(raw: Partial<BroadcastGameState>): BroadcastGameState {
  // 规范化 seat-map 字段（仅新增字段）
  const wolfVotes = canonicalizeSeatKeyRecord(raw.wolfVotes);

  // 派生 wolfVoteStatus: 仅当 wolfVotes 存在时派生，否则保留 legacy 值
  let wolfVoteStatus: Record<string, boolean> | undefined;
  if (wolfVotes !== undefined) {
    // v2 模式：从 wolfVotes 派生
    wolfVoteStatus = deriveWolfVoteStatus(wolfVotes);
  } else if (raw.wolfVoteStatus !== undefined) {
    // legacy 模式：保留现有值，但规范化 keys
    wolfVoteStatus = canonicalizeSeatKeyRecord(raw.wolfVoteStatus);
  }

  return {
    // 必填字段默认值
    roomCode: raw.roomCode ?? '',
    hostUid: raw.hostUid ?? '',
    status: raw.status ?? 'unseated',
    templateRoles: raw.templateRoles ?? [],
    // ⚠️ Phase 1: players 保持原样，不做 key 规范化
    players: raw.players ?? {},
    currentActionerIndex: raw.currentActionerIndex ?? -1,
    isAudioPlaying: raw.isAudioPlaying ?? false,

    // Seat-map 字段（已规范化）
    wolfVoteStatus,
    wolfVotes,

    // 执行状态（可选，无需默认值）
    actions: raw.actions,
    currentNightResults: raw.currentNightResults,
    pendingRevealAcks: raw.pendingRevealAcks,
    lastNightDeaths: raw.lastNightDeaths,

    // 其他可选字段（透传）
    nightmareBlockedSeat: raw.nightmareBlockedSeat,
    wolfKillDisabled: raw.wolfKillDisabled,
    witchContext: raw.witchContext,
    seerReveal: raw.seerReveal,
    psychicReveal: raw.psychicReveal,
    gargoyleReveal: raw.gargoyleReveal,
    wolfRobotReveal: raw.wolfRobotReveal,
    confirmStatus: raw.confirmStatus,
    actionRejected: raw.actionRejected,
  };
}
