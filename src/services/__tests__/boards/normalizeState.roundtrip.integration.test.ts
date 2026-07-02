/**
 * normalizeWerewolfState Round-Trip Integration Test
 *
 * Verifies idempotency of normalizeWerewolfState on real Night-1 board states:
 * after each action, take getGameState(), run normalizeWerewolfState again,
 * and assert the result is equivalent (round-trip).
 *
 * Bugs caught by this test:
 * - New WerewolfState fields not synced to normalizeWerewolfState → silently lost
 * - seat-key normalization introducing data distortion
 */

import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';
import { doesRoleParticipateInWolfVote } from '@werewolf/game-engine/werewolf/models/roles';
import { normalizeWerewolfState } from '@werewolf/game-engine/werewolf/state/normalizeWerewolfState';

import { cleanupGame, createGame } from './gameFactory';
import { executeFullNight, sendMessageOrThrow } from './stepByStepRunner';

// =============================================================================
// Constants
// =============================================================================

const TEMPLATE_NAME = '预女猎白';

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
 * Compares the key sets of two WerewolfState objects.
 *
 * normalizeWerewolfState always outputs all fields (including undefined), while raw state may omit undefined keys.
 * Key assertion: every key in raw must appear in normalized (no fields lost).
 * Extra keys in normalized (undefined fields written explicitly) are expected behavior.
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

describe('normalizeWerewolfState round-trip (integration with real board state)', () => {
  afterEach(() => {
    cleanupGame();
  });

  it('初始 ongoing 状态 → normalizeWerewolfState 幂等', () => {
    const ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
    const state = ctx.getGameState();
    const normalized = normalizeWerewolfState(state);

    assertNoKeysLost(state, normalized);
    // Core fields should match exactly
    expect(normalized.status).toBe(state.status);
    expect(normalized.currentStepId).toBe(state.currentStepId);
    expect(normalized.isAudioPlaying).toBe(state.isAudioPlaying);
    expect(normalized.roomCode).toBe(state.roomCode);
    expect(normalized.hostUserId).toBe(state.hostUserId);
  });

  it('wolfKill 后 → normalizeWerewolfState 保留 wolfVotesBySeat', () => {
    const ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
    const s0 = ctx.getGameState();

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

    const state = ctx.getGameState();
    const normalized = normalizeWerewolfState(state);

    assertNoKeysLost(state, normalized);
    // wolfVotesBySeat keys should be string-canonicalized
    const origVotes = state.currentNightResults?.wolfVotesBySeat ?? {};
    const normVotes = normalized.currentNightResults?.wolfVotesBySeat ?? {};
    expect(Object.keys(normVotes).length).toBe(Object.keys(origVotes).length);
    for (const [key, val] of Object.entries(origVotes)) {
      expect(normVotes[String(key)]).toBe(val);
    }
  });

  it('seerReveal 后 → normalizeWerewolfState 保留 seerReveal + pendingRevealAcks', () => {
    const ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

    // Walk to seerCheck: wolfKill → witchAction → hunterConfirm → seerCheck
    const s0 = ctx.getGameState();
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

    const state = ctx.getGameState();
    const normalized = normalizeWerewolfState(state);

    assertNoKeysLost(state, normalized);
    expect(normalized.seerReveal).toEqual(state.seerReveal);
    expect(normalized.pendingRevealAcks).toEqual(state.pendingRevealAcks);
  });

  it('全流程 executeFullNight 后 → normalizeWerewolfState 幂等', () => {
    const ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
    executeFullNight(ctx);

    const state = ctx.getGameState();
    const normalized = normalizeWerewolfState(state);

    assertNoKeysLost(state, normalized);
    expect(normalized.status).toBe(state.status);
    expect(normalized.actions).toEqual(state.actions);
  });

  it('normalizeWerewolfState 二次应用 → 结果不变（严格幂等）', () => {
    const ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
    executeFullNight(ctx);

    const state = ctx.getGameState();
    const once = normalizeWerewolfState(state);
    const twice = normalizeWerewolfState(once);

    // Second normalization result must be identical
    expect(twice).toEqual(once);
  });
});
