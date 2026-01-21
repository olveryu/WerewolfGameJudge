/**
 * SeatManager unit tests
 *
 * Tests seat-related operations including:
 * - Host: process sit/standup actions
 * - Player: send actions with ACK
 * - Error handling and edge cases
 */

import { SeatManager, SeatManagerConfig, SeatActionRequest, SeatActionAck } from '../SeatManager';
import type { LocalGameState } from '../../../v2/types/GameState';
import { GameStatus } from '../../../v2/types/GameState';
import type { BroadcastCoordinator } from '../../broadcast/BroadcastCoordinator';

// =============================================================================
// Mock Helpers
// =============================================================================

function createMockState(
  playerCount: number = 6,
  overrides: Partial<LocalGameState> = {},
): LocalGameState {
  const players = new Map<
    number,
    LocalGameState['players'] extends Map<number, infer V> ? V : never
  >();
  for (let i = 1; i <= playerCount; i++) {
    players.set(i, null); // All seats empty by default
  }
  return {
    template: {
      id: 'standard-6',
      playerCount: 6,
      roles: ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'],
    },
    players,
    actions: new Map(),
    wolfVotes: new Map(),
    status: GameStatus.unseated,
    currentActionerIndex: 0,
    lastNightDeaths: [],
    ...overrides,
  } as LocalGameState;
}

function createMockBroadcastCoordinator(): jest.Mocked<BroadcastCoordinator> {
  return {
    broadcastSeatActionAck: jest.fn().mockResolvedValue(undefined),
    sendSeatActionRequest: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<BroadcastCoordinator>;
}

function createMockConfig(
  state: LocalGameState | null,
  overrides: Partial<SeatManagerConfig> = {},
): SeatManagerConfig {
  let mySeatNumber: number | null = null;
  const mockBroadcastCoordinator = createMockBroadcastCoordinator();

  return {
    isHost: () => true,
    getMyUid: () => 'test-uid-001',
    getState: () => state,
    setMySeatNumber: (seat) => {
      mySeatNumber = seat;
    },
    getMySeatNumber: () => mySeatNumber,
    broadcastState: jest.fn().mockResolvedValue(undefined),
    notifyListeners: jest.fn(),
    broadcastCoordinator: mockBroadcastCoordinator,
    // StateManager callbacks
    setSeatPlayer: jest.fn((seat, player) => {
      state?.players.set(seat, player);
    }),
    clearSeat: jest.fn((seat) => {
      state?.players.set(seat, null);
    }),
    clearSeatsByUid: jest.fn((uid, skipSeat) => {
      if (!state) return;
      for (const [seat, player] of state.players.entries()) {
        if (player?.uid === uid && seat !== skipSeat) {
          state.players.set(seat, null);
        }
      }
    }),
    updateSeatStatus: jest.fn(() => {
      if (!state) return;
      const allSeated = Array.from(state.players.values()).every((p) => p !== null);
      const anyEmpty = Array.from(state.players.values()).includes(null);
      if (allSeated && state.status === GameStatus.unseated) {
        state.status = GameStatus.seated;
      } else if (anyEmpty && state.status === GameStatus.seated) {
        state.status = GameStatus.unseated;
      }
    }),
    ...overrides,
  };
}

// =============================================================================
// Test Suites
// =============================================================================

describe('SeatManager', () => {
  // ===========================================================================
  // Constructor and Initial State
  // ===========================================================================

  describe('constructor and initial state', () => {
    it('should initialize with null lastSeatError', () => {
      const state = createMockState();
      const config = createMockConfig(state);
      const seatManager = new SeatManager(config);

      expect(seatManager.getLastSeatError()).toBeNull();
    });
  });

  // ===========================================================================
  // Error State Management
  // ===========================================================================

  describe('error state management', () => {
    it('should get and set lastSeatError', () => {
      const state = createMockState();
      const config = createMockConfig(state);
      const seatManager = new SeatManager(config);

      seatManager.setLastSeatError({ seat: 3, reason: 'seat_taken' });
      expect(seatManager.getLastSeatError()).toEqual({ seat: 3, reason: 'seat_taken' });
    });

    it('should clear lastSeatError', () => {
      const state = createMockState();
      const config = createMockConfig(state);
      const seatManager = new SeatManager(config);

      seatManager.setLastSeatError({ seat: 3, reason: 'seat_taken' });
      seatManager.clearLastSeatError();
      expect(seatManager.getLastSeatError()).toBeNull();
    });
  });

  // ===========================================================================
  // Host: Process Seat Actions
  // ===========================================================================

  describe('Host: processSeatAction', () => {
    describe('sit action', () => {
      it('should succeed for empty seat', async () => {
        const state = createMockState();
        const config = createMockConfig(state);
        const seatManager = new SeatManager(config);

        const result = await seatManager.processSeatAction('sit', 1, 'user-001', 'Alice');

        expect(result).toEqual({ success: true });
        expect(state.players.get(1)).toEqual({
          uid: 'user-001',
          seatNumber: 1,
          displayName: 'Alice',
          avatarUrl: undefined,
          role: null,
          hasViewedRole: false,
        });
        expect(config.broadcastState).toHaveBeenCalled();
        expect(config.notifyListeners).toHaveBeenCalled();
      });

      it('should fail for occupied seat', async () => {
        const state = createMockState();
        // Pre-occupy seat 1
        state.players.set(1, {
          uid: 'other-user',
          seatNumber: 1,
          displayName: 'Bob',
          avatarUrl: undefined,
          role: null,
          hasViewedRole: false,
        });
        const config = createMockConfig(state);
        const seatManager = new SeatManager(config);

        const result = await seatManager.processSeatAction('sit', 1, 'user-001', 'Alice');

        expect(result).toEqual({ success: false, reason: 'seat_taken' });
        expect(state.players.get(1)?.uid).toBe('other-user');
        expect(config.broadcastState).not.toHaveBeenCalled();
      });

      it('should clear previous seat when player takes new seat', async () => {
        const state = createMockState();
        // Pre-seat player in seat 2
        state.players.set(2, {
          uid: 'user-001',
          seatNumber: 2,
          displayName: 'Alice',
          avatarUrl: undefined,
          role: null,
          hasViewedRole: false,
        });
        const config = createMockConfig(state);
        const seatManager = new SeatManager(config);

        const result = await seatManager.processSeatAction('sit', 3, 'user-001', 'Alice');

        expect(result).toEqual({ success: true });
        expect(state.players.get(2)).toBeNull(); // Old seat cleared
        expect(state.players.get(3)?.uid).toBe('user-001'); // New seat taken
      });

      it('should track mySeatNumber when sitting as myself', async () => {
        const state = createMockState();
        let trackedSeat: number | null = null;
        const config = createMockConfig(state, {
          getMyUid: () => 'test-uid-001',
          setMySeatNumber: (seat) => {
            trackedSeat = seat;
          },
        });
        const seatManager = new SeatManager(config);

        await seatManager.processSeatAction('sit', 1, 'test-uid-001', 'Me');

        expect(trackedSeat).toBe(1);
      });

      it('should update status to seated when all seats filled', async () => {
        const state = createMockState(2); // 2-player game
        state.players.set(1, {
          uid: 'user-001',
          seatNumber: 1,
          displayName: 'Alice',
          avatarUrl: undefined,
          role: null,
          hasViewedRole: false,
        });
        const config = createMockConfig(state);
        const seatManager = new SeatManager(config);

        await seatManager.processSeatAction('sit', 2, 'user-002', 'Bob');

        expect(state.status).toBe(GameStatus.seated);
      });

      it('should return no_state when state is null', async () => {
        const config = createMockConfig(null);
        const seatManager = new SeatManager(config);

        const result = await seatManager.processSeatAction('sit', 1, 'user-001', 'Alice');

        expect(result).toEqual({ success: false, reason: 'no_state' });
      });
    });

    describe('standup action', () => {
      it('should succeed when player is seated', async () => {
        const state = createMockState();
        state.players.set(1, {
          uid: 'user-001',
          seatNumber: 1,
          displayName: 'Alice',
          avatarUrl: undefined,
          role: null,
          hasViewedRole: false,
        });
        const config = createMockConfig(state);
        const seatManager = new SeatManager(config);

        const result = await seatManager.processSeatAction('standup', 1, 'user-001');

        expect(result).toEqual({ success: true });
        expect(state.players.get(1)).toBeNull();
        expect(config.broadcastState).toHaveBeenCalled();
        expect(config.notifyListeners).toHaveBeenCalled();
      });

      it('should fail when player is not in that seat', async () => {
        const state = createMockState();
        state.players.set(1, {
          uid: 'other-user',
          seatNumber: 1,
          displayName: 'Bob',
          avatarUrl: undefined,
          role: null,
          hasViewedRole: false,
        });
        const config = createMockConfig(state);
        const seatManager = new SeatManager(config);

        const result = await seatManager.processSeatAction('standup', 1, 'user-001');

        expect(result).toEqual({ success: false, reason: 'not_seated' });
        expect(state.players.get(1)?.uid).toBe('other-user');
        expect(config.broadcastState).not.toHaveBeenCalled();
      });

      it('should track mySeatNumber when standing up as myself', async () => {
        const state = createMockState();
        state.players.set(1, {
          uid: 'test-uid-001',
          seatNumber: 1,
          displayName: 'Me',
          avatarUrl: undefined,
          role: null,
          hasViewedRole: false,
        });
        let trackedSeat: number | null = 1;
        const config = createMockConfig(state, {
          getMyUid: () => 'test-uid-001',
          setMySeatNumber: (seat) => {
            trackedSeat = seat;
          },
        });
        const seatManager = new SeatManager(config);

        await seatManager.processSeatAction('standup', 1, 'test-uid-001');

        expect(trackedSeat).toBeNull();
      });

      it('should revert status to unseated when player leaves', async () => {
        const state = createMockState(2);
        state.status = GameStatus.seated;
        state.players.set(1, {
          uid: 'user-001',
          seatNumber: 1,
          displayName: 'Alice',
          avatarUrl: undefined,
          role: null,
          hasViewedRole: false,
        });
        state.players.set(2, {
          uid: 'user-002',
          seatNumber: 2,
          displayName: 'Bob',
          avatarUrl: undefined,
          role: null,
          hasViewedRole: false,
        });
        const config = createMockConfig(state);
        const seatManager = new SeatManager(config);

        await seatManager.processSeatAction('standup', 1, 'user-001');

        expect(state.status).toBe(GameStatus.unseated);
      });
    });

    describe('unknown action', () => {
      it('should return unknown_action for invalid action', async () => {
        const state = createMockState();
        const config = createMockConfig(state);
        const seatManager = new SeatManager(config);

        // @ts-expect-error - Testing invalid action
        const result = await seatManager.processSeatAction('invalid', 1, 'user-001');

        expect(result).toEqual({ success: false, reason: 'unknown_action' });
      });
    });
  });

  // ===========================================================================
  // Host: Handle Seat Action Request
  // ===========================================================================

  describe('Host: handleSeatActionRequest', () => {
    it('should process sit request and send ACK', async () => {
      const state = createMockState();
      const config = createMockConfig(state);
      const seatManager = new SeatManager(config);

      const request: SeatActionRequest = {
        type: 'SEAT_ACTION_REQUEST',
        requestId: 'req-001',
        action: 'sit',
        seat: 1,
        uid: 'user-001',
        displayName: 'Alice',
      };

      await seatManager.handleSeatActionRequest(request);

      expect(state.players.get(1)?.uid).toBe('user-001');
      expect(config.broadcastCoordinator.broadcastSeatActionAck).toHaveBeenCalledWith({
        requestId: 'req-001',
        toUid: 'user-001',
        success: true,
        seat: 1,
        reason: undefined,
      });
    });

    it('should reject sit request for occupied seat', async () => {
      const state = createMockState();
      state.players.set(1, {
        uid: 'other-user',
        seatNumber: 1,
        displayName: 'Bob',
        avatarUrl: undefined,
        role: null,
        hasViewedRole: false,
      });
      const config = createMockConfig(state);
      const seatManager = new SeatManager(config);

      const request: SeatActionRequest = {
        type: 'SEAT_ACTION_REQUEST',
        requestId: 'req-001',
        action: 'sit',
        seat: 1,
        uid: 'user-001',
        displayName: 'Alice',
      };

      await seatManager.handleSeatActionRequest(request);

      expect(state.players.get(1)?.uid).toBe('other-user');
      expect(config.broadcastCoordinator.broadcastSeatActionAck).toHaveBeenCalledWith({
        requestId: 'req-001',
        toUid: 'user-001',
        success: false,
        seat: 1,
        reason: 'seat_taken',
      });
    });

    it('should do nothing when state is null', async () => {
      const config = createMockConfig(null);
      const seatManager = new SeatManager(config);

      const request: SeatActionRequest = {
        type: 'SEAT_ACTION_REQUEST',
        requestId: 'req-001',
        action: 'sit',
        seat: 1,
        uid: 'user-001',
        displayName: 'Alice',
      };

      await seatManager.handleSeatActionRequest(request);

      expect(config.broadcastCoordinator.broadcastSeatActionAck).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Player: Handle Seat Action ACK
  // ===========================================================================

  describe('Player: handleSeatActionAck', () => {
    it('should ignore ACK not addressed to me', () => {
      const state = createMockState();
      const config = createMockConfig(state, { getMyUid: () => 'my-uid' });
      const seatManager = new SeatManager(config);

      const ack: SeatActionAck = {
        type: 'SEAT_ACTION_ACK',
        requestId: 'req-001',
        toUid: 'other-uid',
        success: true,
        seat: 1,
      };

      seatManager.handleSeatActionAck(ack);

      // Should not throw or call anything
      expect(config.notifyListeners).not.toHaveBeenCalled();
    });

    it('should ignore ACK when no pending request', () => {
      const state = createMockState();
      const config = createMockConfig(state, { getMyUid: () => 'my-uid' });
      const seatManager = new SeatManager(config);

      const ack: SeatActionAck = {
        type: 'SEAT_ACTION_ACK',
        requestId: 'req-001',
        toUid: 'my-uid',
        success: true,
        seat: 1,
      };

      seatManager.handleSeatActionAck(ack);

      // Should not throw or call anything
      expect(config.notifyListeners).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Unified API: takeSeat / leaveSeat
  // ===========================================================================

  describe('Unified API: takeSeat', () => {
    it('Host should process directly', async () => {
      const state = createMockState();
      const config = createMockConfig(state, { isHost: () => true });
      const seatManager = new SeatManager(config);

      const result = await seatManager.takeSeat(1, 'Alice');

      expect(result).toBe(true);
      expect(state.players.get(1)?.displayName).toBe('Alice');
    });

    it('should return false when uid is null', async () => {
      const state = createMockState();
      const config = createMockConfig(state, { getMyUid: () => null });
      const seatManager = new SeatManager(config);

      const result = await seatManager.takeSeat(1, 'Alice');

      expect(result).toBe(false);
    });
  });

  describe('Unified API: takeSeatWithAck', () => {
    it('Host should return detailed result', async () => {
      const state = createMockState();
      const config = createMockConfig(state, { isHost: () => true });
      const seatManager = new SeatManager(config);

      const result = await seatManager.takeSeatWithAck(1, 'Alice');

      expect(result).toEqual({ success: true });
    });

    it('should return not_authenticated when uid is null', async () => {
      const state = createMockState();
      const config = createMockConfig(state, { getMyUid: () => null });
      const seatManager = new SeatManager(config);

      const result = await seatManager.takeSeatWithAck(1, 'Alice');

      expect(result).toEqual({ success: false, reason: 'not_authenticated' });
    });
  });

  describe('Unified API: leaveSeat', () => {
    it('Host should process directly', async () => {
      const state = createMockState();
      state.players.set(1, {
        uid: 'test-uid-001',
        seatNumber: 1,
        displayName: 'Me',
        avatarUrl: undefined,
        role: null,
        hasViewedRole: false,
      });
      const config = createMockConfig(state, {
        isHost: () => true,
        getMyUid: () => 'test-uid-001',
        getMySeatNumber: () => 1,
      });
      const seatManager = new SeatManager(config);

      const result = await seatManager.leaveSeat();

      expect(result).toBe(true);
      expect(state.players.get(1)).toBeNull();
    });

    it('should return false when not seated', async () => {
      const state = createMockState();
      const config = createMockConfig(state, { getMySeatNumber: () => null });
      const seatManager = new SeatManager(config);

      const result = await seatManager.leaveSeat();

      expect(result).toBe(false);
    });
  });

  describe('Unified API: leaveSeatWithAck', () => {
    it('should return not_seated when mySeat is null', async () => {
      const state = createMockState();
      const config = createMockConfig(state, { getMySeatNumber: () => null });
      const seatManager = new SeatManager(config);

      const result = await seatManager.leaveSeatWithAck();

      expect(result).toEqual({ success: false, reason: 'not_seated' });
    });
  });

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  describe('cleanup', () => {
    it('should clear lastSeatError', () => {
      const state = createMockState();
      const config = createMockConfig(state);
      const seatManager = new SeatManager(config);

      seatManager.setLastSeatError({ seat: 1, reason: 'seat_taken' });
      seatManager.cleanup();

      expect(seatManager.getLastSeatError()).toBeNull();
    });
  });

  // ===========================================================================
  // Player: sendSeatActionWithAck (via takeSeat when not Host)
  // ===========================================================================

  describe('Player: sendSeatActionWithAck', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should send request to host and wait for ACK', async () => {
      const state = createMockState();
      const mockBroadcastCoordinator = createMockBroadcastCoordinator();
      const config = createMockConfig(state, {
        isHost: () => false,
        broadcastCoordinator: mockBroadcastCoordinator,
      });
      const seatManager = new SeatManager(config);

      // Start the seat action
      const resultPromise = seatManager.takeSeat(1, 'Alice');

      // Wait for microtasks to process
      await Promise.resolve();

      // Verify request was sent
      expect(mockBroadcastCoordinator.sendSeatActionRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sit',
          seat: 1,
          displayName: 'Alice',
        }),
      );

      // Simulate ACK from host
      const requestId = (mockBroadcastCoordinator.sendSeatActionRequest as jest.Mock).mock
        .calls[0][0].requestId;
      seatManager.handleSeatActionAck({
        type: 'SEAT_ACTION_ACK',
        requestId,
        toUid: 'test-uid-001',
        success: true,
        seat: 1,
      });

      const result = await resultPromise;
      expect(result).toBe(true);
    });

    it('should timeout if no ACK received', async () => {
      const state = createMockState();
      const mockBroadcastCoordinator = createMockBroadcastCoordinator();
      const config = createMockConfig(state, {
        isHost: () => false,
        broadcastCoordinator: mockBroadcastCoordinator,
      });
      const seatManager = new SeatManager(config);

      // Start the seat action
      const resultPromise = seatManager.takeSeat(1, 'Alice');

      // Wait for microtasks
      await Promise.resolve();

      // Fast-forward past timeout
      jest.advanceTimersByTime(6000);

      const result = await resultPromise;
      expect(result).toBe(false);
    });

    it('should set lastSeatError on failed ACK with seat_taken', async () => {
      const state = createMockState();
      const mockBroadcastCoordinator = createMockBroadcastCoordinator();
      const config = createMockConfig(state, {
        isHost: () => false,
        broadcastCoordinator: mockBroadcastCoordinator,
      });
      const seatManager = new SeatManager(config);

      // Start the seat action
      const resultPromise = seatManager.takeSeat(1, 'Alice');

      // Wait for microtasks
      await Promise.resolve();

      // Simulate failed ACK
      const requestId = (mockBroadcastCoordinator.sendSeatActionRequest as jest.Mock).mock
        .calls[0][0].requestId;
      seatManager.handleSeatActionAck({
        type: 'SEAT_ACTION_ACK',
        requestId,
        toUid: 'test-uid-001',
        success: false,
        seat: 1,
        reason: 'seat_taken',
      });

      const result = await resultPromise;
      expect(result).toBe(false);
      expect(seatManager.getLastSeatError()).toEqual({ seat: 1, reason: 'seat_taken' });
    });

    it('should cancel previous pending action when new action starts', async () => {
      const state = createMockState();
      const mockBroadcastCoordinator = createMockBroadcastCoordinator();
      const config = createMockConfig(state, {
        isHost: () => false,
        broadcastCoordinator: mockBroadcastCoordinator,
      });
      const seatManager = new SeatManager(config);

      // Start first action
      const promise1 = seatManager.takeSeat(1, 'Alice');
      await Promise.resolve();

      // Start second action (should cancel first)
      const promise2 = seatManager.takeSeat(2, 'Bob');
      await Promise.resolve();

      // First promise should reject
      await expect(promise1).rejects.toThrow('Cancelled by new action');

      // Complete second action
      const requestId = (mockBroadcastCoordinator.sendSeatActionRequest as jest.Mock).mock
        .calls[1][0].requestId;
      seatManager.handleSeatActionAck({
        type: 'SEAT_ACTION_ACK',
        requestId,
        toUid: 'test-uid-001',
        success: true,
        seat: 2,
      });

      const result = await promise2;
      expect(result).toBe(true);
    });
  });
});
