/**
 * GameStore Unit Tests
 */

import { GameStore } from '@werewolf/game-engine/engine/store/GameStore';
import type { GameState } from '@werewolf/game-engine/engine/store/types';

function createMinimalState(overrides?: Partial<GameState>): GameState {
  return {
    roomCode: 'TEST',
    hostUid: 'host-1',
    status: 'unseated',
    templateRoles: ['villager', 'wolf', 'seer'],
    players: { 0: null, 1: null, 2: null },
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    ...overrides,
  };
}

describe('GameStore', () => {
  let store: GameStore;

  beforeEach(() => {
    store = new GameStore();
  });

  describe('initial state', () => {
    it('should have null state initially', () => {
      expect(store.getState()).toBeNull();
    });

    it('should have revision 0 initially', () => {
      expect(store.getRevision()).toBe(0);
    });
  });

  describe('initialize()', () => {
    it('should set state and revision to 1', () => {
      const state = createMinimalState();
      store.initialize(state);

      expect(store.getState()).toEqual(state);
      expect(store.getRevision()).toBe(1);
    });

    it('should notify listeners', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      const state = createMinimalState();
      store.initialize(state);

      expect(listener).toHaveBeenCalledWith(state, 1);
    });
  });

  describe('setState()', () => {
    it('should update state and increment revision', () => {
      store.initialize(createMinimalState());
      const initialRevision = store.getRevision();

      const newState = createMinimalState({ status: 'seated' });
      store.setState(newState);

      expect(store.getState()?.status).toBe('seated');
      expect(store.getRevision()).toBe(initialRevision + 1);
    });

    it('should notify listeners on each setState', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      store.initialize(createMinimalState());
      store.setState(createMinimalState({ status: 'seated' }));

      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateState()', () => {
    it('should apply updater function', () => {
      store.initialize(createMinimalState());

      store.updateState((state) => ({
        ...state,
        status: 'assigned',
      }));

      expect(store.getState()?.status).toBe('assigned');
    });

    it('should throw if no state initialized', () => {
      expect(() => {
        store.updateState((state) => state);
      }).toThrow('Cannot update state: no state initialized');
    });

    it('should increment revision', () => {
      store.initialize(createMinimalState());
      const initialRevision = store.getRevision();

      store.updateState((state) => ({ ...state, status: 'seated' }));

      expect(store.getRevision()).toBe(initialRevision + 1);
    });
  });

  describe('applySnapshot()', () => {
    it('should apply snapshot with higher revision', () => {
      store.initialize(createMinimalState());
      const newState = createMinimalState({ status: 'ongoing' });

      store.applySnapshot(newState, 10);

      expect(store.getState()?.status).toBe('ongoing');
      expect(store.getRevision()).toBe(10);
    });

    it('should ignore snapshot with lower revision', () => {
      store.initialize(createMinimalState());
      store.setState(createMinimalState({ status: 'seated' })); // revision = 2
      store.setState(createMinimalState({ status: 'assigned' })); // revision = 3

      const oldState = createMinimalState({ status: 'unseated' });
      store.applySnapshot(oldState, 1); // lower than current

      expect(store.getState()?.status).toBe('assigned');
      expect(store.getRevision()).toBe(3);
    });

    it('should ignore snapshot with equal revision', () => {
      store.initialize(createMinimalState({ status: 'seated' }));
      const oldState = createMinimalState({ status: 'unseated' });

      store.applySnapshot(oldState, 1); // equal to current

      expect(store.getState()?.status).toBe('seated');
    });

    it('should normalize snapshot to ensure Host/Player shape consistency (anti-drift)', () => {
      // Simulate reconnect scenario: incoming snapshot has mixed number/string keys
      // (e.g., from JSON serialization or old client)
      const incomingSnapshot = createMinimalState({
        status: 'ongoing',
        currentNightResults: {
          // Deliberately use number keys (simulates pre-normalize/JSON parse scenario)
          wolfVotesBySeat: { 1: 3, 2: 3, 3: 5 } as unknown as Record<string, number>,
        },
      });

      store.applySnapshot(incomingSnapshot, 5);

      // After applySnapshot, wolfVotesBySeat keys should be normalized to strings
      const result = store.getState()!;
      expect(result.currentNightResults).toBeDefined();

      const wolfVotes = result.currentNightResults!.wolfVotesBySeat!;
      const keys = Object.keys(wolfVotes);

      // All keys must be strings (not number-like objects)
      expect(keys).toEqual(['1', '2', '3']);
      // Values preserved
      expect(wolfVotes['1']).toBe(3);
      expect(wolfVotes['2']).toBe(3);
      expect(wolfVotes['3']).toBe(5);
    });
  });

  describe('subscribe()', () => {
    it('should return unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = store.subscribe(listener);

      store.initialize(createMinimalState());
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      store.setState(createMinimalState({ status: 'seated' }));
      expect(listener).toHaveBeenCalledTimes(1); // no additional calls
    });

    it('should support multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      store.subscribe(listener1);
      store.subscribe(listener2);

      store.initialize(createMinimalState());

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();

      store.subscribe(errorListener);
      store.subscribe(normalListener);

      // Should not throw, and should call other listeners
      expect(() => {
        store.initialize(createMinimalState());
      }).not.toThrow();

      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('reset()', () => {
    it('should clear state and revision', () => {
      store.initialize(createMinimalState());
      store.reset();

      expect(store.getState()).toBeNull();
      expect(store.getRevision()).toBe(0);
    });

    it('should notify listeners with null state on reset', () => {
      const listener = jest.fn();
      store.subscribe(listener);
      store.initialize(createMinimalState());

      expect(listener).toHaveBeenCalledTimes(1);

      store.reset();

      // reset() now notifies listeners with null state
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith(null, 0);
    });

    it('should keep listeners after reset', () => {
      const listener = jest.fn();
      store.subscribe(listener);
      store.initialize(createMinimalState());

      store.reset();
      // After reset, listeners are kept, so initialize again should notify
      store.initialize(createMinimalState());

      expect(listener).toHaveBeenCalledTimes(3); // init + reset + init again
    });
  });

  describe('destroy()', () => {
    it('should clear state, revision, and all listeners', () => {
      const listener = jest.fn();
      store.subscribe(listener);
      store.initialize(createMinimalState());

      store.destroy();

      expect(store.getState()).toBeNull();
      expect(store.getRevision()).toBe(0);

      // After destroy, listeners are cleared, so initialize again shouldn't notify
      store.initialize(createMinimalState());

      expect(listener).toHaveBeenCalledTimes(1); // only the first initialize
    });
  });

  describe('getListenerCount()', () => {
    it('should return 0 initially', () => {
      expect(store.getListenerCount()).toBe(0);
    });

    it('should return correct count after subscribing', () => {
      store.subscribe(() => {});
      store.subscribe(() => {});
      store.subscribe(() => {});

      expect(store.getListenerCount()).toBe(3);
    });

    it('should decrement count when unsubscribing', () => {
      const unsub1 = store.subscribe(() => {});
      const unsub2 = store.subscribe(() => {});
      store.subscribe(() => {});

      expect(store.getListenerCount()).toBe(3);

      unsub1();
      expect(store.getListenerCount()).toBe(2);

      unsub2();
      expect(store.getListenerCount()).toBe(1);
    });

    it('should return 0 after destroy', () => {
      store.subscribe(() => {});
      store.subscribe(() => {});

      expect(store.getListenerCount()).toBe(2);

      store.destroy();

      expect(store.getListenerCount()).toBe(0);
    });

    it('should preserve count after reset (listeners not cleared)', () => {
      store.subscribe(() => {});
      store.subscribe(() => {});

      expect(store.getListenerCount()).toBe(2);

      store.reset();

      // reset() does NOT clear listeners
      expect(store.getListenerCount()).toBe(2);
    });
  });
});
