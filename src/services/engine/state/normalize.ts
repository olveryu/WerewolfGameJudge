/**
 * State Normalization - 状态归一化
 *
 * 广播前规范化状态，确保：
 * - 新增字段的 seat-map keys 是 string
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

function requireField<T>(value: T | undefined, fieldName: string): T {
  if (value === undefined) {
    throw new Error(`normalizeState: missing required field: ${fieldName}`);
  }
  return value;
}

/**
 * 广播前归一化状态（normalizeState）。
 * - 填充可选字段的默认值
 * - 规范化 seat-map 键为 string（仅新增字段）
 *
 * ⚠️ 设计意图（Phase 1）
 * - normalize 的核心职责是：形态规范化（canonicalize keys）
 * - 对"旧的核心必填字段"（roomCode/hostUid/status 等）在真实运行中更推荐 fail-fast，避免用默认值掩盖状态损坏
 * - 如果需要为测试工厂提供便捷默认值，建议拆分：
 *   - normalizeStateForBroadcast(state: BroadcastGameState): BroadcastGameState
 *   - normalizeStateForTests(partial: Partial<BroadcastGameState>): BroadcastGameState
 */
export function normalizeState(raw: BroadcastGameState): BroadcastGameState {
  // single source of truth: currentNightResults.wolfVotesBySeat
  // Protocol no longer includes top-level wolfVotes/wolfVoteStatus.
  const wolfVotesBySeat = canonicalizeSeatKeyRecord(
    raw.currentNightResults?.wolfVotesBySeat,
  );

  const currentNightResults = raw.currentNightResults
    ? {
        ...raw.currentNightResults,
        wolfVotesBySeat,
      }
    : raw.currentNightResults;

  return {
    // 必填字段（fail-fast，避免掩盖状态损坏）
    roomCode: requireField(raw.roomCode, 'roomCode'),
    hostUid: requireField(raw.hostUid, 'hostUid'),
    status: requireField(raw.status, 'status'),
    templateRoles: requireField(raw.templateRoles, 'templateRoles'),
    // ⚠️ Phase 1: players 保持原样，不做 key 规范化
    players: requireField(raw.players, 'players'),
    currentActionerIndex: requireField(raw.currentActionerIndex, 'currentActionerIndex'),
    isAudioPlaying: requireField(raw.isAudioPlaying, 'isAudioPlaying'),

    // 执行状态（可选，无需默认值）
    actions: raw.actions,
  currentNightResults,
    pendingRevealAcks: raw.pendingRevealAcks,
    lastNightDeaths: raw.lastNightDeaths,

    // Night flow 状态（关键：currentStepId 必须透传）
    currentStepId: raw.currentStepId,

    // 其他可选字段（透传）
    nightmareBlockedSeat: raw.nightmareBlockedSeat,
    wolfKillDisabled: raw.wolfKillDisabled,
    witchContext: raw.witchContext,
    seerReveal: raw.seerReveal,
    psychicReveal: raw.psychicReveal,
    gargoyleReveal: raw.gargoyleReveal,
    wolfRobotReveal: raw.wolfRobotReveal,
    wolfRobotContext: raw.wolfRobotContext,
    confirmStatus: raw.confirmStatus,
    actionRejected: raw.actionRejected,
  };
}

/**
 * Test-only helper.
 *
 * Creates a valid BroadcastGameState from a Partial, then runs normalizeState.
 * Keep normalizeState itself fail-fast in real runtime.
 */
export function normalizeStateForTests(partial: Partial<BroadcastGameState>): BroadcastGameState {
  const base: BroadcastGameState = {
    roomCode: 'TEST',
    hostUid: 'HOST',
    status: 'unseated',
    templateRoles: [],
    players: {},
    currentActionerIndex: -1,
    isAudioPlaying: false,
  };
  return normalizeState({ ...base, ...partial });
}
