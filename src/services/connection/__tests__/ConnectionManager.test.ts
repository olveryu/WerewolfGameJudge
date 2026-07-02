import type { WerewolfState } from '@werewolf/game-engine/werewolf/protocol/types';

import type {
  IRealtimeTransport,
  TransportEventHandlers,
} from '@/services/types/IRealtimeTransport';

import { ConnectionManager, type ConnectionManagerDeps } from '../ConnectionManager';
import { ConnectionState, PING_INTERVAL_MS, PONG_TIMEOUT_MS, SupersededError } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Transport
// ─────────────────────────────────────────────────────────────────────────────

function createMockTransport(): IRealtimeTransport & {
  handlers: TransportEventHandlers;
  connect: jest.Mock;
  disconnect: jest.Mock;
  send: jest.Mock;
} {
  let handlers: TransportEventHandlers = {
    onOpen: jest.fn(),
    onClose: jest.fn(),
    onError: jest.fn(),
    onStateUpdate: jest.fn(),
    onSettleResult: jest.fn(),
    onPong: jest.fn(),
  };

  return {
    get handlers() {
      return handlers;
    },
    connect: jest.fn(),
    disconnect: jest.fn(),
    send: jest.fn(),
    setEventHandlers(h: TransportEventHandlers) {
      handlers = h;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_STATE = { revision: 1 } as unknown as WerewolfState;

function createDeps(overrides?: Partial<ConnectionManagerDeps>) {
  const transport = createMockTransport();
  const deps: ConnectionManagerDeps = {
    transport,
    fetchStateFromDB: jest.fn().mockResolvedValue({ state: MOCK_STATE, revision: 1 }),
    getStateRevision: jest.fn().mockResolvedValue(1),
    onStateUpdate: jest.fn(),
    onFetchedState: jest.fn(),
    ...overrides,
  };
  // Re-assign transport if overrides didn't provide one
  if (!overrides?.transport) {
    deps.transport = transport;
  }
  return { transport: deps.transport as ReturnType<typeof createMockTransport>, deps };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ConnectionManager', () => {
  describe('connectAndWait', () => {
    it('resolves when reaching Connected state', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait('ROOM1', 'USER1');

      // Should call transport.connect
      expect(transport.connect).toHaveBeenCalledWith('ROOM1', 'USER1');

      // Simulate WS open → triggers FETCH_STATE
      transport.handlers.onOpen();

      // Let the async fetch resolve
      await jest.advanceTimersByTimeAsync(0);

      await expect(promise).resolves.toBeUndefined();
      expect(manager.getState()).toBe(ConnectionState.Connected);

      manager.dispose();
    });

    it('rejects on timeout', async () => {
      const { transport: t, deps } = createDeps({
        fetchStateFromDB: jest.fn().mockImplementation(() => new Promise(() => {})), // never resolves
      });
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait('ROOM1', 'USER1', 5000);

      // WS opens but fetch hangs
      t.handlers.onOpen();

      // Advance past timeout
      jest.advanceTimersByTime(5000);

      await expect(promise).rejects.toThrow('timeout');

      manager.dispose();
    });

    it('resolves immediately if already connected to same room', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      // First connect
      const p1 = manager.connectAndWait('ROOM1', 'USER1');
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await p1;

      // Second connect to same room — should re-fetch state but not re-open WS
      const fetchSpy = deps.fetchStateFromDB as jest.Mock;
      const callsBefore = fetchSpy.mock.calls.length;
      await expect(manager.connectAndWait('ROOM1', 'USER1')).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(callsBefore + 1);

      manager.dispose();
    });

    it('rejects when connection enters Disposed state', async () => {
      const { deps } = createDeps();
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait('ROOM1', 'USER1');

      manager.dispose();

      await expect(promise).rejects.toThrow();
    });

    it('rejects immediately if already disposed', async () => {
      const { deps } = createDeps();
      const manager = new ConnectionManager(deps);
      manager.dispose();

      await expect(manager.connectAndWait('ROOM1', 'USER1')).rejects.toThrow('disposed');
    });

    it('rejects old promise when called again before settling', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      const promise1 = manager.connectAndWait('ROOM1', 'USER1');

      // Second call before first settles
      const promise2 = manager.connectAndWait('ROOM1', 'USER1');

      // Old promise should be rejected with SupersededError
      await expect(promise1).rejects.toBeInstanceOf(SupersededError);

      // Resolve new connection: WS_OPEN → Syncing → FETCH_SUCCESS → Connected
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await expect(promise2).resolves.toBeUndefined();

      manager.dispose();
    });
  });

  describe('state listeners', () => {
    it('notifies listeners on state change', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      const states: ConnectionState[] = [];
      manager.addStateListener((s) => states.push(s));

      // Initial call with current state
      expect(states).toEqual([ConnectionState.Idle]);

      // Connect
      manager.connect('ROOM1', 'USER1');
      expect(states).toContain(ConnectionState.Connecting);

      // WS open → Syncing
      transport.handlers.onOpen();
      expect(states).toContain(ConnectionState.Syncing);

      // Let fetch resolve → Connected
      await jest.advanceTimersByTimeAsync(0);
      expect(states).toContain(ConnectionState.Connected);

      manager.dispose();
    });

    it('unsubscribe stops notifications', () => {
      const { deps } = createDeps();
      const manager = new ConnectionManager(deps);

      const states: ConnectionState[] = [];
      const unsub = manager.addStateListener((s) => states.push(s));

      // Initial
      expect(states).toEqual([ConnectionState.Idle]);

      unsub();

      manager.connect('ROOM1', 'USER1');
      // Should NOT get Connecting notification
      expect(states).toEqual([ConnectionState.Idle]);

      manager.dispose();
    });
  });

  describe('ping/pong', () => {
    it('sends ping at interval and handles pong', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait('ROOM1', 'USER1');
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      // Advance to first ping
      jest.advanceTimersByTime(PING_INTERVAL_MS);
      expect(transport.send).toHaveBeenCalledWith('ping');

      // Respond with pong — should not trigger PING_TIMEOUT
      transport.handlers.onPong();

      // Advance past pong timeout — should still be Connected since pong was received
      jest.advanceTimersByTime(PONG_TIMEOUT_MS + 1000);
      expect(manager.getState()).toBe(ConnectionState.Connected);

      manager.dispose();
    });

    it('PING_TIMEOUT → Disconnected when pong not received', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait('ROOM1', 'USER1');
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      // Advance to first ping
      jest.advanceTimersByTime(PING_INTERVAL_MS);
      expect(transport.send).toHaveBeenCalled();

      // Don't send pong — advance past timeout
      jest.advanceTimersByTime(PONG_TIMEOUT_MS);

      expect(manager.getState()).toBe(ConnectionState.Disconnected);

      manager.dispose();
    });
  });

  describe('retry', () => {
    it('auto-retries after WS_CLOSE with backoff delay', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      // Get to Connected
      const promise = manager.connectAndWait('ROOM1', 'USER1');
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      // WS closes → Disconnected → schedule retry
      transport.handlers.onClose(1006, 'abnormal');
      expect(manager.getState()).toBe(ConnectionState.Disconnected);

      // Advance past retry timer (backoff at attempt 0 is around 500-1000ms)
      jest.advanceTimersByTime(2000);

      // Should be in Reconnecting now
      expect(manager.getState()).toBe(ConnectionState.Reconnecting);
      expect(transport.connect).toHaveBeenCalledTimes(2); // initial + retry

      manager.dispose();
    });
  });

  describe('manualReconnect', () => {
    it('triggers reconnection from Disconnected', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      // Get to Connected then disconnect
      const promise = manager.connectAndWait('ROOM1', 'USER1');
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      transport.handlers.onClose(1006, '');
      expect(manager.getState()).toBe(ConnectionState.Disconnected);

      // Manual reconnect
      manager.manualReconnect();
      expect(manager.getState()).toBe(ConnectionState.Reconnecting);

      manager.dispose();
    });
  });

  describe('updateRevision', () => {
    it('updates lastRevision if higher', () => {
      const { deps } = createDeps();
      const manager = new ConnectionManager(deps);

      manager.updateRevision(10);
      expect(manager.getContext().lastRevision).toBe(10);

      // Lower revision — no update
      manager.updateRevision(5);
      expect(manager.getContext().lastRevision).toBe(10);

      manager.dispose();
    });
  });

  describe('dispose', () => {
    it('clears all timers and enters Disposed', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      // Get to Connected (has ping + revision poll running)
      const promise = manager.connectAndWait('ROOM1', 'USER1');
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      manager.dispose();
      expect(manager.getState()).toBe(ConnectionState.Disposed);
      expect(transport.disconnect).toHaveBeenCalled();

      // No further state changes after dispose
      transport.handlers.onOpen();
      expect(manager.getState()).toBe(ConnectionState.Disposed);
    });
  });

  describe('onStateUpdate callback', () => {
    it('calls onStateUpdate when transport receives STATE_UPDATE', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      // Get to Connected
      const promise = manager.connectAndWait('ROOM1', 'USER1');
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      // Simulate broadcast
      const newState = { revision: 5 } as unknown as WerewolfState;
      transport.handlers.onStateUpdate(newState, 5);

      expect(deps.onStateUpdate).toHaveBeenCalledWith(newState, 5, undefined);

      manager.dispose();
    });
  });

  describe('fetch and onFetchedState', () => {
    it('calls onFetchedState after successful DB fetch', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait('ROOM1', 'USER1');
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      expect(deps.onFetchedState).toHaveBeenCalledWith(MOCK_STATE, 1);

      manager.dispose();
    });

    it('stays in Syncing on fetch failure and retries', async () => {
      const { transport, deps } = createDeps({
        fetchStateFromDB: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const manager = new ConnectionManager(deps);

      manager.connect('ROOM1', 'USER1');
      transport.handlers.onOpen(); // → Syncing → FETCH_STATE

      await jest.advanceTimersByTimeAsync(0);

      // Stays in Syncing (not Disconnected), retry scheduled
      expect(manager.getState()).toBe(ConnectionState.Syncing);
      expect(manager.getContext().attempt).toBe(1);

      manager.dispose();
    });
  });

  describe('prefetch', () => {
    it('fires prefetch on OPEN_WS and uses result in FETCH_STATE', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ state: MOCK_STATE, revision: 3 });
      const { transport, deps } = createDeps({ fetchStateFromDB: fetchMock });
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait('ROOM1', 'USER1');

      // OPEN_WS triggers prefetch + transport.connect
      // At this point, fetchStateFromDB should already be called (prefetch)
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // WS opens → Syncing → FETCH_STATE consumes prefetch
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      // fetchStateFromDB called once total (prefetch reused, not called again)
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(deps.onFetchedState).toHaveBeenCalledWith(MOCK_STATE, 3);
      expect(manager.getState()).toBe(ConnectionState.Connected);

      manager.dispose();
    });

    it('falls back to normal fetch when prefetch returns null', async () => {
      let callCount = 0;
      const fetchMock = jest.fn().mockImplementation(() => {
        callCount++;
        // First call (prefetch) returns null, second call (fallback) returns state
        if (callCount === 1) return Promise.resolve(null);
        return Promise.resolve({ state: MOCK_STATE, revision: 2 });
      });
      const { transport, deps } = createDeps({ fetchStateFromDB: fetchMock });
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait('ROOM1', 'USER1');

      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      // Prefetch returned null → fallback fetch called
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(deps.onFetchedState).toHaveBeenCalledWith(MOCK_STATE, 2);

      manager.dispose();
    });

    it('falls back to normal fetch when prefetch rejects', async () => {
      let callCount = 0;
      const fetchMock = jest.fn().mockImplementation(() => {
        callCount++;
        // First call (prefetch) rejects, second call (fallback) succeeds
        if (callCount === 1) return Promise.reject(new Error('network error'));
        return Promise.resolve({ state: MOCK_STATE, revision: 4 });
      });
      const { transport, deps } = createDeps({ fetchStateFromDB: fetchMock });
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait('ROOM1', 'USER1');

      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      // Prefetch error caught → returned null → fallback fetch called
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(deps.onFetchedState).toHaveBeenCalledWith(MOCK_STATE, 4);

      manager.dispose();
    });

    it('cancels prefetch on disconnect before WS opens', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ state: MOCK_STATE, revision: 1 });
      const { deps } = createDeps({ fetchStateFromDB: fetchMock });
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait('ROOM1', 'USER1');

      // Prefetch started
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Disconnect before WS opens — should cancel prefetch
      manager.disconnect();

      await expect(promise).rejects.toThrow('disconnected');

      manager.dispose();
    });

    it('new OPEN_WS cancels previous prefetch', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ state: MOCK_STATE, revision: 1 });
      const { transport, deps } = createDeps({ fetchStateFromDB: fetchMock });
      const manager = new ConnectionManager(deps);

      // First connect → prefetch #1
      const p1 = manager.connectAndWait('ROOM1', 'USER1');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second connect supersedes → prefetch #2 (cancels #1)
      const p2 = manager.connectAndWait('ROOM2', 'USER1');
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await expect(p1).rejects.toBeInstanceOf(SupersededError);

      // WS opens for second connection
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await p2;

      // Only the second prefetch result is consumed
      expect(manager.getState()).toBe(ConnectionState.Connected);

      manager.dispose();
    });
  });
});
