/**
 * normalizeState Round-Trip Integration Test
 *
 * 验证 normalizeState 在真实 Night-1 board state 上的幂等性：
 * 在每步 action 后取 getBroadcastState()，通过 normalizeState 再做一次归一化，
 * 确保结果等价（round-trip）。
 *
 * 捕获的 bug：
 * - 新增 BroadcastGameState 字段未同步到 normalizeState → 静默丢失
 * - seat-key 规范化引入数据变形
 */

import type { RoleId } from '@/models/roles';
import { doesRoleParticipateInWolfVote } from '@/models/roles';
import { normalizeState } from '@/services/engine/state/normalize';

import { cleanupHostGame, createHostGame } from './hostGameFactory';
import { executeFullNight, sendMessageOrThrow } from './stepByStepRunner';

// =============================================================================
// Constants
// =============================================================================

const TEMPLATE_NAME = '标准板12人';

function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  [
    'villager',
    'villager',
    'villager',
    'villager',
    'wolf',
    'wolf',
    'wolf',
    'wolf',
    'seer',
    'witch',
    'hunter',
    'idiot',
  ].forEach((role, idx) => map.set(idx, role as RoleId));
  return map;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * 比较两个 BroadcastGameState 的 key 集合。
 *
 * normalizeState 总是输出所有字段（包括 undefined），而 raw state 可能省略 undefined key。
 * 关键断言：raw 中的所有 key 必须出现在 normalized 中（不能丢失字段）。
 * normalized 多出的 key（undefined 字段被显式写出）是 expected behavior。
 */
function assertNoKeysLost(
  original: Record<string, unknown> | object,
  normalized: Record<string, unknown> | object,
) {
  const origKeys = new Set(Object.keys(original));
  const normKeys = new Set(Object.keys(normalized));
  const lostKeys = [...origKeys].filter((k) => !normKeys.has(k));
  expect(lostKeys).toEqual([]);
}

// =============================================================================
// Tests
// =============================================================================

describe('normalizeState round-trip (integration with real board state)', () => {
  afterEach(() => {
    cleanupHostGame();
  });

  it('初始 ongoing 状态 → normalizeState 幂等', () => {
    const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
    const state = ctx.getBroadcastState();
    const normalized = normalizeState(state);

    assertNoKeysLost(state, normalized);
    // Core fields should match exactly
    expect(normalized.status).toBe(state.status);
    expect(normalized.currentStepId).toBe(state.currentStepId);
    expect(normalized.isAudioPlaying).toBe(state.isAudioPlaying);
    expect(normalized.roomCode).toBe(state.roomCode);
    expect(normalized.hostUid).toBe(state.hostUid);
  });

  it('wolfKill 后 → normalizeState 保留 wolfVotesBySeat', () => {
    const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
    const s0 = ctx.getBroadcastState();

    // All wolves vote
    for (const [seatStr, player] of Object.entries(s0.players)) {
      const seat = Number.parseInt(seatStr, 10);
      if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
        sendMessageOrThrow(ctx, { type: 'WOLF_VOTE', seat, target: 0 }, 'wolfKill');
      }
    }
    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 4, role: 'wolf', target: 0, extra: undefined },
      'wolfKill',
    );

    const state = ctx.getBroadcastState();
    const normalized = normalizeState(state);

    assertNoKeysLost(state, normalized);
    // wolfVotesBySeat keys should be string-canonicalized
    const origVotes = state.currentNightResults?.wolfVotesBySeat ?? {};
    const normVotes = normalized.currentNightResults?.wolfVotesBySeat ?? {};
    expect(Object.keys(normVotes).length).toBe(Object.keys(origVotes).length);
    for (const [key, val] of Object.entries(origVotes)) {
      expect(normVotes[String(key)]).toBe(val);
    }
  });

  it('seerReveal 后 → normalizeState 保留 seerReveal + pendingRevealAcks', () => {
    const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

    // Walk to seerCheck: wolfKill → witchAction → hunterConfirm → seerCheck
    const s0 = ctx.getBroadcastState();
    for (const [seatStr, player] of Object.entries(s0.players)) {
      const seat = Number.parseInt(seatStr, 10);
      if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
        sendMessageOrThrow(ctx, { type: 'WOLF_VOTE', seat, target: 0 }, 'wolfKill');
      }
    }
    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 4, role: 'wolf', target: 0, extra: undefined },
      'wolfKill',
    );
    ctx.advanceNightOrThrow('past wolfKill');
    sendMessageOrThrow(
      ctx,
      {
        type: 'ACTION',
        seat: 9,
        role: 'witch',
        target: -1,
        extra: { usePoison: false, poisonTarget: -1 },
      },
      'witchAction',
    );
    ctx.advanceNightOrThrow('past witchAction');
    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 10, role: 'hunter', target: null, extra: { confirmed: true } },
      'hunterConfirm',
    );
    ctx.advanceNightOrThrow('past hunterConfirm');

    // seer checks seat 4 (wolf → bad)
    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 8, role: 'seer', target: 4, extra: undefined },
      'seerCheck',
    );

    const state = ctx.getBroadcastState();
    const normalized = normalizeState(state);

    assertNoKeysLost(state, normalized);
    expect(normalized.seerReveal).toEqual(state.seerReveal);
    expect(normalized.pendingRevealAcks).toEqual(state.pendingRevealAcks);
  });

  it('全流程 executeFullNight 后 → normalizeState 幂等', () => {
    const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
    executeFullNight(ctx);

    const state = ctx.getBroadcastState();
    const normalized = normalizeState(state);

    assertNoKeysLost(state, normalized);
    expect(normalized.status).toBe(state.status);
    expect(normalized.actions).toEqual(state.actions);
  });

  it('normalizeState 二次应用 → 结果不变（严格幂等）', () => {
    const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
    executeFullNight(ctx);

    const state = ctx.getBroadcastState();
    const once = normalizeState(state);
    const twice = normalizeState(once);

    // 二次归一化结果应完全相同
    expect(twice).toEqual(once);
  });
});
