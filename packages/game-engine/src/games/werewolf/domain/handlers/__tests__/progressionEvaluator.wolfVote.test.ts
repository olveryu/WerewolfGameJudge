/**
 * progressionEvaluator.wolfVote.test.ts
 *
 * Tests for the wolf vote completeness predicate:
 * - isWolfVoteAllComplete
 *
 * The timer arm decision moved to the shared settle countdown
 * skeleton; its truth-table tests live in
 * `platform/room/__tests__/settleCountdown.contract.test.ts`.
 */

import { isWolfVoteAllComplete } from '@game-judge/game-engine/games/werewolf/domain/handlers/progressionEvaluator';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/domain/models/GameStatus';
import type {
  GameState,
  WerewolfHumanSeat,
} from '@game-judge/game-engine/games/werewolf/domain/protocol/types';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/state/version';

// =============================================================================
// Test Helpers
// =============================================================================

function createWolfKillState(overrides: Partial<GameState> = {}): GameState {
  const state: GameState = {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'TEST',
    hostUserId: 'host',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'wolf', 'villager', 'villager', 'seer'],
    players: {
      0: { seat: 0, role: 'wolf' },
      1: { seat: 1, role: 'wolf' },
      2: { seat: 2, role: 'villager' },
      3: { seat: 3, role: 'villager' },
      4: { seat: 4, role: 'seer' },
    },
    roleViewedSeats: [],
    nightStep: { kind: 'inStep', stepId: 'wolfKill' },
    isAudioPlaying: false,
    pendingAudioEffects: [],
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    roster: {},
    currentNightResults: {},
    ...overrides,
  };
  // Occupancy follows the players map in this factory (seat N is user `p<seat>`).
  if (overrides?.roster === undefined) {
    const roster: Record<number, WerewolfHumanSeat> = {};
    for (const player of Object.values(state.players)) {
      if (player !== null) {
        roster[player.seat] = {
          seat: player.seat,
          userId: `p${player.seat}`,
          profile: { displayName: 'P' },
        };
      }
    }
    return { ...state, roster };
  }
  return state;
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

  it('fails fast when an ongoing player has no assigned role', () => {
    const state = createWolfKillState({
      players: {
        0: { seat: 0, role: 'wolf' },
        1: { seat: 1, role: null }, // role missing
        2: { seat: 2, role: 'villager' },
      },
      currentNightResults: {
        wolfVotesBySeat: { '0': 2 },
      },
    });
    expect(() => isWolfVoteAllComplete(state)).toThrow(
      '[FAIL-FAST] Player at seat 1 has no role during wolf vote',
    );
  });

  it('fails fast when wolfKill has no participating wolves', () => {
    const state = createWolfKillState({
      players: {
        0: { seat: 0, role: 'villager' },
        1: { seat: 1, role: 'seer' },
      },
      currentNightResults: {},
    });
    expect(() => isWolfVoteAllComplete(state)).toThrow(
      '[FAIL-FAST] wolfKill step has no participating wolves',
    );
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
        0: { seat: 0, role: 'wolf' },
        1: { seat: 1, role: 'wolf' },
        2: { seat: 2, role: 'villager' },
        3: { seat: 3, role: 'villager' },
        4: { seat: 4, role: 'seer' },
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
