import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useRoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type { RecentRoomIdentity } from '@/features/room/services/recentRooms';
import type { LinkSnapshot, RoomIdentity, RoomLink } from '@/platform/realtime/types';
import { RoomLinkClosedError } from '@/platform/realtime/types';
import { idleLinkSnapshot, readyLinkSnapshot } from '@/test-utils/linkSnapshot';
import type { handleError } from '@/utils/errorPipeline';

const mockHandleError = jest.fn<ReturnType<typeof handleError>, Parameters<typeof handleError>>();
const mockAddRecentRoom = jest.fn<void, [string, RecentRoomIdentity]>();
jest.mock('@/utils/errorPipeline', () => ({
  handleError: (
    error: Parameters<typeof handleError>[0],
    options: Parameters<typeof handleError>[1],
  ) => mockHandleError(error, options),
}));
jest.mock('@/features/room/services/recentRooms', () => ({
  addRecentRoom: (userId: string, room: RecentRoomIdentity): void =>
    mockAddRecentRoom(userId, room),
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

function createRoom(): RoomRecord<'werewolf'> {
  return {
    roomCode: '1234',
    roomId: 'room-id-1234',
    gameType: 'werewolf',
    hostUserId: 'host-user',
    createdAt: new Date('2026-07-11T12:00:00.000Z'),
  };
}

function roomSnapshotFor(identity: RoomIdentity<'werewolf'>) {
  return createRoomSnapshot<TestState>(
    {
      gameType: 'werewolf',
      stateVersion: 1,
      roomCode: identity.room.roomCode,
      hostUserId: identity.room.hostUserId,
    },
    1,
  );
}

function readySnapshot(identity: RoomIdentity<'werewolf'>): LinkSnapshot<TestState> {
  return readyLinkSnapshot<TestState>(identity, roomSnapshotFor(identity));
}

function closedSnapshot(identity: RoomIdentity<'werewolf'>): LinkSnapshot<TestState> {
  return {
    epoch: 1,
    status: { kind: 'closed', reason: 'roomDeleted' },
    lastCommand: null,
    pendingDurableCount: 0,
    presence: new Set(),
    phase: 'closed',
    identity,
    room: null,
  };
}

function createLink(initial: LinkSnapshot<TestState> = idleLinkSnapshot()) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const emit = (next: LinkSnapshot<TestState>): void => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const connect = jest.fn<Promise<void>, [RoomIdentity<'werewolf'>, AbortSignal]>();
  const close = jest.fn(() => emit(idleLinkSnapshot({ epoch: snapshot.epoch + 1 })));
  const retryNow = jest.fn();
  connect.mockImplementation(async (identity) => {
    emit(readySnapshot(identity));
  });

  const link: RoomLink<TestState, TestCommand> = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connect,
    close,
    retryNow,
    dispatch: jest.fn(() => {
      throw new Error('not used');
    }),
  };
  return { connect, close, emit, retryNow, link };
}

beforeEach(() => {
  mockHandleError.mockReset();
  mockAddRecentRoom.mockReset();
});

describe('useRoomEntryController', () => {
  it('does not connect before authentication is available', () => {
    const { link, connect } = createLink();
    const { result } = renderHook(() =>
      useRoomEntryController({
        room: createRoom(),
        link,
        authUserId: null,
        isAuthLoading: false,
        onExit: jest.fn(),
      }),
    );

    expect(result.current.isAuthRequired).toBe(true);
    expect(connect).not.toHaveBeenCalled();
  });

  it('connects one exact identity, ignores equivalent room objects, and closes on unmount', async () => {
    const room = createRoom();
    const { link, connect, close } = createLink();
    const { result, rerender, unmount } = renderHook(
      ({ resolvedRoom }: { resolvedRoom: RoomRecord<'werewolf'> }) =>
        useRoomEntryController({
          room: resolvedRoom,
          link,
          authUserId: 'host-user',
          isAuthLoading: false,
          onExit: jest.fn(),
        }),
      { initialProps: { resolvedRoom: room } },
    );

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(connect).toHaveBeenCalledWith({ room, userId: 'host-user' }, expect.any(AbortSignal));
    await waitFor(() =>
      expect(mockAddRecentRoom).toHaveBeenCalledWith('host-user', {
        roomCode: room.roomCode,
        roomId: room.roomId,
        gameType: room.gameType,
      }),
    );

    rerender({ resolvedRoom: createRoom() });
    expect(connect).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();

    unmount();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('shows the close message and retries only after an explicit retry from a closed link', async () => {
    const room = createRoom();
    const identity = { room, userId: 'host-user' };
    const testLink = createLink();
    testLink.connect
      .mockImplementationOnce(async () => {
        testLink.emit(closedSnapshot(identity));
        throw new RoomLinkClosedError('roomDeleted');
      })
      .mockImplementationOnce(async () => {
        testLink.emit(readySnapshot(identity));
      });
    const { result } = renderHook(() =>
      useRoomEntryController({
        room,
        link: testLink.link,
        authUserId: 'host-user',
        isAuthLoading: false,
        onExit: jest.fn(),
      }),
    );

    await waitFor(() => expect(result.current.showRetryButton).toBe(true));
    expect(result.current.loadingMessage).toBe('房间已过期关闭');
    expect(testLink.connect).toHaveBeenCalledTimes(1);
    expect(mockAddRecentRoom).not.toHaveBeenCalled();
    // A terminal close is presented from the link status, never as an unexpected error.
    expect(mockHandleError).not.toHaveBeenCalled();

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    // Retry releases the closed epoch before connecting again.
    expect(testLink.close).toHaveBeenCalledTimes(1);
    expect(testLink.connect).toHaveBeenCalledTimes(2);
    expect(mockAddRecentRoom).toHaveBeenCalledTimes(1);
  });

  it('reports an unexpected connect failure through the error pipeline', async () => {
    const testLink = createLink();
    testLink.connect.mockRejectedValueOnce(new Error('directory exploded'));
    renderHook(() =>
      useRoomEntryController({
        room: createRoom(),
        link: testLink.link,
        authUserId: 'host-user',
        isAuthLoading: false,
        onExit: jest.fn(),
      }),
    );

    await waitFor(() =>
      expect(mockHandleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ label: '加入房间' }),
      ),
    );
  });

  it('reports recent-room persistence failure without undoing a successful entry', async () => {
    mockAddRecentRoom.mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const { link } = createLink();
    const { result } = renderHook(() =>
      useRoomEntryController({
        room: createRoom(),
        link,
        authUserId: 'host-user',
        isAuthLoading: false,
        onExit: jest.fn(),
      }),
    );

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(mockHandleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ label: '记录最近房间' }),
    );
  });

  it('exposes the link status and forwards retry-now to the link', () => {
    const room = createRoom();
    const identity = { room, userId: 'host-user' };
    const testLink = createLink(readySnapshot(identity));
    const { result } = renderHook(() =>
      useRoomEntryController({
        room,
        link: testLink.link,
        authUserId: 'host-user',
        isAuthLoading: false,
        onExit: jest.fn(),
      }),
    );

    expect(testLink.connect).not.toHaveBeenCalled();
    expect(result.current.connection.status).toEqual({ kind: 'live' });

    act(() =>
      testLink.emit(
        readyLinkSnapshot<TestState>(identity, roomSnapshotFor(identity), {
          status: { kind: 'waiting', cause: 'backoff', attempt: 2, nextRetryAtMs: 5_000 },
          pendingDurableCount: 1,
        }),
      ),
    );
    expect(result.current.connection.pendingDurableCount).toBe(1);
    act(() => result.current.connection.onRetryNow());
    expect(testLink.retryNow).toHaveBeenCalledTimes(1);
  });
});
