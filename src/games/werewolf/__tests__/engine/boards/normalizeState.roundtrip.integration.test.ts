/**
 * normalizeState Round-Trip Integration Test
 *
 * Verifies idempotency of normalizeState on real Night-1 board states:
 * after each action, take getGameState(), run normalizeState again,
 * and assert the result is equivalent (round-trip).
 *
 * Bugs caught by this test:
 * - New GameState fields not synced to normalizeState → silently lost
 * - seat-key normalization introducing data distortion
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { doesRoleParticipateInWolfVote } from '@game-judge/game-engine/games/werewolf/public';
import { werewolfEngine } from '@game-judge/game-engine/games/werewolf/public';

import { cleanupGame, createGame } from './gameFactory';
import { executeFullNight, submitActionOrThrow } from './stepByStepRunner';

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
 * Compares the key sets of two GameState objects.
 *
 * normalizeState always outputs all fields (including undefined), while raw state may omit undefined keys.
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

describe('normalizeState round-trip (integration with real board state)', () => {
  afterEach(() => {
    cleanupGame();
  });

  it('初始 ongoing 状态 → normalizeState 幂等', () => {
    const ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
    const state = ctx.getGameState();
    const normalized = werewolfEngine.normalize(state);

    assertNoKeysLost(state, normalized);
    // Core fields should match exactly
    expect(normalized.status).toBe(state.status);
    expect(normalized.currentStepId).toBe(state.currentStepId);
    expect(normalized.isAudioPlaying).toBe(state.isAudioPlaying);
    expect(normalized.roomCode).toBe(state.roomCode);
    expect(normalized.hostUserId).toBe(state.hostUserId);
  });

  it('wolfKill 后 → normalizeState 保留 wolfVotesBySeat', () => {
    const ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
    const s0 = ctx.getGameState();

    // All wolves vote
    for (const [seatStr, player] of Object.entries(s0.players)) {
      const seat = Number.parseInt(seatStr, 10);
      if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
        submitActionOrThrow(ctx, seat, { kind: 'target', target: 0 }, 'wolfKill');
      }
    }

    const state = ctx.getGameState();
    const normalized = werewolfEngine.normalize(state);

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
    const ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

    // Walk to seerCheck: wolfKill → witchAction → hunterConfirm → seerCheck
    const s0 = ctx.getGameState();
    for (const [seatStr, player] of Object.entries(s0.players)) {
      const seat = Number.parseInt(seatStr, 10);
      if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
        submitActionOrThrow(ctx, seat, { kind: 'target', target: 0 }, 'wolfKill');
      }
    }
    const wolfVoteDeadline = ctx.getGameState().stepDeadline;
    if (wolfVoteDeadline === undefined) {
      throw new Error('[FAIL-FAST] Completed wolf vote must set a progression deadline');
    }
    ctx.dispatchOrThrow(
      { type: 'werewolf.progress.request' },
      'past wolfKill deadline',
      undefined,
      { nowMs: wolfVoteDeadline },
    );
    ctx.dispatchOrThrow({ type: 'werewolf.audio.ack' }, 'complete wolfKill to witchAction audio');
    submitActionOrThrow(ctx, 9, { kind: 'skip' }, 'witchAction');
    ctx.dispatchOrThrow(
      { type: 'werewolf.audio.ack' },
      'complete witchAction to hunterConfirm audio',
    );
    submitActionOrThrow(ctx, 10, { kind: 'confirm' }, 'hunterConfirm');
    ctx.dispatchOrThrow(
      { type: 'werewolf.audio.ack' },
      'complete hunterConfirm to seerCheck audio',
    );

    // seer checks seat 4 (wolf → bad)
    submitActionOrThrow(ctx, 8, { kind: 'target', target: 4 }, 'seerCheck');

    const state = ctx.getGameState();
    const normalized = werewolfEngine.normalize(state);

    assertNoKeysLost(state, normalized);
    expect(normalized.seerReveal).toEqual(state.seerReveal);
    expect(normalized.pendingRevealAcks).toEqual(state.pendingRevealAcks);
  });

  it('全流程 executeFullNight 后 → normalizeState 幂等', () => {
    const ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
    executeFullNight(ctx);

    const state = ctx.getGameState();
    const normalized = werewolfEngine.normalize(state);

    assertNoKeysLost(state, normalized);
    expect(normalized.status).toBe(state.status);
    expect(normalized.actions).toEqual(state.actions);
  });

  it('normalizeState 二次应用 → 结果不变（严格幂等）', () => {
    const ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
    executeFullNight(ctx);

    const state = ctx.getGameState();
    const once = werewolfEngine.normalize(state);
    const twice = werewolfEngine.normalize(once);

    // Second normalization result must be identical
    expect(twice).toEqual(once);
  });
});
