import { act, renderHook } from '@testing-library/react-native';

import { useWerewolfDebugMode } from '@/games/werewolf/hooks/useWerewolfDebugMode';
import type {
  WerewolfCommandDispatchOutcome,
  WerewolfGameClient,
} from '@/games/werewolf/runtime/WerewolfGameClient';
import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

const state = buildWerewolfTestState();

function createMockClient(): WerewolfGameClient {
  return {
    markAllBotsViewed: jest
      .fn<Promise<WerewolfCommandDispatchOutcome>, []>()
      .mockResolvedValue(success()),
    markAllBotsGroupConfirmed: jest
      .fn<Promise<WerewolfCommandDispatchOutcome>, []>()
      .mockResolvedValue(success()),
  } as unknown as WerewolfGameClient;
}

function success(): WerewolfCommandDispatchOutcome {
  return successfulRoomCommand(state);
}

function createSeatCommands(overrides?: {
  readonly fillBots?: () => Promise<WerewolfCommandDispatchOutcome>;
}) {
  return {
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
  readonly client?: WerewolfGameClient;
  readonly mySeat?: number | null;
  readonly gameState?: LocalGameState;
  readonly seatCommands?: ReturnType<typeof createSeatCommands>;
}) {
  const client = options?.client ?? createMockClient();
  const seatCommands = options?.seatCommands ?? createSeatCommands();
  const hook = renderHook(() =>
    useWerewolfDebugMode(
      client,
      options?.mySeat === undefined ? 1 : options.mySeat,
      options?.gameState === undefined ? makeGameState() : options.gameState,
      seatCommands.fillBots,
    ),
  );
  return { ...hook, client, seatCommands };
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

  it('fills empty seats without removing the seated host', async () => {
    const { result, seatCommands } = renderDebugMode({ mySeat: 1 });

    await act(async () => {
      await result.current.fillWithBots();
    });

    expect(seatCommands.fillBots).toHaveBeenCalledTimes(1);
  });

  it('fills bots directly when the host is not seated', async () => {
    const { result, seatCommands } = renderDebugMode({ mySeat: null });

    await act(async () => {
      await result.current.fillWithBots();
    });

    expect(seatCommands.fillBots).toHaveBeenCalledTimes(1);
  });

  it('propagates an unexpected fill exception', async () => {
    const seatCommands = createSeatCommands({
      fillBots: async () => {
        throw new Error('fill failed');
      },
    });
    const { result } = renderDebugMode({ seatCommands });

    await expect(result.current.fillWithBots()).rejects.toThrow('fill failed');
    expect(seatCommands.fillBots).toHaveBeenCalledTimes(1);
  });

  it('delegates Werewolf bot progression commands to the client', async () => {
    const client = createMockClient();
    const { result } = renderDebugMode({ client });

    await result.current.markAllBotsViewed();
    await result.current.markAllBotsGroupConfirmed();

    expect(client.markAllBotsViewed).toHaveBeenCalledTimes(1);
    expect(client.markAllBotsGroupConfirmed).toHaveBeenCalledTimes(1);
  });
});
