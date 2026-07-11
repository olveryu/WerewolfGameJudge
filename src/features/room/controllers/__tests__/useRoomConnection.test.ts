import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useRoomConnection } from '@/features/room/controllers/useRoomConnection';
import type { RoomEntryResult } from '@/features/room/model/RoomConnection';
import type { RoomRecord } from '@/services/types/IRoomService';
import { showAlert } from '@/utils/alert';

jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(() => true),
}));

const mockShowAlert = showAlert as jest.MockedFunction<typeof showAlert>;

const room: RoomRecord = {
  roomCode: '1234',
  roomId: 'room-id-1234',
  gameType: 'werewolf',
  hostUserId: 'host-user',
  createdAt: new Date('2026-07-10T12:00:00.000Z'),
};

const connection = {
  status: 'live' as const,
  onManualReconnect: jest.fn(),
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useRoomConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enters an already resolved room and exposes the normalized connection model', async () => {
    const enterRoom = jest.fn(async (): Promise<RoomEntryResult> => ({ success: true }));
    const { result } = renderHook(() =>
      useRoomConnection({
        room,
        enterRoom,
        disconnect: jest.fn(),
        hasRoomState: true,
        connection,
        onExit: jest.fn(),
      }),
    );

    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    expect(enterRoom).toHaveBeenCalledWith(room);
    expect(result.current.connection).toBe(connection);
  });

  it('ignores a superseded attempt after retry owns the connection generation', async () => {
    const first = deferred<RoomEntryResult>();
    const second = deferred<RoomEntryResult>();
    const enterRoom = jest
      .fn<Promise<RoomEntryResult>, [RoomRecord]>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() =>
      useRoomConnection({
        room,
        enterRoom,
        disconnect: jest.fn(),
        hasRoomState: false,
        connection,
        onExit: jest.fn(),
      }),
    );

    act(() => result.current.retry());
    await waitFor(() => expect(enterRoom).toHaveBeenCalledTimes(2));
    await act(async () => second.resolve({ success: true }));
    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    await act(async () => first.resolve({ success: false, error: 'superseded' }));
    expect(result.current.isInitialized).toBe(true);
  });

  it('confirms exit, disconnects, then leaves the room screen', async () => {
    const disconnect = jest.fn(async () => undefined);
    const onExit = jest.fn();
    const enterRoom = jest.fn(async (): Promise<RoomEntryResult> => ({ success: true }));
    const { result } = renderHook(() =>
      useRoomConnection({
        room,
        enterRoom,
        disconnect,
        hasRoomState: true,
        connection,
        onExit,
      }),
    );
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    act(() => result.current.requestExit(true));
    const buttons = mockShowAlert.mock.calls[0]?.[2];
    const confirm = buttons?.find((button) => button.text === '确定');
    const onConfirm = confirm?.onPress;
    if (!onConfirm) throw new Error('Expected room exit confirmation callback');
    await act(async () => onConfirm());

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
