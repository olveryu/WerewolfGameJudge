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
    hostUid: 'host',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'wolf', 'villager', 'villager', 'seer'],
    players: {
      0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
      1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolf' },
      2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'villager' },
      3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
      4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'seer' },
    },
    currentStepIndex: 0,
    currentStepId: 'wolfKill',
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    currentNightResults: {},
    ...overrides,
  };
}

// =============================================================================
// isWolfVoteAllComplete
// =============================================================================

describe('isWolfVoteAllComplete', () => {
  it('全投完 → true', () => {
    const state = createWolfKillState({
      currentNightResults: {
        wolfVotesBySeat: { '0': 2, '1': 3 },
      },
    });
    expect(isWolfVoteAllComplete(state)).toBe(true);
  });

  it('有撤回(key 不存在) → false', () => {
    const state = createWolfKillState({
      currentNightResults: {
        // Seat 0 voted, seat 1 withdrew (key deleted by resolver)
        wolfVotesBySeat: { '0': 2 },
      },
    });
    expect(isWolfVoteAllComplete(state)).toBe(false);
  });

  it('player.role 缺失 → false（fail-closed，旧逻辑 continue 会误判完成）', () => {
    const state = createWolfKillState({
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: null }, // role 缺失
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'villager' },
      },
      currentNightResults: {
        wolfVotesBySeat: { '0': 2 },
      },
    });
    expect(isWolfVoteAllComplete(state)).toBe(false);
  });

  it('无参与狼人(0 wolves) → false', () => {
    const state = createWolfKillState({
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'villager' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'seer' },
      },
      currentNightResults: {},
    });
    expect(isWolfVoteAllComplete(state)).toBe(false);
  });

  it('重复提交相同目标后 allVoted 仍为 true', () => {
    const state = createWolfKillState({
      currentNightResults: {
        wolfVotesBySeat: { '0': 2, '1': 2 }, // 两狼都投了 seat 2
      },
    });
    expect(isWolfVoteAllComplete(state)).toBe(true);
  });

  it('空刀(-1)视为已投票', () => {
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
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolf' },
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'villager' },
        3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'seer' },
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

  it('allVoted + 无 timer → set', () => {
    const action = decideWolfVoteTimerAction(true, false, NOW);
    expect(action.type).toBe('set');
    if (action.type === 'set') {
      expect(action.deadline).toBe(NOW + WOLF_VOTE_COUNTDOWN_MS);
    }
  });

  it('allVoted + 有 timer → set（重置）', () => {
    const action = decideWolfVoteTimerAction(true, true, NOW);
    expect(action.type).toBe('set');
    if (action.type === 'set') {
      expect(action.deadline).toBe(NOW + WOLF_VOTE_COUNTDOWN_MS);
    }
  });

  it('!allVoted + 有 timer → clear', () => {
    const action = decideWolfVoteTimerAction(false, true, NOW);
    expect(action).toEqual({ type: 'clear' });
  });

  it('!allVoted + 无 timer → noop', () => {
    const action = decideWolfVoteTimerAction(false, false, NOW);
    expect(action).toEqual({ type: 'noop' });
  });

  it('allVoted + 有 timer + 内容未變 → set（策略 A：仍重置）', () => {
    // Strategy A: any successful submit resets. Content change is irrelevant.
    const action = decideWolfVoteTimerAction(true, true, NOW);
    expect(action.type).toBe('set');
  });
});
