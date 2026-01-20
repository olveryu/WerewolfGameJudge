/**
 * StateManager Unit Tests
 *
 * Tests the core state management functionality:
 * - State initialization and reset
 * - State updates and revision tracking
 * - Listener notifications
 * - BroadcastState conversion (Local → Broadcast → Local)
 */

import { StateManager } from '../StateManager';
import { GameStatus, LocalGameState, LocalPlayer } from '../../types/GameStateTypes';
import { GameTemplate } from '../../../models/Template';
import type { RoleId } from '../../../models/roles';
import type { BroadcastGameState } from '../../BroadcastService';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestTemplate(): GameTemplate {
  return {
    name: 'Test Template',
    roles: ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'] as RoleId[],
    numberOfPlayers: 6,
  };
}

function createTestPlayer(seat: number, uid?: string, role: RoleId | null = null): LocalPlayer {
  return {
    uid: uid ?? `player_${seat}`,
    seatNumber: seat,
    displayName: `Player ${seat + 1}`,
    avatarUrl: undefined,
    role,
    hasViewedRole: false,
  };
}

function createBroadcastState(overrides?: Partial<BroadcastGameState>): BroadcastGameState {
  return {
    roomCode: 'WXYZ',
    hostUid: 'remote_host',
    status: GameStatus.seated,
    templateRoles: ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'] as RoleId[],
    players: {
      0: { uid: 'p0', seatNumber: 0, displayName: 'P0', hasViewedRole: false },
      1: { uid: 'p1', seatNumber: 1, displayName: 'P1', hasViewedRole: false },
    },
    currentActionerIndex: 1,
    isAudioPlaying: false,
    wolfVoteStatus: {},
    ...overrides,
  };
}

function createTestState(overrides?: Partial<LocalGameState>): LocalGameState {
  const template = createTestTemplate();
  const players = new Map<number, LocalPlayer | null>();

  // Fill all seats with players
  for (let i = 0; i < template.numberOfPlayers; i++) {
    players.set(i, createTestPlayer(i));
  }

  return {
    roomCode: 'ABCD',
    hostUid: 'host_uid',
    status: GameStatus.unseated,
    template,
    players,
    actions: new Map(),
    wolfVotes: new Map(),
    currentActionerIndex: -1, // -1 means no current actioner
    isAudioPlaying: false,
    lastNightDeaths: [],
    nightmareBlockedSeat: undefined,
    wolfKillDisabled: false,
    currentNightResults: {},
    witchContext: undefined,
    seerReveal: undefined,
    psychicReveal: undefined,
    gargoyleReveal: undefined,
    wolfRobotReveal: undefined,
    confirmStatus: undefined,
    actionRejected: undefined,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('StateManager', () => {
  let manager: StateManager;

  beforeEach(() => {
    manager = new StateManager();
  });

  // ===========================================================================
  // Initialization and Reset
  // ===========================================================================

  describe('initialization and reset', () => {
    it('should start with null state', () => {
      expect(manager.getState()).toBeNull();
      expect(manager.hasState()).toBe(false);
      expect(manager.getRevision()).toBe(0);
    });

    it('should initialize with provided state', () => {
      const state = createTestState();
      manager.initialize(state);

      expect(manager.hasState()).toBe(true);
      expect(manager.getState()).toBe(state);
      expect(manager.getRevision()).toBe(0); // initialize doesn't increment revision
    });

    it('should reset state', () => {
      const state = createTestState();
      manager.initialize(state);
      manager.updateState(() => ({ status: GameStatus.seated }));

      expect(manager.getRevision()).toBe(1);

      manager.reset();

      expect(manager.getState()).toBeNull();
      expect(manager.hasState()).toBe(false);
      expect(manager.getRevision()).toBe(0);
    });
  });

  // ===========================================================================
  // State Updates
  // ===========================================================================

  describe('state updates', () => {
    beforeEach(() => {
      manager.initialize(createTestState());
    });

    it('should update state with partial updates', () => {
      manager.updateState(() => ({ status: GameStatus.seated }));

      expect(manager.getState()?.status).toBe(GameStatus.seated);
    });

    it('should increment revision on each update', () => {
      expect(manager.getRevision()).toBe(0);

      manager.updateState(() => ({ status: GameStatus.seated }));
      expect(manager.getRevision()).toBe(1);

      manager.updateState(() => ({ status: GameStatus.assigned }));
      expect(manager.getRevision()).toBe(2);

      manager.updateState(() => ({ status: GameStatus.ready }));
      expect(manager.getRevision()).toBe(3);
    });

    it('should provide current state to updater function', () => {
      manager.updateState(() => ({ status: GameStatus.seated }));

      let capturedStatus: GameStatus | undefined;
      manager.updateState((current) => {
        capturedStatus = current.status;
        return { status: GameStatus.assigned };
      });

      expect(capturedStatus).toBe(GameStatus.seated);
    });

    it('should throw when updating uninitialized state', () => {
      const uninitializedManager = new StateManager();

      // NOSONAR: nested function in expect().toThrow() is standard Jest pattern
      expect(() => {
        uninitializedManager.updateState(() => ({ status: GameStatus.seated })); // NOSONAR
      }).toThrow('[StateManager] Cannot update: state not initialized');
    });

    it('should support batchUpdate convenience method', () => {
      manager.batchUpdate({
        status: GameStatus.seated,
        isAudioPlaying: true,
      });

      expect(manager.getState()?.status).toBe(GameStatus.seated);
      expect(manager.getState()?.isAudioPlaying).toBe(true);
      expect(manager.getRevision()).toBe(1);
    });
  });

  // ===========================================================================
  // Listeners
  // ===========================================================================

  describe('listeners', () => {
    beforeEach(() => {
      manager.initialize(createTestState());
    });

    it('should call listener immediately on subscribe if state exists', () => {
      const listener = jest.fn();
      manager.subscribe(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          roomCode: 'ABCD',
        }),
      );
    });

    it('should not call listener immediately if no state', () => {
      const emptyManager = new StateManager();
      const listener = jest.fn();
      emptyManager.subscribe(listener);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should notify listeners on state update', () => {
      const listener = jest.fn();
      manager.subscribe(listener);
      listener.mockClear();

      manager.updateState(() => ({ status: GameStatus.seated }));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          status: GameStatus.seated,
        }),
      );
    });

    it('should support multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      manager.subscribe(listener1);
      manager.subscribe(listener2);
      listener1.mockClear();
      listener2.mockClear();

      manager.updateState(() => ({ status: GameStatus.seated }));

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe correctly', () => {
      const listener = jest.fn();
      const unsubscribe = manager.subscribe(listener);
      listener.mockClear();

      unsubscribe();

      manager.updateState(() => ({ status: GameStatus.seated }));

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();

      manager.subscribe(errorListener);
      manager.subscribe(normalListener);

      // Clear initial calls
      errorListener.mockClear();
      normalListener.mockClear();

      // Should not throw - NOSONAR: nested function in expect().not.toThrow() is standard Jest pattern
      expect(() => {
        manager.updateState(() => ({ status: GameStatus.seated })); // NOSONAR
      }).not.toThrow();

      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // onStateChange Callback
  // ===========================================================================

  describe('onStateChange callback', () => {
    it('should call onStateChange after update', () => {
      const onStateChange = jest.fn();
      const managerWithCallback = new StateManager({ onStateChange });
      managerWithCallback.initialize(createTestState());

      managerWithCallback.updateState(() => ({ status: GameStatus.seated }));

      expect(onStateChange).toHaveBeenCalledTimes(1);
      expect(onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ status: GameStatus.seated }),
        1, // revision
      );
    });

    it('should not call onStateChange on initialize', () => {
      const onStateChange = jest.fn();
      const managerWithCallback = new StateManager({ onStateChange });

      managerWithCallback.initialize(createTestState());

      expect(onStateChange).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // BroadcastState Conversion
  // ===========================================================================

  describe('toBroadcastState', () => {
    beforeEach(() => {
      manager.initialize(createTestState());
    });

    it('should convert LocalGameState to BroadcastGameState', () => {
      const broadcast = manager.toBroadcastState();

      expect(broadcast.roomCode).toBe('ABCD');
      expect(broadcast.hostUid).toBe('host_uid');
      expect(broadcast.status).toBe(GameStatus.unseated);
      expect(broadcast.templateRoles).toEqual([
        'wolf',
        'wolf',
        'villager',
        'villager',
        'seer',
        'witch',
      ]);
    });

    it('should convert players Map to Record', () => {
      const broadcast = manager.toBroadcastState();

      expect(typeof broadcast.players).toBe('object');
      expect(broadcast.players[0]).toEqual(
        expect.objectContaining({
          uid: 'player_0',
          seatNumber: 0,
          displayName: 'Player 1',
        }),
      );
    });

    it('should include wolf vote status', () => {
      manager.updateState((state) => {
        state.wolfVotes.set(0, 2);
        state.wolfVotes.set(1, 2);
        return {};
      });

      const broadcast = manager.toBroadcastState();

      expect(broadcast.wolfVoteStatus).toEqual({
        0: true,
        1: true,
      });
    });

    it('should include nightmare blocked seat', () => {
      manager.updateState((state) => {
        state.actions.set('nightmare', { kind: 'target', targetSeat: 3 });
        return {};
      });

      const broadcast = manager.toBroadcastState();

      expect(broadcast.nightmareBlockedSeat).toBe(3);
    });

    it('should include role-specific context', () => {
      manager.updateState(() => ({
        witchContext: { killedIndex: 2, canSave: true, canPoison: true },
        seerReveal: { targetSeat: 3, result: '好人' },
      }));

      const broadcast = manager.toBroadcastState();

      expect(broadcast.witchContext).toEqual({ killedIndex: 2, canSave: true, canPoison: true });
      expect(broadcast.seerReveal).toEqual({ targetSeat: 3, result: '好人' });
    });

    it('should throw when state not initialized', () => {
      const emptyManager = new StateManager();

      expect(() => {
        emptyManager.toBroadcastState();
      }).toThrow('[StateManager] Cannot convert: state not initialized');
    });
  });

  // ===========================================================================
  // applyBroadcastState
  // ===========================================================================

  describe('applyBroadcastState', () => {
    it('should apply broadcast state and return mySeat', () => {
      const broadcast = createBroadcastState();

      const result = manager.applyBroadcastState(broadcast, 1, 'p0');

      expect(result.applied).toBe(true);
      expect(result.mySeat).toBe(0);
      expect(manager.getState()?.roomCode).toBe('WXYZ');
      expect(manager.getRevision()).toBe(1);
    });

    it('should skip stale updates', () => {
      const broadcast1 = createBroadcastState({ status: GameStatus.seated });
      const broadcast2 = createBroadcastState({ status: GameStatus.assigned });

      manager.applyBroadcastState(broadcast1, 5, 'p0');

      // Try to apply older revision
      const result = manager.applyBroadcastState(broadcast2, 3, 'p0');

      expect(result.applied).toBe(false);
      expect(manager.getState()?.status).toBe(GameStatus.seated);
      expect(manager.getRevision()).toBe(5);
    });

    it('should return null mySeat when not found', () => {
      const broadcast = createBroadcastState();

      const result = manager.applyBroadcastState(broadcast, 1, 'unknown_uid');

      expect(result.applied).toBe(true);
      expect(result.mySeat).toBeNull();
    });

    it('should rebuild wolfVotes from wolfVoteStatus', () => {
      const broadcast = createBroadcastState({
        wolfVoteStatus: { 0: true, 1: true },
      });

      manager.applyBroadcastState(broadcast, 1, 'p0');

      const state = manager.getState();
      expect(state?.wolfVotes.size).toBe(2);
      expect(state?.wolfVotes.has(0)).toBe(true);
      expect(state?.wolfVotes.has(1)).toBe(true);
    });

    it('should recreate template from templateRoles', () => {
      const broadcast = createBroadcastState({
        templateRoles: [
          'wolf',
          'wolf',
          'wolf',
          'seer',
          'witch',
          'guard',
          'villager',
          'villager',
          'villager',
        ] as RoleId[],
      });

      manager.applyBroadcastState(broadcast, 1, 'p0');

      const state = manager.getState();
      expect(state?.template.numberOfPlayers).toBe(9);
      expect(state?.template.roles.length).toBe(9);
    });
  });

  // ===========================================================================
  // Round-Trip Conversion
  // ===========================================================================

  describe('round-trip conversion', () => {
    it('should preserve essential data through Local → Broadcast → Local', () => {
      // Create a state with various data
      const originalState = createTestState({
        status: GameStatus.ongoing,
        currentActionerIndex: 2,
        isAudioPlaying: true,
        wolfKillDisabled: true,
        witchContext: { killedIndex: 3, canSave: true, canPoison: false },
        seerReveal: { targetSeat: 4, result: '狼人' },
      });

      // Initialize with original state
      manager.initialize(originalState);

      // Convert to broadcast
      const broadcast = manager.toBroadcastState();

      // Create new manager and apply broadcast
      const receivingManager = new StateManager();
      receivingManager.applyBroadcastState(broadcast, 1, 'player_0');

      const receivedState = receivingManager.getState();

      // Verify essential data preserved
      expect(receivedState?.roomCode).toBe('ABCD');
      expect(receivedState?.hostUid).toBe('host_uid');
      expect(receivedState?.status).toBe(GameStatus.ongoing);
      expect(receivedState?.currentActionerIndex).toBe(2);
      expect(receivedState?.isAudioPlaying).toBe(true);
      expect(receivedState?.wolfKillDisabled).toBe(true);
      expect(receivedState?.witchContext).toEqual({
        killedIndex: 3,
        canSave: true,
        canPoison: false,
      });
      expect(receivedState?.seerReveal).toEqual({ targetSeat: 4, result: '狼人' });
      expect(receivedState?.template.numberOfPlayers).toBe(6);
    });
  });
});
