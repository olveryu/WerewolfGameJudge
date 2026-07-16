import type { GameStateCodec } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import {
  type BaseGameState,
  createRoomSnapshot,
  createStateUpdateMessage,
  type RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import { RoomSession } from '@/features/room/session/RoomSession';
import type { ActiveRoomIdentity } from '@/features/room/session/types';
import { cfPost } from '@/services/cloudflare/cfFetch';
import type {
  IRealtimeTransport,
  TransportEventHandlers,
} from '@/services/types/IRealtimeTransport';
import type { IRoomStateService } from '@/services/types/IRoomStateService';

jest.mock('@/services/cloudflare/cfFetch', () => ({ cfPost: jest.fn() }));

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

function createTransport(options?: { readonly openOnConnect?: boolean }) {
  let handlers: TransportEventHandlers<TestState, TestEvent> = {
    onOpen: jest.fn(),
    onClose: jest.fn(),
    onError: jest.fn(),
    onStateUpdate: jest.fn(),
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
    send: jest.fn(() => true),
    setEventHandlers(next) {
      handlers = next;
    },
  };
  return transport;
}

function createSession(options?: {
  readonly initialSnapshot?: RoomSnapshot<TestState> | null;
  readonly openOnConnect?: boolean;
}) {
  const transport = createTransport({ openOnConnect: options?.openOnConnect });
  const stateService: IRoomStateService<TestState> = {
    getGameState: jest
      .fn<Promise<RoomSnapshot<TestState> | null>, []>()
      .mockResolvedValue(
        options && 'initialSnapshot' in options
          ? (options.initialSnapshot ?? null)
          : createRoomSnapshot(createTestState(), 1),
      ),
    getStateRevision: jest.fn<Promise<number | null>, []>().mockResolvedValue(1),
  };
  let commandSequence = 0;
  const session = new RoomSession<TestState, TestCommand, TestEvent>({
    codec: TEST_CODEC,
    stateService,
    transport,
    createCommandId: () => `command-${++commandSequence}`,
  });
  createdSessions.push(session);
  return { session, stateService, transport };
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

  it('fails fast when an active directory room has no authoritative snapshot', async () => {
    const { session } = createSession({ initialSnapshot: null });

    await expect(session.connect(IDENTITY)).rejects.toThrow(
      'Active room returned no authoritative snapshot',
    );
    expect(session.getSnapshot()).toMatchObject({ phase: 'failed', connection: 'failed' });
  });

  it('fails fast when directory metadata and the initial snapshot disagree', async () => {
    const { session } = createSession({
      initialSnapshot: createRoomSnapshot(createTestState(0, 'another-host'), 1),
    });

    await expect(session.connect(IDENTITY)).rejects.toThrow(
      'Room directory metadata does not match its snapshot',
    );
  });

  it('applies command metadata when WS follows an HTTP snapshot at the same revision', async () => {
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

  it('fails fast on a late command response without applying it to a new epoch', async () => {
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

  it('does not acknowledge a failed handler and retries the same event on redelivery', async () => {
    const { session, transport } = createSession();
    await session.connect(IDENTITY);
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
