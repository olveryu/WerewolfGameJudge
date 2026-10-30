/** Standard seat bindings and setup composition use real controllers with a typed test session. */

import type { RoomSeatCommand } from '@game-judge/game-engine/platform/protocol/commands';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';
import { type QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import type { User } from '@/contexts/AuthContext';
import { useRoomSetupController } from '@/features/room/controllers/useRoomSetupController';
import { useStandardSeatCommands } from '@/features/room/controllers/useStandardSeatCommands';
import type { RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type { DispatchOptions, LinkSnapshot } from '@/platform/realtime/types';
import { readyLinkSnapshot } from '@/test-utils/linkSnapshot';
import { rejectedRoomCommand, successfulRoomCommand } from '@/test-utils/roomCommand';

type TestState = BaseGameState<'werewolf'>;

const state: TestState = {
  gameType: 'werewolf',
  stateVersion: 1,
  roomCode: '1234',
  hostUserId: 'user-1',
};

const user: User = {
  id: 'user-1',
  email: 'alice@example.com',
  displayName: 'Alice',
  avatarUrl: 'https://example.com/alice.png',
  customAvatarUrl: null,
  avatarFrame: null,
  seatFlair: null,
  nameStyle: null,
  equippedEffect: null,
  seatAnimation: null,
  isAnonymous: false,
};

function createReadySnapshot(userId = 'user-1'): LinkSnapshot<TestState> {
  return readyLinkSnapshot<TestState>(
    {
      room: {
        roomCode: '1234',
        roomId: 'room-id',
        gameType: 'werewolf',
        hostUserId: 'user-1',
        createdAt: new Date('2026-07-15T00:00:00.000Z'),
      },
      userId,
    },
    { gameType: 'werewolf', stateVersion: 1, revision: 1, state },
  );
}

const cachedStats = { xp: 120, level: 7, gamesPlayed: 3, unlockedItems: [] };

// The jest automock for @tanstack/react-query has no working cache:
// useQueryClient is a jest.fn whose return value each test installs here,
// with getQueryData as the only surface createSeatProfile reads.
function installQueryClient(stats: unknown): QueryClient {
  const queryClient = {
    getQueryData: jest.fn().mockReturnValue(stats),
  } as unknown as QueryClient;
  (useQueryClient as unknown as jest.Mock).mockReturnValue(queryClient);
  return queryClient;
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useRoomSetupController', () => {
  it('binds capabilities to real controllers and recalculates them when the game leaves setup', async () => {
    const queryClient = installQueryClient(cachedStats);
    const dispatch = jest.fn(
      async (_command: RoomSeatCommand<RoomSeatProfile>, _options: DispatchOptions) =>
        successfulRoomCommand(state, 'setup-command'),
    );
    const session = { getSnapshot: () => createReadySnapshot(), dispatch };
    const configureGame = jest.fn();
    const shareRoom = jest.fn();
    const { result, rerender } = renderHook(
      ({ isSetup, mySeat }: { isSetup: boolean; mySeat: number | null }) =>
        useRoomSetupController({
          session,
          user,
          isSetup,
          mySeat,
          isHost: true,
          supportsBots: true,
          hasOccupiedSeats: true,
          isRoomFull: false,
          configureGame,
          shareRoom,
        }),
      { initialProps: { isSetup: true, mySeat: null }, wrapper: createWrapper(queryClient) },
    );
    const takeSeat = result.current.capabilities.canTakeSeat;
    if (!takeSeat.isAllowed) throw new Error('Expected take-seat capability in setup');
    act(() => takeSeat.execute(2));
    expect(result.current.seatController.pendingAction).toEqual({ kind: 'take', toSeat: 2 });
    expect(dispatch).not.toHaveBeenCalled();
    await act(async () => result.current.seatController.confirm());
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'room.seat.take', seat: 2 }),
      { controlledSeat: null, label: '入座', durable: false },
    );

    const target: RoomProfileTarget = {
      seat: 1,
      occupant: { kind: 'human', userId: 'user-2' },
      rosterName: 'Bob',
    };
    const viewProfile = result.current.capabilities.canViewProfiles;
    if (!viewProfile.isAllowed) throw new Error('Expected profile capability in setup');
    act(() => viewProfile.execute(target));
    expect(result.current.profile.selection).toEqual({ target, isSelf: false });
    act(() => result.current.profile.close());

    for (const capability of [
      result.current.capabilities.canConfigureGame,
      result.current.capabilities.canShareRoom,
    ]) {
      if (!capability.isAllowed) throw new Error('Expected navigation capability in setup');
      capability.execute();
    }
    expect(configureGame).toHaveBeenCalledTimes(1);
    expect(shareRoom).toHaveBeenCalledTimes(1);

    rerender({ isSetup: false, mySeat: 2 });
    expect(result.current.capabilities.canTakeSeat.isAllowed).toBe(false);
    expect(result.current.capabilities.canMoveSeat.isAllowed).toBe(false);
    expect(result.current.capabilities.canViewProfiles.isAllowed).toBe(false);
    expect(result.current.capabilities.canClearSeats.isAllowed).toBe(false);
    expect(result.current.capabilities.canFillBots.isAllowed).toBe(false);
  });
});

describe('useStandardSeatCommands', () => {
  it('binds the shared controller to the user profile built from the room identity', async () => {
    const queryClient = installQueryClient(cachedStats);
    const dispatch = jest.fn(
      async (_command: RoomSeatCommand<RoomSeatProfile>, _options: DispatchOptions) =>
        rejectedRoomCommand<TestState>('test-rejection', 'command-id'),
    );
    const session = { getSnapshot: () => createReadySnapshot(), dispatch };
    const { result } = renderHook(() => useStandardSeatCommands(session, user), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.takeSeat(3);
      await result.current.leaveSeat();
      await result.current.kickSeat(2);
      await result.current.clearSeats();
      await result.current.fillBots();
    });

    expect(dispatch.mock.calls).toEqual([
      [
        {
          type: 'room.seat.take',
          seat: 3,
          profile: {
            displayName: 'Alice',
            avatarUrl: 'https://example.com/alice.png',
            level: 7,
          },
        },
        { controlledSeat: null, label: '入座', durable: false },
      ],
      [{ type: 'room.seat.leave' }, { controlledSeat: null, label: '离座', durable: false }],
      [
        { type: 'room.seat.kick', seat: 2 },
        { controlledSeat: null, label: '请离玩家', durable: false },
      ],
      [{ type: 'room.seat.clear' }, { controlledSeat: null, label: '清空座位', durable: false }],
      [
        { type: 'room.seat.fillBots' },
        { controlledSeat: null, label: '填充机器人', durable: false },
      ],
    ]);
  });

  it('falls back to the anonymous profile without a stats level for anonymous users', async () => {
    const queryClient = installQueryClient(cachedStats);
    const anonymousUser: User = { ...user, displayName: null, isAnonymous: true };
    const dispatch = jest.fn(
      async (_command: RoomSeatCommand<RoomSeatProfile>, _options: DispatchOptions) =>
        rejectedRoomCommand<TestState>('test-rejection', 'command-id'),
    );
    const session = { getSnapshot: () => createReadySnapshot(), dispatch };
    const { result } = renderHook(() => useStandardSeatCommands(session, anonymousUser), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.takeSeat(1);
    });

    expect(dispatch.mock.calls).toEqual([
      [
        {
          type: 'room.seat.take',
          seat: 1,
          profile: { displayName: '匿名玩家', avatarUrl: 'https://example.com/alice.png' },
        },
        { controlledSeat: null, label: '入座', durable: false },
      ],
    ]);
  });

  it('fails fast when the authenticated user does not match the room identity', () => {
    const queryClient = installQueryClient(undefined);
    const session = {
      getSnapshot: () => createReadySnapshot('another-user'),
      dispatch: jest.fn(),
    };

    expect(() =>
      renderHook(() => useStandardSeatCommands(session, user), {
        wrapper: createWrapper(queryClient),
      }),
    ).toThrow('Auth profile does not match the active room identity');
  });
});
