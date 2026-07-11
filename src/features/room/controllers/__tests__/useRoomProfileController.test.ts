import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useRoomProfileController } from '@/features/room/controllers/useRoomProfileController';
import type { RoomOperationResult } from '@/features/room/model/RoomCapabilities';

const otherPlayer = {
  seat: 4,
  userId: 'user-other',
  occupantKind: 'human' as const,
  rosterName: '其他玩家',
};

describe('useRoomProfileController', () => {
  it('derives self identity from userId and routes self leave through seat confirmation', () => {
    const requestLeaveSeat = jest.fn();
    const { result } = renderHook(() =>
      useRoomProfileController({
        myUserId: 'user-self',
        kickSeat: async (): Promise<RoomOperationResult> => ({ success: true }),
      }),
    );

    act(() =>
      result.current.open({
        seat: 7,
        userId: 'user-self',
        occupantKind: 'human',
        rosterName: '本人',
      }),
    );
    expect(result.current.selection?.isSelf).toBe(true);

    act(() => result.current.requestSelfLeave(requestLeaveSeat));
    expect(result.current.selection).toBeNull();
    expect(requestLeaveSeat).toHaveBeenCalledTimes(1);
  });

  it('directly kicks the selected target without a confirmation branch', async () => {
    const kickSeat = jest.fn(async (): Promise<RoomOperationResult> => ({ success: true }));
    const { result } = renderHook(() =>
      useRoomProfileController({ myUserId: 'user-self', kickSeat }),
    );

    act(() => result.current.open(otherPlayer));
    act(() => result.current.kick(otherPlayer.seat));

    expect(result.current.selection).toBeNull();
    await waitFor(() => expect(kickSeat).toHaveBeenCalledWith(otherPlayer.seat));
  });

  it('fails fast when an action does not match the selected profile', () => {
    const { result } = renderHook(() =>
      useRoomProfileController({
        myUserId: 'user-self',
        kickSeat: async (): Promise<RoomOperationResult> => ({ success: true }),
      }),
    );

    act(() => result.current.open(otherPlayer));
    expect(() => result.current.kick(2)).toThrow('does not match kick seat');
    expect(() => result.current.requestSelfLeave(jest.fn())).toThrow('is not the current user');
  });
});
