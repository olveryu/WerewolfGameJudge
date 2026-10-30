import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useRoomProfileController } from '@/features/room/controllers/useRoomProfileController';
import type { RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import { successfulRoomCommand, testRoomState } from '@/test-utils/roomCommand';

const state = testRoomState('werewolf');

const otherPlayer: RoomProfileTarget = {
  seat: 4,
  occupant: { kind: 'human', userId: 'user-other' },
  rosterName: '其他玩家',
};

describe('useRoomProfileController', () => {
  it('derives self identity and submits profile leave directly without confirmation', async () => {
    const leaveSeat = jest.fn(async () => successfulRoomCommand(state, 'leave-self'));
    const { result } = renderHook(() =>
      useRoomProfileController({
        myUserId: 'user-self',
        kickSeat: async () => successfulRoomCommand(state, 'kick-self-unused'),
        leaveSeat,
      }),
    );

    act(() =>
      result.current.open({
        seat: 7,
        occupant: { kind: 'human', userId: 'user-self' },
        rosterName: '本人',
      }),
    );
    expect(result.current.selection?.isSelf).toBe(true);

    act(() => result.current.leaveSelf());
    expect(result.current.selection).toBeNull();
    await waitFor(() => expect(leaveSeat).toHaveBeenCalledTimes(1));
  });

  it('directly kicks the selected target without a confirmation branch', async () => {
    const kickSeat = jest.fn(async () => successfulRoomCommand(state, 'kick-other'));
    const { result } = renderHook(() =>
      useRoomProfileController({
        myUserId: 'user-self',
        kickSeat,
        leaveSeat: async () => successfulRoomCommand(state, 'leave-other-unused'),
      }),
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
        kickSeat: async () => successfulRoomCommand(state, 'kick-mismatch-unused'),
        leaveSeat: async () => successfulRoomCommand(state, 'leave-mismatch-unused'),
      }),
    );

    act(() => result.current.open(otherPlayer));
    expect(() => result.current.kick(2)).toThrow('does not match kick seat');
    expect(() => result.current.leaveSelf()).toThrow('is not the current user');
  });
});
