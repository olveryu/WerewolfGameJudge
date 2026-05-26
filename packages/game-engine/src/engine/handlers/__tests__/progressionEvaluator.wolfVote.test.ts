/**
 * progressionEvaluator.wolfVote.test.ts
 *
 * Tests for wolf vote related pure functions:
 * - isWolfVoteAllComplete
 * - decideWolfVoteTimerAction
 */

import {
  decideWolfVoteTimerAction,
  isWolfVoteAllComplete,
  WOLF_VOTE_COUNTDOWN_MS,
} from '@werewolf/game-engine/engine/handlers/progressionEvaluator';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { GameState } from '@werewolf/game-engine/protocol/types';

// =============================================================================
// Test Helpers
// =============================================================================

function createWolfKillState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomCode: 'TEST',
    hostUserId: 'host',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'wolf', 'villager', 'villager', 'seer'],
    players: {
      0: { userId: 'p0', seat: 0, hasViewedRole: true, role: 'wolf' },
      1: { userId: 'p1', seat: 1, hasViewedRole: true, role: 'wolf' },
      2: { userId: 'p2', seat: 2, hasViewedRole: true, role: 'villager' },
      3: { userId: 'p3', seat: 3, hasViewedRole: true, role: 'villager' },
      4: { userId: 'p4', seat: 4, hasViewedRole: true, role: 'seer' },
    },
    currentStepIndex: 0,
    currentStepId: 'wolfKill',
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    roster: {},
    currentNightResults: {},
    ...overrides,
  };
}

// =============================================================================
// isWolfVoteAllComplete
// =============================================================================

describe('isWolfVoteAllComplete', () => {
  it('all voted -> true', () => {
    const state = createWolfKillState({
      currentNightResults: {
        wolfVotesBySeat: { '0': 2, '1': 3 },
      },
    });
    expect(isWolfVoteAllComplete(state)).toBe(true);
  });

  it('withdrawn (key absent) -> false', () => {
    const state = createWolfKillState({
      currentNightResults: {
        // Seat 0 voted, seat 1 withdrew (key deleted by resolver)
        wolfVotesBySeat: { '0': 2 },
      },
    });
    expect(isWolfVoteAllComplete(state)).toBe(false);
  });

  it('player.role missing -> false (fail-closed; the old `continue` logic would incorrectly mark complete)', () => {
    const state = createWolfKillState({
      players: {
        0: { userId: 'p0', seat: 0, hasViewedRole: true, role: 'wolf' },
        1: { userId: 'p1', seat: 1, hasViewedRole: true, role: null }, // role missing
        2: { userId: 'p2', seat: 2, hasViewedRole: true, role: 'villager' },
      },
      currentNightResults: {
        wolfVotesBySeat: { '0': 2 },
      },
    });
    expect(isWolfVoteAllComplete(state)).toBe(false);
  });

  it('no participating wolves (0 wolves) -> false', () => {
    const state = createWolfKillState({
      players: {
        0: { userId: 'p0', seat: 0, hasViewedRole: true, role: 'villager' },
        1: { userId: 'p1', seat: 1, hasViewedRole: true, role: 'seer' },
      },
      currentNightResults: {},
    });
    expect(isWolfVoteAllComplete(state)).toBe(false);
  });

  it('after repeated submits on the same target, allVoted remains true', () => {
    const state = createWolfKillState({
      currentNightResults: {
        wolfVotesBySeat: { '0': 2, '1': 2 }, // both wolves voted for seat 2
      },
    });
    expect(isWolfVoteAllComplete(state)).toBe(true);
  });

  it('skip attack (-1) is treated as voted', () => {
    const state = createWolfKillState({
      currentNightResults: {
        wolfVotesBySeat: { '0': -1, '1': 3 },
      },
    });
    expect(isWolfVoteAllComplete(state)).toBe(true);
  });

  it('production invariant: all players have roles when status=ongoing → fail-closed never triggers', () => {
    // Mirrors real game flow: handleAssignRoles assigns a role to every seat
    // before handleStartNight sets status=GameStatus.Ongoing. During ongoing,
    // handleTakeSeat rejects joins and handleLeaveMySeat rejects leaves.
    // Therefore player.role is never null when this function runs.
    const state = createWolfKillState({
      // All 5 players have roles — the only valid ongoing state
      players: {
        0: { userId: 'p0', seat: 0, hasViewedRole: true, role: 'wolf' },
        1: { userId: 'p1', seat: 1, hasViewedRole: true, role: 'wolf' },
        2: { userId: 'p2', seat: 2, hasViewedRole: true, role: 'villager' },
        3: { userId: 'p3', seat: 3, hasViewedRole: true, role: 'villager' },
        4: { userId: 'p4', seat: 4, hasViewedRole: true, role: 'seer' },
      },
      currentNightResults: {
        wolfVotesBySeat: { '0': 2, '1': 3 },
      },
    });
    // With all roles assigned (production invariant), the fail-closed
    // `return false` branch is unreachable → no deadlock
    expect(isWolfVoteAllComplete(state)).toBe(true);
  });
});

// =============================================================================
// decideWolfVoteTimerAction
// =============================================================================

describe('decideWolfVoteTimerAction', () => {
  const NOW = 1000000;

  it('allVoted + no timer -> set', () => {
    const action = decideWolfVoteTimerAction(true, false, NOW);
    expect(action.type).toBe('set');
    if (action.type === 'set') {
      expect(action.deadline).toBe(NOW + WOLF_VOTE_COUNTDOWN_MS);
    }
  });

  it('allVoted + has timer -> set (reset)', () => {
    const action = decideWolfVoteTimerAction(true, true, NOW);
    expect(action.type).toBe('set');
    if (action.type === 'set') {
      expect(action.deadline).toBe(NOW + WOLF_VOTE_COUNTDOWN_MS);
    }
  });

  it('!allVoted + has timer -> clear', () => {
    const action = decideWolfVoteTimerAction(false, true, NOW);
    expect(action).toEqual({ type: 'clear' });
  });

  it('!allVoted + no timer -> noop', () => {
    const action = decideWolfVoteTimerAction(false, false, NOW);
    expect(action).toEqual({ type: 'noop' });
  });

  it('allVoted + has timer + content unchanged -> set (strategy A: still reset)', () => {
    // Strategy A: any successful submit resets. Content change is irrelevant.
    const action = decideWolfVoteTimerAction(true, true, NOW);
    expect(action.type).toBe('set');
  });
});
