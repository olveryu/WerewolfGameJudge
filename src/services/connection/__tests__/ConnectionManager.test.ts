import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/public';
import {
  createStateUpdateMessage,
  type RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type {
  IRealtimeTransport,
  TransportEventHandlers,
} from '@/services/types/IRealtimeTransport';

import { ConnectionManager, type ConnectionManagerDeps } from '../ConnectionManager';
import { ConnectionState, PING_INTERVAL_MS, PONG_TIMEOUT_MS } from '../types';

interface TestUserEvent {
  readonly eventId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Transport
// ─────────────────────────────────────────────────────────────────────────────

function createMockTransport(): IRealtimeTransport<GameState, TestUserEvent> & {
  handlers: TransportEventHandlers<GameState, TestUserEvent>;
  connect: jest.Mock;
  disconnect: jest.Mock;
  send: jest.Mock;
} {
  let handlers: TransportEventHandlers<GameState, TestUserEvent> = {
    onOpen: jest.fn(),
    onClose: jest.fn(),
    onError: jest.fn(),
    onStateUpdate: jest.fn(),
    onUserEvent: jest.fn(),
    onPong: jest.fn(),
  };

  return {
    get handlers() {
      return handlers;
    },
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    send: jest.fn().mockReturnValue(true),
    setEventHandlers(h: TransportEventHandlers<GameState, TestUserEvent>) {
      handlers = h;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_STATE = { ...WEREWOLF_STATE_IDENTITY } as unknown as GameState;
const ROOM_1 = { roomCode: '1234', roomId: 'room-id-1' } as const;
const ROOM_2 = { roomCode: '5678', roomId: 'room-id-2' } as const;

function createMockSnapshot(revision: number): RoomSnapshot<GameState> {
  return { ...WEREWOLF_STATE_IDENTITY, state: MOCK_STATE, revision };
}

function createDeps(overrides?: Partial<ConnectionManagerDeps<GameState, TestUserEvent>>) {
  const transport = createMockTransport();
  const deps: ConnectionManagerDeps<GameState, TestUserEvent> = {
    transport,
    fetchStateFromDB: jest.fn().mockResolvedValue(createMockSnapshot(1)),
    getStateRevision: jest.fn().mockResolvedValue(1),
    onStateUpdate: jest.fn(),
    onFetchedState: jest.fn(),
    onUserEvent: jest.fn(),
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

      const promise = manager.connectAndWait(ROOM_1);

      // Should call transport.connect
      expect(transport.connect).toHaveBeenCalledWith(ROOM_1);

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

      const promise = manager.connectAndWait(ROOM_1, 5000);

      // WS opens but fetch hangs
      t.handlers.onOpen();

      // Advance past timeout
      jest.advanceTimersByTime(5000);

      await expect(promise).rejects.toThrow('timeout');

      manager.dispose();
    });

    it('requires an explicit disconnect before connecting again', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      // First connect
      const p1 = manager.connectAndWait(ROOM_1);
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await p1;

      await expect(manager.connectAndWait(ROOM_1)).rejects.toThrow(
        'requires Idle, received Connected',
      );

      manager.dispose();
    });

    it('rejects when connection enters Disposed state', async () => {
      const { deps } = createDeps();
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait(ROOM_1);

      manager.dispose();

      await expect(promise).rejects.toThrow();
    });

    it('rejects immediately if already disposed', async () => {
      const { deps } = createDeps();
      const manager = new ConnectionManager(deps);
      manager.dispose();

      await expect(manager.connectAndWait(ROOM_1)).rejects.toThrow('received Disposed');
    });

    it('rejects a concurrent connect without superseding the active attempt', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      const promise1 = manager.connectAndWait(ROOM_1);

      // Second call before first settles
      await expect(manager.connectAndWait(ROOM_1)).rejects.toThrow(
        'requires Idle, received Connecting',
      );

      // Resolve new connection: WS_OPEN → Syncing → FETCH_SUCCESS → Connected
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await expect(promise1).resolves.toBeUndefined();

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
      const promise = manager.connectAndWait(ROOM_1);
      expect(states).toContain(ConnectionState.Connecting);

      // WS open → Syncing
      transport.handlers.onOpen();
      expect(states).toContain(ConnectionState.Syncing);

      // Let fetch resolve → Connected
      await jest.advanceTimersByTimeAsync(0);
      await promise;
      expect(states).toContain(ConnectionState.Connected);

      manager.dispose();
    });

    it('unsubscribe stops notifications', async () => {
      const { deps } = createDeps();
      const manager = new ConnectionManager(deps);

      const states: ConnectionState[] = [];
      const unsub = manager.addStateListener((s) => states.push(s));

      // Initial
      expect(states).toEqual([ConnectionState.Idle]);

      unsub();

      const promise = manager.connectAndWait(ROOM_1);
      // Should NOT get Connecting notification
      expect(states).toEqual([ConnectionState.Idle]);

      manager.dispose();
      await expect(promise).rejects.toThrow('disposed');
    });
  });

  describe('ping/pong', () => {
    it('sends the canonical durable user-event acknowledgement', () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      expect(manager.sendUserEventAcknowledgement('event-1')).toBe(true);
      expect(transport.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'USER_EVENT_ACK', eventId: 'event-1' }),
      );

      manager.dispose();
    });

    it('sends ping at interval and handles pong', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait(ROOM_1);
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

      const promise = manager.connectAndWait(ROOM_1);
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
      const promise = manager.connectAndWait(ROOM_1);
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

  describe('reconnectAndWait', () => {
    it('triggers reconnection from Disconnected', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      // Get to Connected then disconnect
      const promise = manager.connectAndWait(ROOM_1);
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      transport.handlers.onClose(1006, '');
      expect(manager.getState()).toBe(ConnectionState.Disconnected);

      // Manual reconnect
      const reconnect = manager.reconnectAndWait();
      expect(manager.getState()).toBe(ConnectionState.Reconnecting);

      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await reconnect;

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
      const promise = manager.connectAndWait(ROOM_1);
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
      const promise = manager.connectAndWait(ROOM_1);
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      // Simulate broadcast
      const message = {
        type: 'STATE_UPDATE' as const,
        ...createMockSnapshot(5),
        lastCommandType: null,
      };
      transport.handlers.onStateUpdate(message);

      expect(deps.onStateUpdate).toHaveBeenCalledWith(message);

      manager.dispose();
    });
  });

  describe('fetch and onFetchedState', () => {
    it('calls onFetchedState after successful DB fetch', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait(ROOM_1);
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      expect(deps.onFetchedState).toHaveBeenCalledWith(createMockSnapshot(1));

      manager.dispose();
    });

    it('stays in Syncing on fetch failure and retries', async () => {
      const { transport, deps } = createDeps({
        fetchStateFromDB: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait(ROOM_1);
      transport.handlers.onOpen(); // → Syncing → FETCH_STATE

      await jest.advanceTimersByTimeAsync(0);

      // Stays in Syncing (not Disconnected), retry scheduled
      expect(manager.getState()).toBe(ConnectionState.Syncing);
      expect(manager.getContext().attempt).toBe(1);

      manager.dispose();
      await expect(promise).rejects.toThrow('disposed');
    });
  });

  describe('prefetch', () => {
    it('fires prefetch on OPEN_WS and uses result in FETCH_STATE', async () => {
      const fetchMock = jest.fn().mockResolvedValue(createMockSnapshot(3));
      const { transport, deps } = createDeps({ fetchStateFromDB: fetchMock });
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait(ROOM_1);

      // OPEN_WS triggers prefetch + transport.connect
      // At this point, fetchStateFromDB should already be called (prefetch)
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // WS opens → Syncing → FETCH_STATE consumes prefetch
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      // fetchStateFromDB called once total (prefetch reused, not called again)
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(deps.onFetchedState).toHaveBeenCalledWith(createMockSnapshot(3));
      expect(manager.getState()).toBe(ConnectionState.Connected);

      manager.dispose();
    });

    it('falls back to normal fetch when prefetch returns null', async () => {
      let callCount = 0;
      const fetchMock = jest.fn().mockImplementation(() => {
        callCount++;
        // First call (prefetch) returns null, second call (fallback) returns state
        if (callCount === 1) return Promise.resolve(null);
        return Promise.resolve(createMockSnapshot(2));
      });
      const { transport, deps } = createDeps({ fetchStateFromDB: fetchMock });
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait(ROOM_1);

      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      // Prefetch returned null → fallback fetch called
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(deps.onFetchedState).toHaveBeenCalledWith(createMockSnapshot(2));

      manager.dispose();
    });

    it('falls back to normal fetch when prefetch rejects', async () => {
      let callCount = 0;
      const fetchMock = jest.fn().mockImplementation(() => {
        callCount++;
        // First call (prefetch) rejects, second call (fallback) succeeds
        if (callCount === 1) return Promise.reject(new Error('network error'));
        return Promise.resolve(createMockSnapshot(4));
      });
      const { transport, deps } = createDeps({ fetchStateFromDB: fetchMock });
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait(ROOM_1);

      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      // Prefetch error caught → returned null → fallback fetch called
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(deps.onFetchedState).toHaveBeenCalledWith(createMockSnapshot(4));

      manager.dispose();
    });

    it('cancels prefetch on disconnect before WS opens', async () => {
      const fetchMock = jest.fn().mockResolvedValue(createMockSnapshot(1));
      const { deps } = createDeps({ fetchStateFromDB: fetchMock });
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait(ROOM_1);

      // Prefetch started
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Disconnect before WS opens — should cancel prefetch
      manager.disconnect();

      await expect(promise).rejects.toThrow('disconnected');

      manager.dispose();
    });

    it('disconnect cancels the previous prefetch before a new room connects', async () => {
      const fetchMock = jest.fn().mockResolvedValue(createMockSnapshot(1));
      const { transport, deps } = createDeps({ fetchStateFromDB: fetchMock });
      const manager = new ConnectionManager(deps);

      // First connect → prefetch #1
      const p1 = manager.connectAndWait(ROOM_1);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      manager.disconnect();
      await expect(p1).rejects.toThrow('disconnected');

      // A new explicit session may now connect to another room.
      const p2 = manager.connectAndWait(ROOM_2);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // WS opens for second connection
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await p2;

      // Only the second prefetch result is consumed
      expect(manager.getState()).toBe(ConnectionState.Connected);

      manager.dispose();
    });
  });

  describe('protocol integrity', () => {
    it('rejects immediately when an active room has no snapshot', async () => {
      const { transport, deps } = createDeps({
        fetchStateFromDB: jest.fn().mockResolvedValue(null),
      });
      const manager = new ConnectionManager(deps);
      const connected = manager.connectAndWait(ROOM_1);
      const rejected = expect(connected).rejects.toThrow('no authoritative snapshot');

      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);

      await rejected;
      expect(manager.getState()).toBe(ConnectionState.Failed);
      manager.dispose();
    });

    it('fails the initial connection when snapshot application rejects metadata', async () => {
      const integrityError = new Error('snapshot identity mismatch');
      const { transport, deps } = createDeps({
        onFetchedState: jest.fn(() => {
          throw integrityError;
        }),
      });
      const manager = new ConnectionManager(deps);
      const connected = manager.connectAndWait(ROOM_1);
      const rejected = expect(connected).rejects.toBe(integrityError);

      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);

      await rejected;
      expect(manager.getState()).toBe(ConnectionState.Failed);
      manager.dispose();
    });

    it('fails a live connection when a state update callback rejects integrity', async () => {
      const onStateUpdate = jest.fn(() => {
        throw new Error('revision payload changed');
      });
      const { transport, deps } = createDeps({ onStateUpdate });
      const manager = new ConnectionManager(deps);
      const connected = manager.connectAndWait(ROOM_1);
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await connected;

      transport.handlers.onStateUpdate(
        createStateUpdateMessage(createMockSnapshot(2), 'test.command'),
      );

      expect(manager.getState()).toBe(ConnectionState.Failed);
      expect(transport.disconnect).toHaveBeenCalled();
      manager.dispose();
    });

    it('fails a live connection when a user-event callback rejects integrity', async () => {
      const onUserEvent = jest.fn(() => {
        throw new Error('event ID changed payload');
      });
      const { transport, deps } = createDeps({ onUserEvent });
      const manager = new ConnectionManager(deps);
      const connected = manager.connectAndWait(ROOM_1);
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await connected;

      transport.handlers.onUserEvent({ eventId: 'event-1' });

      expect(manager.getState()).toBe(ConnectionState.Failed);
      expect(transport.disconnect).toHaveBeenCalled();
      manager.dispose();
    });

    it('maps WebSocket protocol close code 1002 directly to Failed', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);
      const connected = manager.connectAndWait(ROOM_1);

      transport.handlers.onClose(1002, 'protocol_error');

      await expect(connected).rejects.toThrow('Realtime protocol closed: protocol_error');
      expect(manager.getState()).toBe(ConnectionState.Failed);
      manager.dispose();
    });
  });
});
