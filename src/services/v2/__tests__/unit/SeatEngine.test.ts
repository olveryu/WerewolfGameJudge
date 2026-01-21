/**
 * SeatEngine Unit Tests
 */

import { SeatEngine } from '../../domain/SeatEngine';
import { GameStatus, type LocalGameState } from '../../infra/StateStore';
import type { GameTemplate } from '../../../../models/Template';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestState(overrides: Partial<LocalGameState> = {}): LocalGameState {
  const defaultTemplate: GameTemplate = {
    name: 'test',
    numberOfPlayers: 6,
    roles: ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'],
  };

  const players = new Map<number, import('../../infra/StateStore').LocalPlayer | null>();
  for (let i = 1; i <= defaultTemplate.roles.length; i++) {
    players.set(i, null);
  }

  return {
    roomCode: 'TEST01',
    hostUid: 'host-uid',
    status: GameStatus.unseated,
    template: defaultTemplate,
    players,
    actions: new Map(),
    wolfVotes: new Map(),
    currentActionerIndex: -1,
    isAudioPlaying: false,
    lastNightDeaths: [],
    currentNightResults: {},
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('SeatEngine', () => {
  let engine: SeatEngine;

  beforeEach(() => {
    engine = new SeatEngine();
  });

  // ---------------------------------------------------------------------------
  // sit()
  // ---------------------------------------------------------------------------

  describe('sit()', () => {
    it('should allow sitting in an empty seat', () => {
      const state = createTestState();
      const result = engine.sit(state, {
        seat: 1,
        uid: 'player-1',
        displayName: 'Player 1',
      });

      expect(result.success).toBe(true);
      expect(result.updates?.players?.get(1)?.uid).toBe('player-1');
      expect(result.updates?.players?.get(1)?.displayName).toBe('Player 1');
    });

    it('should reject sitting in an occupied seat', () => {
      const state = createTestState();
      state.players.set(1, {
        uid: 'existing-player',
        seatNumber: 1,
        role: null,
        hasViewedRole: false,
      });

      const result = engine.sit(state, {
        seat: 1,
        uid: 'player-2',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('seat_taken');
    });

    it('should reject sitting when game is in progress', () => {
      const state = createTestState({ status: GameStatus.ongoing });
      const result = engine.sit(state, {
        seat: 1,
        uid: 'player-1',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('game_in_progress');
    });

    it('should reject sitting in seat out of range', () => {
      const state = createTestState();
      const result = engine.sit(state, {
        seat: 100,
        uid: 'player-1',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('seat_out_of_range');
    });

    it('should clear old seat when player moves', () => {
      const state = createTestState();
      state.players.set(1, {
        uid: 'player-1',
        seatNumber: 1,
        role: null,
        hasViewedRole: false,
      });

      const result = engine.sit(state, {
        seat: 2,
        uid: 'player-1',
        displayName: 'Player 1',
      });

      expect(result.success).toBe(true);
      expect(result.updates?.players?.get(1)).toBe(null);
      expect(result.updates?.players?.get(2)?.uid).toBe('player-1');
    });

    it('should update status to seated when all seats filled', () => {
      const state = createTestState();
      // Fill 5 seats
      for (let i = 1; i <= 5; i++) {
        state.players.set(i, {
          uid: `player-${i}`,
          seatNumber: i,
          role: null,
          hasViewedRole: false,
        });
      }

      // Sit in last seat
      const result = engine.sit(state, {
        seat: 6,
        uid: 'player-6',
      });

      expect(result.success).toBe(true);
      expect(result.updates?.status).toBe(GameStatus.seated);
    });
  });

  // ---------------------------------------------------------------------------
  // standup()
  // ---------------------------------------------------------------------------

  describe('standup()', () => {
    it('should allow standing up from own seat', () => {
      const state = createTestState();
      state.players.set(1, {
        uid: 'player-1',
        seatNumber: 1,
        role: null,
        hasViewedRole: false,
      });

      const result = engine.standup(state, {
        seat: 1,
        uid: 'player-1',
      });

      expect(result.success).toBe(true);
      expect(result.updates?.players?.get(1)).toBe(null);
    });

    it('should reject standing up from someone else\'s seat', () => {
      const state = createTestState();
      state.players.set(1, {
        uid: 'player-1',
        seatNumber: 1,
        role: null,
        hasViewedRole: false,
      });

      const result = engine.standup(state, {
        seat: 1,
        uid: 'player-2',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_seated');
    });

    it('should reject standing up from empty seat', () => {
      const state = createTestState();
      const result = engine.standup(state, {
        seat: 1,
        uid: 'player-1',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_seated');
    });

    it('should reject standing up when game is in progress', () => {
      const state = createTestState({ status: GameStatus.ongoing });
      state.players.set(1, {
        uid: 'player-1',
        seatNumber: 1,
        role: null,
        hasViewedRole: false,
      });

      const result = engine.standup(state, {
        seat: 1,
        uid: 'player-1',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('game_in_progress');
    });
  });

  // ---------------------------------------------------------------------------
  // Query Helpers
  // ---------------------------------------------------------------------------

  describe('query helpers', () => {
    it('isSeatAvailable should check if seat is empty', () => {
      const state = createTestState();
      state.players.set(1, {
        uid: 'player-1',
        seatNumber: 1,
        role: null,
        hasViewedRole: false,
      });

      expect(engine.isSeatAvailable(state, 1)).toBe(false);
      expect(engine.isSeatAvailable(state, 2)).toBe(true);
    });

    it('getOccupiedSeats should return sorted list of occupied seats', () => {
      const state = createTestState();
      state.players.set(3, {
        uid: 'player-3',
        seatNumber: 3,
        role: null,
        hasViewedRole: false,
      });
      state.players.set(1, {
        uid: 'player-1',
        seatNumber: 1,
        role: null,
        hasViewedRole: false,
      });

      expect(engine.getOccupiedSeats(state)).toEqual([1, 3]);
    });

    it('findSeatByUid should find player seat', () => {
      const state = createTestState();
      state.players.set(3, {
        uid: 'player-3',
        seatNumber: 3,
        role: null,
        hasViewedRole: false,
      });

      expect(engine.findSeatByUid(state, 'player-3')).toBe(3);
      expect(engine.findSeatByUid(state, 'unknown')).toBe(null);
    });

    it('getOccupiedCount should count occupied seats', () => {
      const state = createTestState();
      expect(engine.getOccupiedCount(state)).toBe(0);

      state.players.set(1, {
        uid: 'player-1',
        seatNumber: 1,
        role: null,
        hasViewedRole: false,
      });
      state.players.set(3, {
        uid: 'player-3',
        seatNumber: 3,
        role: null,
        hasViewedRole: false,
      });

      expect(engine.getOccupiedCount(state)).toBe(2);
    });
  });
});
