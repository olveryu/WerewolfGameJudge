import { act, renderHook } from '@testing-library/react-native';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';

import type { RoomOperationResult } from '@/features/room/model/RoomCapabilities';
import { useWerewolfDebugMode } from '@/games/werewolf/hooks/useWerewolfDebugMode';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';

function createMockFacade(): WerewolfGameClient {
  return {
    markAllBotsViewed: jest.fn<Promise<ActionResult>, []>().mockResolvedValue({ success: true }),
    markAllBotsGroupConfirmed: jest
      .fn<Promise<ActionResult>, []>()
      .mockResolvedValue({ success: true }),
  } as unknown as WerewolfGameClient;
}

function success(): RoomOperationResult {
  return { success: true };
}

function createSeatCommands(overrides?: {
  readonly leaveSeat?: () => Promise<RoomOperationResult>;
  readonly fillBots?: () => Promise<RoomOperationResult>;
}) {
  return {
    leaveSeat: jest.fn(overrides?.leaveSeat ?? (async () => success())),
    fillBots: jest.fn(overrides?.fillBots ?? (async () => success())),
  };
}

function makeGameState(
  overrides: Partial<Pick<LocalGameState, 'players' | 'debugMode'>> = {},
): LocalGameState {
  const players = new Map<number, LocalPlayer | null>();
  players.set(1, {
    userId: 'u1',
    seat: 1,
    role: 'wolf',
    hasViewedRole: false,
  });
  players.set(2, {
    userId: 'u2',
    seat: 2,
    role: 'seer',
    hasViewedRole: false,
  });
  return {
    players,
    debugMode: { botsEnabled: false },
    ...overrides,
  } as unknown as LocalGameState;
}

function renderDebugMode(options?: {
  readonly facade?: WerewolfGameClient;
  readonly mySeat?: number | null;
  readonly gameState?: LocalGameState;
  readonly seatCommands?: ReturnType<typeof createSeatCommands>;
}) {
  const facade = options?.facade ?? createMockFacade();
  const seatCommands = options?.seatCommands ?? createSeatCommands();
  const hook = renderHook(() =>
    useWerewolfDebugMode(
      facade,
      options?.mySeat === undefined ? 1 : options.mySeat,
      options?.gameState === undefined ? makeGameState() : options.gameState,
      seatCommands.leaveSeat,
      seatCommands.fillBots,
    ),
  );
  return { ...hook, facade, seatCommands };
}

describe('useWerewolfDebugMode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('derives the effective seat and role from the active identity', () => {
    const { result } = renderDebugMode();

    expect(result.current.effectiveSeat).toBe(1);
    expect(result.current.effectiveRole).toBe('wolf');
  });

  it('uses the controlled bot seat and role after takeover', () => {
    const { result } = renderDebugMode();

    act(() => result.current.takeOverBot(2));

    expect(result.current.effectiveSeat).toBe(2);
    expect(result.current.effectiveRole).toBe('seer');
  });

  it('returns null role when the effective seat is absent', () => {
    const { result } = renderDebugMode({ mySeat: 99 });

    expect(result.current.effectiveRole).toBeNull();
  });

  it('reflects the authoritative botsEnabled flag', () => {
    const gameState = makeGameState({ debugMode: { botsEnabled: true } });
    const { result } = renderDebugMode({ gameState });

    expect(result.current.isDebugMode).toBe(true);
  });

  it('leaves the host seat before filling every empty seat with bots', async () => {
    const { result, seatCommands } = renderDebugMode({ mySeat: 1 });

    await act(async () => {
      await result.current.fillWithBots();
    });

    expect(seatCommands.leaveSeat).toHaveBeenCalledTimes(1);
    expect(seatCommands.fillBots).toHaveBeenCalledTimes(1);
  });

  it('fills bots directly when the host is not seated', async () => {
    const { result, seatCommands } = renderDebugMode({ mySeat: null });

    await act(async () => {
      await result.current.fillWithBots();
    });

    expect(seatCommands.leaveSeat).not.toHaveBeenCalled();
    expect(seatCommands.fillBots).toHaveBeenCalledTimes(1);
  });

  it('does not fill bots when leave-seat is rejected', async () => {
    const rejection: RoomOperationResult = {
      success: false,
      failureKind: 'rejected',
      commandId: 'leave-command',
      reason: 'game_in_progress',
    };
    const seatCommands = createSeatCommands({ leaveSeat: async () => rejection });
    const { result } = renderDebugMode({ seatCommands });

    await expect(result.current.fillWithBots()).resolves.toEqual(rejection);
    expect(seatCommands.fillBots).not.toHaveBeenCalled();
  });

  it('propagates an unexpected leave-seat exception', async () => {
    const seatCommands = createSeatCommands({
      leaveSeat: async () => {
        throw new Error('leave failed');
      },
    });
    const { result } = renderDebugMode({ seatCommands });

    await expect(result.current.fillWithBots()).rejects.toThrow('leave failed');
    expect(seatCommands.fillBots).not.toHaveBeenCalled();
  });

  it('delegates Werewolf bot progression commands to the facade', async () => {
    const facade = createMockFacade();
    const { result } = renderDebugMode({ facade });

    await result.current.markAllBotsViewed();
    await result.current.markAllBotsGroupConfirmed();

    expect(facade.markAllBotsViewed).toHaveBeenCalledTimes(1);
    expect(facade.markAllBotsGroupConfirmed).toHaveBeenCalledTimes(1);
  });
});
