import { act, renderHook } from '@testing-library/react-native';
import { GameStatus } from '@werewolf/game-engine/werewolf/models/GameStatus';

import { getRoomLifecycleCapabilities } from '@/components/room/policy/roomLifecycle';
import { ConnectionStatus } from '@/services/room/ConnectionStatus';

import type { RoomConnectionLifecycleFacade } from '../useRoomConnectionLifecycle';
import { useRoomShellController } from '../useRoomShellController';

interface TestState {
  hostUserId: string;
  numberOfPlayers: number;
  seats: Record<number, { userId: string } | undefined>;
}

interface TestUser {
  id: string;
  displayName: string;
}

interface TestProfile {
  displayName: string;
}

const copy = {
  authRequiredTitle: '入座失败',
  authRequiredMessage: '请先登录',
  enterFailureTitle: '入座失败',
  leaveFailureTitle: '离座失败',
  kickFailureTitle: '移出失败',
  clearSeatsConfirmTitle: '清空所有座位?',
  clearSeatsConfirmText: '清空',
  clearSeatsFailureTitle: '清空失败',
  fillBotsConfirmTitle: '填充机器人?',
  fillBotsConfirmMessage: '将用机器人填满空座位',
  fillBotsConfirmText: '填充',
  fillBotsFailureTitle: '填充失败',
  exitConfirmTitle: '退出房间?',
  exitConfirmMessage: '本局进行中',
  exitConfirmText: '退出',
  invalidBotTargetTitle: '无法接管',
  invalidBotTargetMessage: '只能接管机器人座位',
} as const;

function createFacade(state: TestState): RoomConnectionLifecycleFacade<TestState> {
  return {
    subscribe: () => () => {},
    getState: () => state,
    connect: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    manualReconnect: jest.fn(),
    addConnectionStatusListener: (fn) => {
      fn(ConnectionStatus.Live);
      return () => {};
    },
  };
}

function renderController(state: TestState) {
  const sit = jest.fn().mockResolvedValue({ success: true });
  const leaveSeat = jest.fn().mockResolvedValue({ success: true });
  const facade = createFacade(state);
  const user: TestUser = { id: 'u1', displayName: '玩家1' };

  const rendered = renderHook(() =>
    useRoomShellController<TestState, TestUser, TestProfile, Record<string, never>>({
      facade,
      roomCode: '1234',
      gameName: '测试游戏',
      user,
      myUserId: user.id,
      initialHost: true,
      bottomContext: {},
      copy,
      operations: {
        toRosterProfile: (input) => ({ displayName: input.displayName }),
        sit,
        leaveSeat,
        kick: jest.fn().mockResolvedValue({ success: true }),
        clearSeats: jest.fn().mockResolvedValue({ success: true }),
        fillBots: jest.fn().mockResolvedValue({ success: true }),
      },
      runAction: async (fn) => (await fn()).success,
      onBack: jest.fn(),
      onConnectError: jest.fn(),
      onLeaveError: jest.fn(),
      getHostUserId: (input) => input.hostUserId,
      getPlayerCount: (input) => input.numberOfPlayers,
      countSeatedPlayers: (input) =>
        Object.values(input.seats).filter((seat) => seat !== undefined).length,
      getSeatByUserId: (input, userId) => {
        if (!userId) return null;
        for (const [seat, occupant] of Object.entries(input.seats)) {
          if (occupant?.userId === userId) return Number(seat);
        }
        return null;
      },
      getSeatOccupantUserId: (input, seat) => input.seats[seat]?.userId ?? null,
      getDisplayName: (_input, seat, userId) => (userId === 'u1' ? '玩家1' : `玩家${seat + 1}`),
      hasBots: () => false,
      isBotSeat: () => false,
      getLifecycle: ({ isHost }) => ({
        status: GameStatus.Unseated,
        capabilities: getRoomLifecycleCapabilities({
          status: GameStatus.Unseated,
          isHost,
        }),
      }),
      createSeatViewModels: (input, mySeat) =>
        Array.from({ length: input.numberOfPlayers }, (_, seat) => ({
          seat,
          player: input.seats[seat]
            ? {
                userId: input.seats[seat].userId,
                displayName: `玩家${seat + 1}`,
              }
            : null,
          isMySpot: seat === mySeat,
        })),
      createHeaderActionItems: () => [],
      createHeaderOperationItems: () => [],
      createBottomLayout: () => ({ primary: [], secondary: [], ghost: [] }),
    }),
  );

  return { ...rendered, sit, leaveSeat };
}

describe('useRoomShellController', () => {
  it('opens self profile and routes self leave through seat operation confirmation', () => {
    const { result } = renderController({
      hostUserId: 'u1',
      numberOfPlayers: 2,
      seats: {
        0: { userId: 'u1' },
      },
    });

    act(() => result.current.onSeatPress(0));

    expect(result.current.profile.target).toMatchObject({
      seat: 0,
      userId: 'u1',
      isSelf: true,
    });

    act(() => result.current.profile.handleLeaveSeat(0));

    expect(result.current.seatOperation).toEqual({ kind: 'leave', seat: 0 });
  });

  it('opens move operation for empty seats and runs adapter sit action on confirm', async () => {
    const { result, sit } = renderController({
      hostUserId: 'u1',
      numberOfPlayers: 2,
      seats: {
        0: { userId: 'u1' },
      },
    });

    act(() => result.current.onSeatPress(1));

    expect(result.current.seatOperation).toEqual({ kind: 'move', seat: 1 });

    await act(async () => {
      await result.current.confirmOperation();
    });

    expect(sit).toHaveBeenCalledWith(1, { displayName: '玩家1' });
    expect(result.current.seatOperation).toBeNull();
  });
});
