import type { RoomSeatCommand } from '@game-judge/game-engine/platform/protocol/commands';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';
import { type QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import type { User } from '@/contexts/AuthContext';
import { useStandardSeatCommands } from '@/features/room/controllers/useStandardSeatCommands';
import type {
  RoomCommandDispatchOptions,
  RoomSessionSnapshot,
} from '@/features/room/session/types';
import { rejectedRoomCommand } from '@/test-utils/roomCommand';

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
    pendingCommandCount: 0,
    lastRecoveredCommandRejection: null,
    snapshot: { gameType: 'werewolf', stateVersion: 1, revision: 1, state },
    lastCommand: null,
    error: null,
  };
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

describe('useStandardSeatCommands', () => {
  it('binds the shared controller to the user profile built from the room identity', async () => {
    const queryClient = installQueryClient(cachedStats);
    const dispatch = jest.fn(
      async (_command: RoomSeatCommand<RoomSeatProfile>, _options: RoomCommandDispatchOptions) =>
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

  it('falls back to the anonymous profile without a stats level for anonymous users', async () => {
    const queryClient = installQueryClient(cachedStats);
    const anonymousUser: User = { ...user, displayName: null, isAnonymous: true };
    const dispatch = jest.fn(
      async (_command: RoomSeatCommand<RoomSeatProfile>, _options: RoomCommandDispatchOptions) =>
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
        { controlledSeat: null, label: 'takeRoomSeat' },
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
