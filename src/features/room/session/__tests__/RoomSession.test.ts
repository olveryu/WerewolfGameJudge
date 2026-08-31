import type { GameStateCodec } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import {
  type BaseGameState,
  createRoomSnapshot,
  createStateSyncResponseMessage,
  createStateUpdateMessage,
  parseStateSyncRequestMessage,
  type RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import * as Sentry from '@sentry/react-native';

import {
  type NewRecoverableRoomCommand,
  type RoomCommandRecoveryRepository,
  RoomCommandRecoveryStore,
} from '@/features/room/services/RoomCommandRecoveryStore';
import { RoomSession } from '@/features/room/session/RoomSession';
import type { ActiveRoomIdentity } from '@/features/room/session/types';
import { cfPost, CloudflareHttpError } from '@/services/cloudflare/cfFetch';
import type {
  IRealtimeTransport,
  TransportEventHandlers,
} from '@/services/types/IRealtimeTransport';

jest.mock('@/services/cloudflare/cfFetch', () => ({
  ...jest.requireActual<typeof import('@/services/cloudflare/cfFetch')>(
    '@/services/cloudflare/cfFetch',
  ),
  cfPost: jest.fn(),
}));

interface TestState extends BaseGameState<'werewolf'> {
  readonly counter: number;
}

interface TestCommand {
  readonly type: 'test.increment';
  readonly amount: number;
}

interface TestEvent {
  readonly type: 'TEST_EVENT';
  readonly eventId: string;
  readonly value: number;
}

const TEST_CODEC: GameStateCodec<TestState> = {
  gameType: 'werewolf',
  stateVersion: 1,
  parse(value: unknown): TestState {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Test state must be an object');
    }
    const state = value as Record<string, unknown>;
    if (
      state.gameType !== 'werewolf' ||
      state.stateVersion !== 1 ||
      typeof state.roomCode !== 'string' ||
      typeof state.hostUserId !== 'string' ||
      typeof state.counter !== 'number'
    ) {
      throw new Error('Test state has invalid fields');
    }
    return state as unknown as TestState;
  },
};

const IDENTITY: ActiveRoomIdentity<'werewolf'> = {
  room: {
    roomCode: '1234',
    roomId: 'room-id-1234',
    gameType: 'werewolf',
    hostUserId: 'host-user',
    createdAt: new Date('2026-07-11T12:00:00.000Z'),
  },
  userId: 'host-user',
};

const createdSessions: RoomSession<TestState, TestCommand, TestEvent>[] = [];

function createTestState(counter = 0, hostUserId = 'host-user'): TestState {
  return {
    gameType: 'werewolf',
    stateVersion: 1,
    roomCode: '1234',
    hostUserId,
    counter,
  };
}

function createTransport(options: {
  readonly initialSnapshot: RoomSnapshot<TestState>;
  readonly openOnConnect?: boolean;
}) {
  let handlers: TransportEventHandlers<TestState, TestEvent> = {
    onOpen: jest.fn(),
    onClose: jest.fn(),
    onError: jest.fn(),
    onStateUpdate: jest.fn(),
    onStateSyncResponse: jest.fn(),
    onUserEvent: jest.fn(),
    onPong: jest.fn(),
  };
  const transport: IRealtimeTransport<TestState, TestEvent> & {
    readonly handlers: TransportEventHandlers<TestState, TestEvent>;
    readonly connect: jest.Mock;
    readonly disconnect: jest.Mock;
    readonly send: jest.Mock;
  } = {
    get handlers() {
      return handlers;
    },
    connect: jest.fn(async () => {
      if (options?.openOnConnect !== false) handlers.onOpen();
    }),
    disconnect: jest.fn(),
    send: jest.fn((serialized: string) => {
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
            handlers.onStateSyncResponse(
              createStateSyncResponseMessage(request.requestId, options.initialSnapshot),
            );
          });
        }
      }
      return true;
    }),
    setEventHandlers(next) {
      handlers = next;
    },
  };
  return transport;
}

function createSession(options?: {
  readonly initialSnapshot?: RoomSnapshot<TestState>;
  readonly openOnConnect?: boolean;
  readonly commandRecovery?: RoomCommandRecoveryRepository;
}) {
  const transport = createTransport({
    initialSnapshot: options?.initialSnapshot ?? createRoomSnapshot(createTestState(), 1),
    openOnConnect: options?.openOnConnect,
  });
  let commandSequence = 0;
  const session = new RoomSession<TestState, TestCommand, TestEvent>({
    codec: TEST_CODEC,
    transport,
    createCommandId: () => `command-${++commandSequence}`,
    commandRecovery: options?.commandRecovery ?? {
      load: () => [],
      save: () => undefined,
      remove: () => undefined,
    },
  });
  createdSessions.push(session);
  return { session, transport };
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function createRecoveryStorage() {
  const values = new Map<string, string>();
  return {
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => values.set(key, value),
    remove: (key: string) => values.delete(key),
  };
}

const mockCfPost = jest.mocked(cfPost);

beforeEach(() => mockCfPost.mockReset());

afterEach(() => {
  for (const session of createdSessions.splice(0)) session.disconnect();
});

describe('RoomSession', () => {
  it('publishes one immutable ready snapshot with identity, state, and connection', async () => {
    const { session } = createSession();

    await expect(session.connect(IDENTITY)).resolves.toEqual({ kind: 'connected' });

    const first = session.getSnapshot();
    expect(first).toMatchObject({ phase: 'ready', epoch: 1, connection: 'live' });
    expect(Object.isFrozen(first)).toBe(true);
    expect(session.getSnapshot()).toBe(first);
  });

  it('fails fast when directory metadata and the initial snapshot disagree', async () => {
    const { session } = createSession({
      initialSnapshot: createRoomSnapshot(createTestState(0, 'another-host'), 1),
    });

    await expect(session.connect(IDENTITY)).rejects.toThrow(
      'Room directory metadata does not match its snapshot',
    );
  });

  it('applies command metadata when a broadcast follows socket sync at the same revision', async () => {
    const snapshot = createRoomSnapshot(createTestState(), 1);
    const { session, transport } = createSession({ initialSnapshot: snapshot });
    await session.connect(IDENTITY);

    transport.handlers.onStateUpdate(createStateUpdateMessage(snapshot, 'test.increment'));

    expect(session.getSnapshot()).toMatchObject({
      phase: 'ready',
      lastCommand: { revision: 1, type: 'test.increment' },
    });
  });

  it('rejects a prepared command after leaving and re-entering the same room', async () => {
    const { session } = createSession();
    await session.connect(IDENTITY);
    const prepared = session.prepare({ type: 'test.increment', amount: 1 }, null);
    session.disconnect();
    await session.connect(IDENTITY);

    await expect(session.dispatchPrepared(prepared, 'test')).rejects.toThrow('stale session epoch');
    expect(mockCfPost).not.toHaveBeenCalled();
  });

  it('cancels an in-flight command when its session disconnects', async () => {
    const { session } = createSession();
    await session.connect(IDENTITY);
    mockCfPost.mockImplementationOnce(
      (_path, _body, _decode, options) =>
        new Promise((_resolve, reject) => {
          const signal = options?.signal;
          if (signal === undefined) throw new Error('Expected room command cancellation signal');
          signal.addEventListener(
            'abort',
            () => {
              const error = new Error('The room command request was aborted');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true },
          );
        }),
    );

    const dispatched = session.dispatch(
      { type: 'test.increment', amount: 1 },
      { controlledSeat: null, label: 'test' },
    );
    session.disconnect();

    await expect(dispatched).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Room command cancelled because its session ended',
    });
    expect(session.getSnapshot().phase).toBe('idle');
  });

  it('cancels a command while it is waiting for a business retry', async () => {
    const { session } = createSession();
    await session.connect(IDENTITY);
    mockCfPost.mockRejectedValueOnce(new DOMException('Signal timed out', 'TimeoutError'));

    const dispatched = session.dispatch(
      { type: 'test.increment', amount: 1 },
      { controlledSeat: null, label: 'test' },
    );
    await flushAsyncWork();
    session.disconnect();

    await expect(dispatched).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockCfPost).toHaveBeenCalledTimes(1);
  });

  it('persists a recoverable command before its first send and retains an unknown outcome', async () => {
    const save = jest.fn<void, [NewRecoverableRoomCommand]>();
    const remove = jest.fn<void, [string, string, string]>();
    const commandRecovery: RoomCommandRecoveryRepository = {
      load: () => [],
      save,
      remove,
    };
    const { session } = createSession({ commandRecovery });
    await session.connect(IDENTITY);
    mockCfPost.mockImplementationOnce(async () => {
      expect(save).toHaveBeenCalledTimes(1);
      throw new TypeError('Failed to fetch');
    });

    await expect(
      session.dispatch(
        { type: 'test.increment', amount: 1 },
        { controlledSeat: null, label: 'test', isRecoverable: true },
      ),
    ).resolves.toMatchObject({ kind: 'deliveryUnknown', commandId: 'command-1' });

    expect(remove).not.toHaveBeenCalled();
    expect(session.getSnapshot().pendingCommandCount).toBe(1);
  });

  it('retries an unknown recoverable command while the connection remains live', async () => {
    const { session } = createSession();
    await session.connect(IDENTITY);
    jest.useFakeTimers();
    try {
      mockCfPost.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({
        kind: 'committed',
        commandId: 'command-1',
        snapshot: createRoomSnapshot(createTestState(1), 2),
        outcome: { kind: 'success' },
      });

      await expect(
        session.dispatch(
          { type: 'test.increment', amount: 1 },
          { controlledSeat: null, label: 'test', isRecoverable: true },
        ),
      ).resolves.toMatchObject({ kind: 'deliveryUnknown', commandId: 'command-1' });
      const firstEnvelope = mockCfPost.mock.calls[0]?.[1];

      await jest.advanceTimersByTimeAsync(1_000);

      expect(mockCfPost).toHaveBeenCalledTimes(2);
      expect(mockCfPost.mock.calls[1]?.[1]).toEqual(firstEnvelope);
      expect(session.getSnapshot().pendingCommandCount).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('cancels a scheduled recoverable command retry on disconnect', async () => {
    const { session } = createSession();
    await session.connect(IDENTITY);
    jest.useFakeTimers();
    try {
      mockCfPost.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      await session.dispatch(
        { type: 'test.increment', amount: 1 },
        { controlledSeat: null, label: 'test', isRecoverable: true },
      );

      session.disconnect();
      await jest.advanceTimersByTimeAsync(30_000);

      expect(mockCfPost).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('publishes a rejection returned by background command recovery', async () => {
    const { session } = createSession();
    await session.connect(IDENTITY);
    jest.useFakeTimers();
    try {
      mockCfPost.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({
        kind: 'rejected',
        commandId: 'command-1',
        reason: 'action_step_changed',
      });
      await session.dispatch(
        { type: 'test.increment', amount: 1 },
        { controlledSeat: null, label: 'test', isRecoverable: true },
      );

      await jest.advanceTimersByTimeAsync(1_000);

      expect(session.getSnapshot()).toMatchObject({
        pendingCommandCount: 0,
        lastRecoveredCommandRejection: {
          commandId: 'command-1',
          reason: 'action_step_changed',
        },
      });
      session.acknowledgeRecoveredCommandRejection('another-command');
      expect(session.getSnapshot().lastRecoveredCommandRejection).not.toBeNull();
      session.acknowledgeRecoveredCommandRejection('command-1');
      expect(session.getSnapshot().lastRecoveredCommandRejection).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('stops retrying and unlocks after background recovery confirms non-delivery', async () => {
    const remove = jest.fn<void, [string, string, string]>();
    const commandRecovery: RoomCommandRecoveryRepository = {
      load: () => [],
      save: () => undefined,
      remove,
    };
    const { session } = createSession({ commandRecovery });
    await session.connect(IDENTITY);
    jest.useFakeTimers();
    try {
      mockCfPost
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(
          new CloudflareHttpError({ status: 404, reason: 'no_state', body: null }),
        );
      await session.dispatch(
        { type: 'test.increment', amount: 1 },
        { controlledSeat: null, label: 'test', isRecoverable: true },
      );

      await jest.advanceTimersByTimeAsync(1_000);

      expect(session.getSnapshot()).toMatchObject({
        pendingCommandCount: 0,
        lastRecoveredCommandRejection: {
          commandId: 'command-1',
          reason: 'no_state',
        },
      });
      expect(remove).toHaveBeenCalledWith('room-id-1234', 'host-user', 'command-1');

      await jest.advanceTimersByTimeAsync(30_000);
      expect(mockCfPost).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('replays the exact persisted command after recreation and removes it after a decision', async () => {
    const recoveryStorage = createRecoveryStorage();
    const commandRecovery = new RoomCommandRecoveryStore(recoveryStorage, () => 1_000);
    const first = createSession({ commandRecovery });
    await first.session.connect(IDENTITY);
    mockCfPost.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const command: TestCommand = { type: 'test.increment', amount: 2 };

    await expect(
      first.session.dispatch(command, {
        controlledSeat: null,
        label: 'test',
        isRecoverable: true,
      }),
    ).resolves.toMatchObject({ kind: 'deliveryUnknown', commandId: 'command-1' });
    expect(commandRecovery.load(IDENTITY.room.roomId, IDENTITY.userId)).toMatchObject([
      { commandId: 'command-1', command },
    ]);
    first.session.disconnect();

    mockCfPost.mockResolvedValueOnce({
      kind: 'committed',
      commandId: 'command-1',
      snapshot: createRoomSnapshot(createTestState(2), 2),
      outcome: { kind: 'success' },
    });
    const recreated = createSession({ commandRecovery });
    await recreated.session.connect(IDENTITY);
    await flushAsyncWork();

    expect(mockCfPost).toHaveBeenCalledTimes(2);
    expect(mockCfPost.mock.calls[1]?.[1]).toMatchObject({
      roomCode: IDENTITY.room.roomCode,
      roomId: IDENTITY.room.roomId,
      commandId: 'command-1',
      command,
      controlledSeat: null,
    });
    expect(commandRecovery.load(IDENTITY.room.roomId, IDENTITY.userId)).toEqual([]);
    expect(recreated.session.getSnapshot()).toMatchObject({
      phase: 'ready',
      pendingCommandCount: 0,
      snapshot: { revision: 2 },
    });
  });

  it('fails fast if a non-cooperative command transport returns after disconnect', async () => {
    const { session } = createSession();
    await session.connect(IDENTITY);
    const commandResponse = createDeferred<unknown>();
    mockCfPost.mockImplementationOnce(() => commandResponse.promise);

    const dispatched = session.dispatch(
      { type: 'test.increment', amount: 1 },
      { controlledSeat: null, label: 'test' },
    );
    const request = mockCfPost.mock.calls[0]?.[1] as { commandId?: unknown } | undefined;
    if (typeof request?.commandId !== 'string') {
      throw new Error('Expected an in-flight command request');
    }
    session.disconnect();
    commandResponse.resolve({
      kind: 'committed',
      commandId: request.commandId,
      snapshot: createRoomSnapshot(createTestState(1), 2),
      outcome: { kind: 'success' },
    });

    await expect(dispatched).rejects.toThrow(
      `[FAIL-FAST] Room command ${request.commandId} completed for a stale session`,
    );
    expect(session.getSnapshot().phase).toBe('idle');
  });

  it('cancels an in-progress connection immediately and invalidates its epoch', async () => {
    const { session, transport } = createSession({ openOnConnect: false });
    const controller = new AbortController();
    const connecting = session.connect(IDENTITY, controller.signal);

    controller.abort();

    await expect(connecting).resolves.toEqual({ kind: 'cancelled' });
    expect(session.getSnapshot().phase).toBe('idle');
    expect(transport.disconnect).toHaveBeenCalled();
  });

  it('delivers durable user events before acknowledging and re-acks duplicates', async () => {
    const { session, transport } = createSession();
    await session.connect(IDENTITY);
    transport.send.mockClear();
    const event: TestEvent = { type: 'TEST_EVENT', eventId: 'event-1', value: 1 };
    transport.handlers.onUserEvent(event);
    expect(transport.send).not.toHaveBeenCalled();

    const delivery = createDeferred<void>();
    const handler = jest.fn(() => delivery.promise);
    const clearHandler = session.setUserEventHandler(handler);
    await flushAsyncWork();
    expect(handler).toHaveBeenCalledWith(event);
    expect(transport.send).not.toHaveBeenCalled();
    delivery.resolve();
    await flushAsyncWork();
    expect(transport.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'USER_EVENT_ACK', eventId: 'event-1' }),
    );

    transport.handlers.onUserEvent(event);
    expect(transport.send).toHaveBeenCalledTimes(2);
    clearHandler();
  });

  it('defers acknowledgement when the socket closes during user-event delivery', async () => {
    const { session, transport } = createSession();
    await session.connect(IDENTITY);
    transport.send.mockClear();
    const event: TestEvent = { type: 'TEST_EVENT', eventId: 'event-disconnected', value: 3 };
    const delivery = createDeferred<void>();
    const handler = jest.fn(() => delivery.promise);
    session.setUserEventHandler(handler);
    const captureException = jest.mocked(Sentry.captureException);
    captureException.mockClear();

    transport.handlers.onUserEvent(event);
    await flushAsyncWork();
    transport.send.mockReturnValue(false);
    transport.handlers.onClose(1006, '');
    delivery.resolve();
    await flushAsyncWork();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(transport.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'USER_EVENT_ACK', eventId: 'event-disconnected' }),
    );
    expect(captureException).not.toHaveBeenCalled();

    transport.send.mockReturnValue(true);
    transport.handlers.onUserEvent(event);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(transport.send).toHaveBeenCalledTimes(2);
  });

  it('reports an acknowledgement send exception after user-event delivery', async () => {
    const { session, transport } = createSession();
    await session.connect(IDENTITY);
    transport.send.mockClear();
    const sendError = new Error('WebSocket send failed');
    transport.send.mockImplementation(() => {
      throw sendError;
    });
    session.setUserEventHandler(jest.fn());
    const captureException = jest.mocked(Sentry.captureException);
    captureException.mockClear();

    transport.handlers.onUserEvent({
      type: 'TEST_EVENT',
      eventId: 'event-send-error',
      value: 4,
    });
    await flushAsyncWork();

    expect(captureException).toHaveBeenCalledWith(sendError);
  });

  it('does not acknowledge a failed handler and retries the same event on redelivery', async () => {
    const { session, transport } = createSession();
    await session.connect(IDENTITY);
    transport.send.mockClear();
    const event: TestEvent = { type: 'TEST_EVENT', eventId: 'event-2', value: 2 };
    const handler = jest
      .fn<Promise<void>, [TestEvent]>()
      .mockRejectedValueOnce(new Error('render failed'))
      .mockResolvedValueOnce(undefined);
    session.setUserEventHandler(handler);

    transport.handlers.onUserEvent(event);
    await flushAsyncWork();
    expect(transport.send).not.toHaveBeenCalled();

    transport.handlers.onUserEvent(event);
    await flushAsyncWork();
    expect(handler).toHaveBeenCalledTimes(2);
    expect(transport.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'USER_EVENT_ACK', eventId: 'event-2' }),
    );
  });

  it('fails the live connection when one event ID changes payload', async () => {
    const { session, transport } = createSession();
    await session.connect(IDENTITY);

    transport.handlers.onUserEvent({ type: 'TEST_EVENT', eventId: 'event-3', value: 1 });
    transport.handlers.onUserEvent({ type: 'TEST_EVENT', eventId: 'event-3', value: 2 });

    expect(session.getSnapshot()).toMatchObject({ phase: 'ready', connection: 'failed' });
  });
});
