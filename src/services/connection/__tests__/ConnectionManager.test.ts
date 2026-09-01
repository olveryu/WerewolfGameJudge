import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/public';
import {
  createStateSyncResponseMessage,
  createStateUpdateMessage,
  parseStateSyncRequestMessage,
  type RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { AppVisibilityStore } from '@/services/infra/appVisibility';
import type {
  IRealtimeTransport,
  TransportEventHandlers,
} from '@/services/types/IRealtimeTransport';
import { NetworkTimeoutError } from '@/utils/errorUtils';

import { ConnectionManager, type ConnectionManagerDeps } from '../ConnectionManager';
import {
  ConnectionState,
  PING_INTERVAL_MS,
  PONG_TIMEOUT_MS,
  STATE_SYNC_TIMEOUT_MS,
} from '../types';

interface TestUserEvent {
  readonly eventId: string;
}

interface TestAppVisibility {
  readonly store: AppVisibilityStore;
  setIsVisible(isVisible: boolean): void;
}

function createTestAppVisibility(): TestAppVisibility {
  let isVisible = true;
  const listeners = new Set<() => void>();
  return {
    store: {
      getSnapshot: () => isVisible,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    setIsVisible(nextIsVisible) {
      if (nextIsVisible === isVisible) return;
      isVisible = nextIsVisible;
      listeners.forEach((listener) => listener());
    },
  };
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
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
    onStateSyncResponse: jest.fn(),
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

function createMockSnapshot(revision: number): RoomSnapshot<GameState> {
  return { ...WEREWOLF_STATE_IDENTITY, state: MOCK_STATE, revision };
}

function createDeps(
  overrides?: Partial<ConnectionManagerDeps<GameState, TestUserEvent>>,
  shouldAutoRespondToStateSync = true,
) {
  const transport = createMockTransport();
  const appVisibility = createTestAppVisibility();
  const deps: ConnectionManagerDeps<GameState, TestUserEvent> = {
    transport,
    onStateUpdate: jest.fn(),
    onStateSync: jest.fn(),
    onUserEvent: jest.fn(),
    appVisibilityStore: appVisibility.store,
    ...overrides,
  };
  // Re-assign transport if overrides didn't provide one
  if (!overrides?.transport) {
    deps.transport = transport;
  }
  if (shouldAutoRespondToStateSync && !overrides?.transport) {
    transport.send.mockImplementation((serialized: string) => {
      if (serialized.startsWith('{')) {
        const decoded: unknown = JSON.parse(serialized);
        if (
          typeof decoded === 'object' &&
          decoded !== null &&
          'type' in decoded &&
          decoded.type === 'STATE_SYNC_REQUEST'
        ) {
          const request = parseStateSyncRequestMessage(decoded);
          queueMicrotask(() => {
            transport.handlers.onStateSyncResponse(
              createStateSyncResponseMessage(request.requestId, createMockSnapshot(1)),
            );
          });
        }
      }
      return true;
    });
  }
  return {
    transport: deps.transport as ReturnType<typeof createMockTransport>,
    deps,
    appVisibility,
  };
}

function readLatestStateSyncRequestId(transport: ReturnType<typeof createMockTransport>): string {
  const latestCall: unknown = transport.send.mock.calls.at(-1);
  if (!Array.isArray(latestCall)) throw new Error('Expected a state sync send call');
  const serialized: unknown = latestCall[0];
  if (typeof serialized !== 'string') throw new Error('Expected a text state sync request');
  const decoded: unknown = JSON.parse(serialized);
  return parseStateSyncRequestMessage(decoded).requestId;
}

function completeStateSync(transport: ReturnType<typeof createMockTransport>, revision = 1): void {
  transport.handlers.onStateSyncResponse(
    createStateSyncResponseMessage(
      readLatestStateSyncRequestId(transport),
      createMockSnapshot(revision),
    ),
  );
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

      // Simulate WS open and its authoritative state-sync response.
      transport.handlers.onOpen();

      // Let the async fetch resolve
      await jest.advanceTimersByTimeAsync(0);

      await expect(promise).resolves.toBeUndefined();
      expect(manager.getState()).toBe(ConnectionState.Connected);

      manager.dispose();
    });

    it('rejects with a typed network timeout', async () => {
      const { transport: t, deps } = createDeps(undefined, false);
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait(ROOM_1, 5000);

      // WS opens but fetch hangs
      t.handlers.onOpen();

      // Advance past timeout
      jest.advanceTimersByTime(5000);

      await expect(promise).rejects.toBeInstanceOf(NetworkTimeoutError);

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

      // Resolve new connection: WS_OPEN → Syncing → STATE_SYNC_SUCCESS → Connected
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

    it('pauses ping in background and resynchronizes before resuming in foreground', async () => {
      const { transport, deps, appVisibility } = createDeps();
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait(ROOM_1);
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;
      transport.send.mockClear();

      appVisibility.setIsVisible(false);
      jest.advanceTimersByTime(PING_INTERVAL_MS);

      expect(manager.getContext().visible).toBe(false);
      expect(transport.send).not.toHaveBeenCalled();

      appVisibility.setIsVisible(true);
      await jest.advanceTimersByTimeAsync(0);

      expect(manager.getState()).toBe(ConnectionState.Connected);
      expect(deps.onStateSync).toHaveBeenCalledTimes(2);

      transport.send.mockClear();
      jest.advanceTimersByTime(PING_INTERVAL_MS);
      expect(transport.send).toHaveBeenCalledWith('ping');

      manager.dispose();
    });

    it('does not start ping when constructed in the background', async () => {
      const { transport, deps, appVisibility } = createDeps();
      appVisibility.setIsVisible(false);
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait(ROOM_1);
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;
      transport.send.mockClear();

      jest.advanceTimersByTime(PING_INTERVAL_MS);

      expect(manager.getContext().visible).toBe(false);
      expect(transport.send).not.toHaveBeenCalled();

      manager.dispose();
    });

    it('does not start ping when backgrounded while opening the connection', async () => {
      const { transport, deps, appVisibility } = createDeps();
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait(ROOM_1);
      appVisibility.setIsVisible(false);
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await promise;
      transport.send.mockClear();

      jest.advanceTimersByTime(PING_INTERVAL_MS);

      expect(manager.getContext().visible).toBe(false);
      expect(transport.send).not.toHaveBeenCalled();

      manager.dispose();
    });

    it('starts ping when foregrounded while the initial sync is pending', async () => {
      const { transport, deps, appVisibility } = createDeps();
      appVisibility.setIsVisible(false);
      const manager = new ConnectionManager(deps);

      const promise = manager.connectAndWait(ROOM_1);
      transport.handlers.onOpen();
      appVisibility.setIsVisible(true);
      await jest.advanceTimersByTimeAsync(0);
      await promise;
      transport.send.mockClear();

      jest.advanceTimersByTime(PING_INTERVAL_MS);

      expect(manager.getContext().visible).toBe(true);
      expect(transport.send).toHaveBeenCalledWith('ping');

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

    it('ignores a superseded transport connection failure', async () => {
      const staleTransportConnection = createDeferred<void>();
      const transport = createMockTransport();
      transport.connect
        .mockImplementationOnce(() => staleTransportConnection.promise)
        .mockResolvedValue(undefined);
      const { deps } = createDeps({ transport });
      const manager = new ConnectionManager(deps);

      const staleConnection = manager.connectAndWait(ROOM_1);
      manager.disconnect();
      await expect(staleConnection).rejects.toThrow('Connection disconnected');

      const activeConnection = manager.connectAndWait(ROOM_1);
      transport.handlers.onOpen();
      completeStateSync(transport);
      await activeConnection;

      staleTransportConnection.reject(new Error('stale token refresh failed'));
      await jest.advanceTimersByTimeAsync(0);

      expect(manager.getState()).toBe(ConnectionState.Connected);
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

    it('rejects a manual reconnect with a typed network timeout', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      const connected = manager.connectAndWait(ROOM_1);
      transport.handlers.onOpen();
      await jest.advanceTimersByTimeAsync(0);
      await connected;

      transport.handlers.onClose(1006, '');
      const reconnect = manager.reconnectAndWait(5000);

      jest.advanceTimersByTime(5000);

      await expect(reconnect).rejects.toBeInstanceOf(NetworkTimeoutError);
      manager.dispose();
    });
  });

  describe('dispose', () => {
    it('clears all timers and enters Disposed', async () => {
      const { transport, deps } = createDeps();
      const manager = new ConnectionManager(deps);

      // Get to Connected (has ping timer running)
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

  describe('authoritative state sync', () => {
    it('sends a correlated request and applies the response snapshot', async () => {
      const { transport, deps } = createDeps(undefined, false);
      const manager = new ConnectionManager(deps);
      const connected = manager.connectAndWait(ROOM_1);

      transport.handlers.onOpen();
      const requestId = readLatestStateSyncRequestId(transport);
      transport.handlers.onStateSyncResponse(
        createStateSyncResponseMessage(requestId, createMockSnapshot(3)),
      );

      await connected;
      expect(deps.onStateSync).toHaveBeenCalledWith(createMockSnapshot(3));
      expect(manager.getState()).toBe(ConnectionState.Connected);
      manager.dispose();
    });

    it('does not mark the connection live from a broadcast while sync is pending', async () => {
      const { transport, deps } = createDeps(undefined, false);
      const manager = new ConnectionManager(deps);
      const connected = manager.connectAndWait(ROOM_1);

      transport.handlers.onOpen();
      transport.handlers.onStateUpdate(
        createStateUpdateMessage(createMockSnapshot(2), 'test.command'),
      );

      expect(manager.getState()).toBe(ConnectionState.Syncing);
      completeStateSync(transport, 2);
      await connected;
      expect(manager.getState()).toBe(ConnectionState.Connected);
      manager.dispose();
    });

    it('closes the socket and schedules reconnect when the sync deadline expires', async () => {
      const { transport, deps } = createDeps(undefined, false);
      const manager = new ConnectionManager(deps);
      const connected = manager.connectAndWait(ROOM_1);

      transport.handlers.onOpen();
      jest.advanceTimersByTime(STATE_SYNC_TIMEOUT_MS);

      expect(manager.getState()).toBe(ConnectionState.Disconnected);
      expect(transport.disconnect).toHaveBeenCalled();
      manager.dispose();
      await expect(connected).rejects.toThrow('disposed');
    });

    it('fails on a response for a different request ID', async () => {
      const { transport, deps } = createDeps(undefined, false);
      const manager = new ConnectionManager(deps);
      const connected = manager.connectAndWait(ROOM_1);

      transport.handlers.onOpen();
      transport.handlers.onStateSyncResponse(
        createStateSyncResponseMessage('wrong-request', createMockSnapshot(1)),
      );

      await expect(connected).rejects.toThrow('does not match');
      expect(manager.getState()).toBe(ConnectionState.Failed);
      manager.dispose();
    });

    it('reconnects when the open socket cannot send the sync request', async () => {
      const { transport, deps } = createDeps(undefined, false);
      transport.send.mockReturnValue(false);
      const manager = new ConnectionManager(deps);
      const connected = manager.connectAndWait(ROOM_1);

      transport.handlers.onOpen();

      expect(manager.getState()).toBe(ConnectionState.Disconnected);
      expect(transport.disconnect).toHaveBeenCalled();
      manager.dispose();
      await expect(connected).rejects.toThrow('disposed');
    });
  });

  describe('protocol integrity', () => {
    it('fails the initial connection when snapshot application rejects metadata', async () => {
      const integrityError = new Error('snapshot identity mismatch');
      const { transport, deps } = createDeps({
        onStateSync: jest.fn(() => {
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
