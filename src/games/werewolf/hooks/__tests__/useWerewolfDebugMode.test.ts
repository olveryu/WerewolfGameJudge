import { act, renderHook } from '@testing-library/react-native';

import { useWerewolfDebugMode } from '@/games/werewolf/hooks/useWerewolfDebugMode';
import type {
  WerewolfCommandDispatchOutcome,
  WerewolfGameClient,
} from '@/games/werewolf/runtime/WerewolfGameClient';
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

function renderDebugMode(options?: {
  readonly client?: WerewolfGameClient;
  readonly seatCommands?: ReturnType<typeof createSeatCommands>;
}) {
  const client = options?.client ?? createMockClient();
  const seatCommands = options?.seatCommands ?? createSeatCommands();
  const hook = renderHook(() => useWerewolfDebugMode(client, seatCommands.fillBots));
  return { ...hook, client, seatCommands };
}

describe('useWerewolfDebugMode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fills empty seats without removing the seated host', async () => {
    const { result, seatCommands } = renderDebugMode();

    await act(async () => {
      await result.current.fillWithBots();
    });

    expect(seatCommands.fillBots).toHaveBeenCalledTimes(1);
  });

  it('fills bots directly when the host is not seated', async () => {
    const { result, seatCommands } = renderDebugMode();

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
