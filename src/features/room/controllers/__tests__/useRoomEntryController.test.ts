import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createRoomSnapshot } from '@werewolf/game-engine/platform/protocol/roomSnapshot';

import { useRoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type {
  ActiveRoomIdentity,
  RoomCommandDispatchOutcome,
  RoomConnectOutcome,
  RoomSessionClient,
  RoomSessionSnapshot,
} from '@/features/room/session/types';
import type { handleError } from '@/utils/errorPipeline';

const mockHandleError = jest.fn<ReturnType<typeof handleError>, Parameters<typeof handleError>>();
jest.mock('@/utils/errorPipeline', () => ({
  handleError: (
    error: Parameters<typeof handleError>[0],
    options: Parameters<typeof handleError>[1],
  ) => mockHandleError(error, options),
}));

interface TestState {
  readonly gameType: 'werewolf';
  readonly stateVersion: 1;
  readonly roomCode: string;
  readonly hostUserId: string;
}

interface TestCommand {
  readonly type: 'test';
}

interface TestEvent {
  readonly eventId: string;
}

function createRoom(): RoomRecord {
  return {
    roomCode: '1234',
    roomId: 'room-id-1234',
    gameType: 'werewolf',
    hostUserId: 'host-user',
    createdAt: new Date('2026-07-11T12:00:00.000Z'),
  };
}

function idleSnapshot(epoch = 0): RoomSessionSnapshot<TestState> {
  return {
    phase: 'idle',
    epoch,
    identity: null,
    connection: 'disconnected',
    snapshot: null,
    lastCommand: null,
    error: null,
  };
}

function readySnapshot(
  identity: ActiveRoomIdentity,
  connection: 'live' | 'failed' = 'live',
): RoomSessionSnapshot<TestState> {
  return {
    phase: 'ready',
    epoch: 1,
    identity,
    connection,
    snapshot: createRoomSnapshot(
      {
        gameType: 'werewolf',
        stateVersion: 1,
        roomCode: identity.room.roomCode,
        hostUserId: identity.room.hostUserId,
      },
      1,
    ),
    lastCommand: null,
    error: null,
  };
}

function failedSnapshot(identity: ActiveRoomIdentity): RoomSessionSnapshot<TestState> {
  return {
    phase: 'failed',
    epoch: 1,
    identity,
    connection: 'failed',
    snapshot: null,
    lastCommand: null,
    error: new Error('connection failed'),
  };
}

function createSession(initial: RoomSessionSnapshot<TestState> = idleSnapshot()) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const emit = (next: RoomSessionSnapshot<TestState>): void => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const connect = jest.fn<Promise<RoomConnectOutcome>, [ActiveRoomIdentity, AbortSignal?]>();
  const reconnect = jest.fn<Promise<RoomConnectOutcome>, [AbortSignal?]>();
  const disconnect = jest.fn(() => emit(idleSnapshot(snapshot.epoch + 1)));
  connect.mockImplementation(async (identity) => {
    emit(readySnapshot(identity));
    return { kind: 'connected' };
  });
  reconnect.mockResolvedValue({ kind: 'connected' });

  const session: RoomSessionClient<TestState, TestCommand, TestEvent> = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connect,
    reconnect,
    disconnect,
    prepare: jest.fn(() => {
      throw new Error('not used');
    }),
    dispatch: jest.fn<Promise<RoomCommandDispatchOutcome<TestState>>, []>(() => {
      throw new Error('not used');
    }),
    dispatchPrepared: jest.fn<Promise<RoomCommandDispatchOutcome<TestState>>, []>(() => {
      throw new Error('not used');
    }),
    setUserEventHandler: jest.fn(() => () => undefined),
  };
  return { connect, disconnect, emit, reconnect, session };
}

beforeEach(() => mockHandleError.mockReset());

describe('useRoomEntryController', () => {
  it('does not connect before authentication is available', () => {
    const { session, connect } = createSession();
    const { result } = renderHook(() =>
      useRoomEntryController({
        room: createRoom(),
        session,
        authUserId: null,
        isAuthLoading: false,
        onExit: jest.fn(),
      }),
    );

    expect(result.current.isAuthRequired).toBe(true);
    expect(connect).not.toHaveBeenCalled();
  });

  it('connects one exact identity, ignores equivalent room objects, and disconnects on unmount', async () => {
    const room = createRoom();
    const { session, connect, disconnect } = createSession();
    const { result, rerender, unmount } = renderHook(
      ({ resolvedRoom }: { resolvedRoom: RoomRecord }) =>
        useRoomEntryController({
          room: resolvedRoom,
          session,
          authUserId: 'host-user',
          isAuthLoading: false,
          onExit: jest.fn(),
        }),
      { initialProps: { resolvedRoom: room } },
    );

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(connect).toHaveBeenCalledWith({ room, userId: 'host-user' }, expect.any(AbortSignal));

    rerender({ resolvedRoom: createRoom() });
    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled();

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('retries only after an explicit retry from a failed session', async () => {
    const room = createRoom();
    const identity = { room, userId: 'host-user' };
    const testSession = createSession();
    testSession.connect
      .mockImplementationOnce(async () => {
        testSession.emit(failedSnapshot(identity));
        throw new Error('first attempt failed');
      })
      .mockImplementationOnce(async () => {
        testSession.emit(readySnapshot(identity));
        return { kind: 'connected' };
      });
    const { result } = renderHook(() =>
      useRoomEntryController({
        room,
        session: testSession.session,
        authUserId: 'host-user',
        isAuthLoading: false,
        onExit: jest.fn(),
      }),
    );

    await waitFor(() => expect(result.current.showRetryButton).toBe(true));
    expect(testSession.connect).toHaveBeenCalledTimes(1);

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(testSession.connect).toHaveBeenCalledTimes(2);
    expect(mockHandleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ label: '加入房间' }),
    );
  });

  it('fails fast when manual reconnect is requested twice concurrently', () => {
    const room = createRoom();
    const identity = { room, userId: 'host-user' };
    const testSession = createSession(readySnapshot(identity, 'failed'));
    testSession.reconnect.mockImplementation(() => new Promise(() => undefined));
    const { result } = renderHook(() =>
      useRoomEntryController({
        room,
        session: testSession.session,
        authUserId: 'host-user',
        isAuthLoading: false,
        onExit: jest.fn(),
      }),
    );

    act(() => result.current.connection.onManualReconnect());

    expect(() => result.current.connection.onManualReconnect()).toThrow(
      'Room reconnect is already in progress',
    );
    expect(testSession.reconnect).toHaveBeenCalledTimes(1);
  });
});
