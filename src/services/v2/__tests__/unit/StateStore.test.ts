/**
 * StateStore Unit Tests
 */

import { StateStore, GameStatus } from '../../infra/StateStore';
import type { LocalGameState, LocalPlayer } from '../../infra/StateStore';
import type { GameTemplate } from '../../../../models/Template';

// =============================================================================
// Test Helpers
// =============================================================================

function createMockTemplate(roles: string[] = ['wolf', 'seer', 'villager']): GameTemplate {
  return {
    numberOfPlayers: roles.length,
    roles: roles as import('../../../../models/roles').RoleId[],
    name: 'Test Template',
  };
}

function createMockPlayer(seat: number, role: string | null = null): LocalPlayer {
  return {
    uid: `player_${seat}`,
    seatNumber: seat,
    displayName: `Player ${seat}`,
    avatarUrl: undefined,
    role: role as import('../../../../models/roles').RoleId | null,
    hasViewedRole: false,
  };
}

function createMockState(overrides: Partial<LocalGameState> = {}): LocalGameState {
  const players = new Map<number, LocalPlayer | null>();
  players.set(0, createMockPlayer(0, 'wolf'));
  players.set(1, createMockPlayer(1, 'seer'));
  players.set(2, createMockPlayer(2, 'villager'));

  return {
    roomCode: 'TEST',
    hostUid: 'host_uid',
    status: GameStatus.unseated,
    template: createMockTemplate(),
    players,
    actions: new Map(),
    wolfVotes: new Map(),
    currentActionerIndex: 0,
    isAudioPlaying: false,
    lastNightDeaths: [],
    currentNightResults: {},
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('StateStore', () => {
  let store: StateStore;

  beforeEach(() => {
    store = new StateStore();
  });

  describe('initialization', () => {
    it('should start with null state', () => {
      expect(store.getState()).toBeNull();
      expect(store.hasState()).toBe(false);
      expect(store.getRevision()).toBe(0);
    });

    it('should initialize with provided state', () => {
      const state = createMockState();
      store.initialize(state);

      expect(store.getState()).toEqual(state);
      expect(store.hasState()).toBe(true);
      expect(store.getRevision()).toBe(0);
    });
  });

  describe('update', () => {
    it('should update state immutably', () => {
      const state = createMockState();
      store.initialize(state);
      const originalState = store.getState();

      store.update(() => ({ status: GameStatus.ongoing }));

      expect(store.getState()?.status).toBe(GameStatus.ongoing);
      expect(store.getState()).not.toBe(originalState);
    });

    it('should increment revision on each update', () => {
      store.initialize(createMockState());

      store.update(() => ({ status: GameStatus.seated }));
      expect(store.getRevision()).toBe(1);

      store.update(() => ({ status: GameStatus.assigned }));
      expect(store.getRevision()).toBe(2);
    });

    it('should throw if state not initialized', () => {
      expect(() => store.update(() => ({}))).toThrow('Cannot update: state not initialized');
    });

    it('should call onStateChange callback', () => {
      const onStateChange = jest.fn();
      store = new StateStore({ onStateChange });
      store.initialize(createMockState());

      store.update(() => ({ status: GameStatus.ongoing }));

      expect(onStateChange).toHaveBeenCalledTimes(1);
      expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ status: GameStatus.ongoing }), 1);
    });
  });

  describe('subscription', () => {
    it('should notify listener immediately with current state', () => {
      store.initialize(createMockState());
      const listener = jest.fn();

      store.subscribe(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ roomCode: 'TEST' }));
    });

    it('should notify listener on state update', () => {
      store.initialize(createMockState());
      const listener = jest.fn();
      store.subscribe(listener);
      listener.mockClear();

      store.update(() => ({ status: GameStatus.ongoing }));

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe correctly', () => {
      store.initialize(createMockState());
      const listener = jest.fn();
      const unsubscribe = store.subscribe(listener);
      listener.mockClear();

      unsubscribe();
      store.update(() => ({ status: GameStatus.ongoing }));

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      store.initialize(createMockState());
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();

      store.subscribe(errorListener);
      store.subscribe(normalListener);

      // Both should be called initially despite error
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should clear state and listeners', () => {
      store.initialize(createMockState());
      const listener = jest.fn();
      store.subscribe(listener);
      listener.mockClear();

      store.reset();

      expect(store.getState()).toBeNull();
      expect(store.getRevision()).toBe(0);
      // Listener should not be called after reset
      // (because listeners are cleared)
    });
  });

  describe('toBroadcastState', () => {
    it('should convert state to broadcast format', () => {
      store.initialize(createMockState({ status: GameStatus.ongoing }));

      const broadcast = store.toBroadcastState();

      expect(broadcast.roomCode).toBe('TEST');
      expect(broadcast.hostUid).toBe('host_uid');
      expect(broadcast.status).toBe(GameStatus.ongoing);
      expect(broadcast.players[0]?.uid).toBe('player_0');
      expect(broadcast.templateRoles).toEqual(['wolf', 'seer', 'villager']);
    });

    it('should throw if state not initialized', () => {
      expect(() => store.toBroadcastState()).toThrow('Cannot convert: state not initialized');
    });

    it('should include wolf vote status', () => {
      const state = createMockState({ status: GameStatus.ongoing });
      state.wolfVotes.set(0, 1);
      store.initialize(state);

      const broadcast = store.toBroadcastState();

      expect(broadcast.wolfVoteStatus?.[0]).toBe(true);
    });
  });

  describe('applyBroadcastState', () => {
    it('should apply broadcast state', () => {
      const broadcast = {
        roomCode: 'ROOM',
        hostUid: 'host',
        status: GameStatus.ongoing,
        templateRoles: ['wolf', 'seer', 'villager'] as import('../../../../models/roles').RoleId[],
        players: {
          0: { uid: 'p0', seatNumber: 0, displayName: 'P0', avatarUrl: undefined, role: 'wolf' as const, hasViewedRole: true },
          1: { uid: 'p1', seatNumber: 1, displayName: 'P1', avatarUrl: undefined, role: 'seer' as const, hasViewedRole: false },
          2: null,
        },
        currentActionerIndex: 1,
        isAudioPlaying: false,
        wolfVoteStatus: { 0: true },
      };

      const result = store.applyBroadcastState(broadcast, 'p1');

      expect(result.applied).toBe(true);
      expect(result.mySeat).toBe(1);
      expect(store.getState()?.roomCode).toBe('ROOM');
      expect(store.getState()?.players.get(0)?.role).toBe('wolf');
    });
  });

  describe('query helpers', () => {
    beforeEach(() => {
      store.initialize(createMockState());
    });

    it('should find seat by role', () => {
      expect(store.findSeatByRole('wolf')).toBe(0);
      expect(store.findSeatByRole('seer')).toBe(1);
      expect(store.findSeatByRole('hunter')).toBe(-1);
    });

    it('should get seats for role', () => {
      expect(store.getSeatsForRole('wolf')).toEqual([0]);
      expect(store.getSeatsForRole('villager')).toEqual([2]);
    });

    it('should build role map', () => {
      const roleMap = store.buildRoleMap();
      expect(roleMap.get(0)).toBe('wolf');
      expect(roleMap.get(1)).toBe('seer');
      expect(roleMap.get(2)).toBe('villager');
    });

    it('should get role by seat', () => {
      expect(store.getRoleBySeat(0)).toBe('wolf');
      expect(store.getRoleBySeat(99)).toBeNull();
    });

    it('should check if seat is occupied', () => {
      expect(store.isSeatOccupied(0)).toBe(true);
    });

    it('should get number of players', () => {
      expect(store.getNumberOfPlayers()).toBe(3);
    });
  });
});
