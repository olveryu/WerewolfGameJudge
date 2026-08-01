import type { RoomSeatCommand } from '@game-judge/game-engine/platform/protocol/commands';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, renderHook } from '@testing-library/react-native';

import { useRoomSeatCommands } from '@/features/room/controllers/useRoomSeatCommands';
import type {
  RoomCommandDispatchOptions,
  RoomSessionSnapshot,
} from '@/features/room/session/types';
import { rejectedRoomCommand } from '@/test-utils/roomCommand';

type TestState = BaseGameState<'werewolf'>;
type TestProfile = { readonly displayName: string };

const state: TestState = {
  gameType: 'werewolf',
  stateVersion: 1,
  roomCode: '1234',
  hostUserId: 'user-1',
};

function createReadySnapshot(userId = 'user-1'): RoomSessionSnapshot<TestState> {
  return {
    phase: 'ready',
    epoch: 1,
    identity: {
      room: {
        roomCode: '1234',
        roomId: 'room-id',
        gameType: 'werewolf',
        hostUserId: 'user-1',
        createdAt: new Date('2026-07-15T00:00:00.000Z'),
      },
      userId,
    },
    connection: 'live',
    snapshot: { gameType: 'werewolf', stateVersion: 1, revision: 1, state },
    lastCommand: null,
    error: null,
  };
}

describe('useRoomSeatCommands', () => {
  it('dispatches every canonical seat command through one shared controller', async () => {
    const dispatch = jest.fn(
      async (_command: RoomSeatCommand<TestProfile>, _options: RoomCommandDispatchOptions) =>
        rejectedRoomCommand<TestState>('test-rejection', 'command-id'),
    );
    const createProfile = jest.fn(() => ({ displayName: 'Alice' }));
    const session = { getSnapshot: () => createReadySnapshot(), dispatch };
    const { result } = renderHook(() =>
      useRoomSeatCommands({ session, userId: 'user-1', createProfile }),
    );

    await act(async () => {
      await result.current.takeSeat(3);
      await result.current.leaveSeat();
      await result.current.kickSeat(2);
      await result.current.clearSeats();
      await result.current.fillBots();
    });

    expect(createProfile).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls).toEqual([
      [
        { type: 'room.seat.take', seat: 3, profile: { displayName: 'Alice' } },
        { controlledSeat: null, label: 'takeRoomSeat' },
      ],
      [{ type: 'room.seat.leave' }, { controlledSeat: null, label: 'leaveRoomSeat' }],
      [
        { type: 'room.seat.kick', seat: 2 },
        { controlledSeat: null, label: 'kickRoomSeat' },
      ],
      [{ type: 'room.seat.clear' }, { controlledSeat: null, label: 'clearRoomSeats' }],
      [{ type: 'room.seat.fillBots' }, { controlledSeat: null, label: 'fillRoomSeatsWithBots' }],
    ]);
  });

  it('fails fast before creating commands for an identity mismatch', () => {
    const session = {
      getSnapshot: () => createReadySnapshot('another-user'),
      dispatch: jest.fn(),
    };

    expect(() =>
      renderHook(() =>
        useRoomSeatCommands({
          session,
          userId: 'user-1',
          createProfile: () => ({ displayName: 'Alice' }),
        }),
      ),
    ).toThrow('Auth profile does not match the active room identity');
  });

  it('fails fast before creating commands when the room session is not ready', () => {
    const idleSnapshot: RoomSessionSnapshot<TestState> = {
      phase: 'idle',
      epoch: 0,
      identity: null,
      connection: 'disconnected',
      snapshot: null,
      lastCommand: null,
      error: null,
    };
    const session = { getSnapshot: () => idleSnapshot, dispatch: jest.fn() };

    expect(() =>
      renderHook(() =>
        useRoomSeatCommands({
          session,
          userId: 'user-1',
          createProfile: () => ({ displayName: 'Alice' }),
        }),
      ),
    ).toThrow('Room seat commands require a ready room session');
  });
});
