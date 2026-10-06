import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { RoomAlertConfig } from '@/features/room/components/RoomAlertContext';
import { useRoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import {
  rejectedRoomCommand,
  successfulRoomCommand,
  testRoomState,
} from '@/test-utils/roomCommand';

const mockShowRoomAlert = jest.fn<void, [RoomAlertConfig]>();
jest.mock('@/features/room/components/RoomAlertContext', () => ({
  useRoomAlert: () => ({
    showRoomAlert: mockShowRoomAlert,
    clearRoomAlert: jest.fn(),
  }),
  useOptionalRoomAlert: () => null,
}));
const state = testRoomState('werewolf');

function createSuccess(): Promise<RoomCommandDispatchOutcome<typeof state>> {
  return Promise.resolve(successfulRoomCommand(state, 'seat-success'));
}

describe('useRoomSeatController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps take and move as distinct intents while using one atomic take command', async () => {
    const takeSeat = jest.fn(createSuccess);
    const { result, rerender } = renderHook(
      ({ currentSeat }: { currentSeat: number | null }) =>
        useRoomSeatController({ currentSeat, takeSeat }),
      { initialProps: { currentSeat: null } },
    );

    act(() => result.current.requestTakeSeat(2));
    expect(result.current.pendingAction).toEqual({ kind: 'take', toSeat: 2 });
    await act(async () => result.current.confirm());
    expect(takeSeat).toHaveBeenLastCalledWith(2);

    rerender({ currentSeat: 2 });
    act(() => result.current.requestMoveSeat(5));
    expect(result.current.pendingAction).toEqual({ kind: 'move', fromSeat: 2, toSeat: 5 });
    await act(async () => result.current.confirm());
    expect(takeSeat).toHaveBeenLastCalledWith(5);
  });

  it('fails fast for impossible seat intents', async () => {
    const takeSeat = jest.fn(createSuccess);
    const { result } = renderHook(() => useRoomSeatController({ currentSeat: null, takeSeat }));

    expect(() => result.current.requestMoveSeat(1)).toThrow('while unseated');
    await expect(result.current.confirm()).rejects.toThrow('while controller is idle');
  });

  it('closes the modal and reports an authoritative rejection', async () => {
    const takeSeat = jest.fn(async () =>
      rejectedRoomCommand<typeof state>('seat_taken', 'seat-command-1'),
    );
    const { result } = renderHook(() => useRoomSeatController({ currentSeat: null, takeSeat }));

    act(() => result.current.requestTakeSeat(4));
    await act(async () => result.current.confirm());
    await waitFor(() => expect(result.current.pendingAction).toBeNull());
    expect(mockShowRoomAlert).toHaveBeenCalledTimes(1);
    const config = mockShowRoomAlert.mock.calls[0]![0];
    expect(config.title).toBe('入座失败');
    expect(config.message).toBe('5号座位已被占用，请选择其他位置。');
    expect(config.buttons).toHaveLength(1);
    expect(config.buttons[0]?.text).toBe('确定');
  });
});
