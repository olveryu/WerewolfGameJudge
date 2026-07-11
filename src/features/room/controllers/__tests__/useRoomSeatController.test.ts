import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useRoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import type { RoomOperationResult } from '@/features/room/model/RoomCapabilities';
import { showAlert } from '@/utils/alert';

jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

const mockShowAlert = showAlert as jest.MockedFunction<typeof showAlert>;

function createSuccess(): Promise<RoomOperationResult> {
  return Promise.resolve({ success: true });
}

describe('useRoomSeatController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps take and move as distinct intents while using one atomic take command', async () => {
    const takeSeat = jest.fn(createSuccess);
    const leaveSeat = jest.fn(createSuccess);
    const { result, rerender } = renderHook(
      ({ currentSeat }: { currentSeat: number | null }) =>
        useRoomSeatController({ currentSeat, takeSeat, leaveSeat }),
      { initialProps: { currentSeat: null } },
    );

    act(() => result.current.requestTakeSeat(2));
    expect(result.current.pendingAction).toEqual({ kind: 'take', toSeat: 2 });
    await act(async () => result.current.confirm());
    expect(takeSeat).toHaveBeenLastCalledWith(2);
    expect(leaveSeat).not.toHaveBeenCalled();

    rerender({ currentSeat: 2 });
    act(() => result.current.requestMoveSeat(5));
    expect(result.current.pendingAction).toEqual({ kind: 'move', fromSeat: 2, toSeat: 5 });
    await act(async () => result.current.confirm());
    expect(takeSeat).toHaveBeenLastCalledWith(5);
    expect(leaveSeat).not.toHaveBeenCalled();
  });

  it('confirms leave through the leave command', async () => {
    const takeSeat = jest.fn(createSuccess);
    const leaveSeat = jest.fn(createSuccess);
    const { result } = renderHook(() =>
      useRoomSeatController({ currentSeat: 3, takeSeat, leaveSeat }),
    );

    act(() => result.current.requestLeaveSeat());
    expect(result.current.pendingAction).toEqual({ kind: 'leave', fromSeat: 3 });
    await act(async () => result.current.confirm());
    expect(leaveSeat).toHaveBeenCalledTimes(1);
    expect(takeSeat).not.toHaveBeenCalled();
  });

  it('fails fast for impossible seat intents', async () => {
    const takeSeat = jest.fn(createSuccess);
    const leaveSeat = jest.fn(createSuccess);
    const { result } = renderHook(() =>
      useRoomSeatController({ currentSeat: null, takeSeat, leaveSeat }),
    );

    expect(() => result.current.requestMoveSeat(1)).toThrow('while unseated');
    expect(() => result.current.requestLeaveSeat()).toThrow('while unseated');
    await expect(result.current.confirm()).rejects.toThrow('while controller is idle');
  });

  it('closes the modal and reports an authoritative rejection', async () => {
    const takeSeat = jest.fn(
      async (): Promise<RoomOperationResult> => ({
        success: false,
        failureKind: 'rejected',
        commandId: 'seat-command-1',
        reason: 'seat_taken',
      }),
    );
    const { result } = renderHook(() =>
      useRoomSeatController({ currentSeat: null, takeSeat, leaveSeat: createSuccess }),
    );

    act(() => result.current.requestTakeSeat(4));
    await act(async () => result.current.confirm());
    await waitFor(() => expect(result.current.pendingAction).toBeNull());
    expect(mockShowAlert).toHaveBeenCalledWith('入座失败', '5号座位已被占用，请选择其他位置。');
  });
});
