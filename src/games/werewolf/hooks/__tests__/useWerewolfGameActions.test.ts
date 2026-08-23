/**
 * useWerewolfGameActions — unit tests for game control & player night actions hook.
 *
 * Verifies client delegation, non-host guards, notifyIfFailed alerting,
 * and derived state queries (getLastNightInfo, hasWolfVoted).
 */

import type { WerewolfActionInput } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react-native';

import type { WerewolfBgmControlState } from '@/games/werewolf/hooks/useWerewolfBgmControl';
import type { WerewolfDebugModeState } from '@/games/werewolf/hooks/useWerewolfDebugMode';
import { useWerewolfGameActions } from '@/games/werewolf/hooks/useWerewolfGameActions';
import type {
  WerewolfCommandDispatchOutcome,
  WerewolfGameClient,
} from '@/games/werewolf/runtime/WerewolfGameClient';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';
import { domainRejectedRoomCommand, successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

// Mock showAlert
const mockShowAlert = jest.fn<void, [string, string]>();
jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: (...args: unknown[]) => mockShowAlert(...(args as [string, string])),
}));

// Toast is mapped via moduleNameMapper → __mocks__/sonner-native.ts
import { toast } from 'sonner-native';

// ---- Factory helpers ----

type MutationResult = WerewolfCommandDispatchOutcome;
const protocolState = buildWerewolfTestState();

function successfulCommand(commandId = 'test-command'): WerewolfCommandDispatchOutcome {
  return successfulRoomCommand(protocolState, commandId);
}

function domainRejected(
  reason: string,
  commandId = 'test-command',
): WerewolfCommandDispatchOutcome {
  return domainRejectedRoomCommand(protocolState, reason, commandId);
}

function deliveryUnknown(
  reason: string,
  commandId = 'test-command',
): WerewolfCommandDispatchOutcome {
  return { kind: 'deliveryUnknown', commandId, reason };
}

function notDecided(reason: string, commandId = 'test-command'): WerewolfCommandDispatchOutcome {
  return { kind: 'notDecided', commandId, reason };
}

type MockClient = {
  [K in keyof WerewolfGameClient]: jest.Mock;
};

function createMockClient(overrides: Partial<MockClient> = {}): MockClient {
  return {
    updateTemplate: jest
      .fn<Promise<MutationResult>, [unknown]>()
      .mockResolvedValue(successfulCommand()),
    assignRoles: jest.fn<Promise<MutationResult>, []>().mockResolvedValue(successfulCommand()),
    startNight: jest.fn<Promise<MutationResult>, []>().mockResolvedValue(successfulCommand()),
    restartGame: jest.fn<Promise<MutationResult>, []>().mockResolvedValue(successfulCommand()),
    shareNightReview: jest
      .fn<Promise<MutationResult>, [number[]]>()
      .mockResolvedValue(successfulCommand()),
    markViewedRole: jest
      .fn<Promise<MutationResult>, [number | null]>()
      .mockResolvedValue(successfulCommand()),
    submitAction: jest
      .fn<Promise<MutationResult>, [WerewolfActionInput, number | null]>()
      .mockResolvedValue(successfulCommand()),
    submitRevealAck: jest
      .fn<Promise<MutationResult>, [number | null]>()
      .mockResolvedValue(successfulCommand()),
    submitGroupConfirmAck: jest
      .fn<Promise<MutationResult>, [number | null]>()
      .mockResolvedValue(successfulCommand()),
    sendWolfRobotHunterStatusViewed: jest
      .fn<Promise<MutationResult>, [number | null]>()
      .mockResolvedValue(successfulCommand()),
    postProgression: jest.fn<Promise<MutationResult>, []>().mockResolvedValue(successfulCommand()),
    ...overrides,
  } as MockClient;
}

function createMockBgm(): Pick<WerewolfBgmControlState, 'startBgmIfEnabled' | 'stopBgm'> {
  return { startBgmIfEnabled: jest.fn(), stopBgm: jest.fn() };
}

interface MockDebugOverrides {
  controlledSeat?: number | null;
  effectiveSeat?: number | null;
  effectiveRole?: string | null;
  releaseBot?: jest.Mock;
}

function createMockDebug(
  overrides: MockDebugOverrides = {},
): Pick<
  WerewolfDebugModeState,
  'controlledSeat' | 'effectiveSeat' | 'effectiveRole' | 'releaseBot'
> {
  return {
    controlledSeat: null,
    effectiveSeat: 1,
    effectiveRole: 'wolf',
    releaseBot: jest.fn(),
    ...overrides,
  } as Pick<
    WerewolfDebugModeState,
    'controlledSeat' | 'effectiveSeat' | 'effectiveRole' | 'releaseBot'
  >;
}

type WerewolfGameActionsDeps = Parameters<typeof useWerewolfGameActions>[0];

interface MockDepsOverrides {
  client?: MockClient;
  bgm?: Pick<WerewolfBgmControlState, 'startBgmIfEnabled' | 'stopBgm'>;
  debug?: Pick<
    WerewolfDebugModeState,
    'controlledSeat' | 'effectiveSeat' | 'effectiveRole' | 'releaseBot'
  >;
  isHost?: boolean;
  mySeat?: number | null;
  gameState?: Partial<LocalGameState>;
  clearSeats?: () => Promise<WerewolfCommandDispatchOutcome>;
}

function createDeps(overrides: MockDepsOverrides = {}): WerewolfGameActionsDeps {
  const { gameState, ...rest } = overrides;
  return {
    client: createMockClient(),
    bgm: createMockBgm(),
    debug: createMockDebug(),
    isHost: true,
    mySeat: 1,
    gameState: {
      lastNightDeaths: [],
      wolfVotes: new Map(),
      currentNightResults: {},
      template: { roles: [] },
    } as unknown as LocalGameState,
    clearSeats: jest.fn(async () => successfulCommand()),
    ...rest,
    ...(gameState !== undefined && { gameState: gameState as LocalGameState }),
  } as unknown as WerewolfGameActionsDeps;
}

// ---- Tests ----

describe('useWerewolfGameActions - game control', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updateTemplate should call client.updateTemplate', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.updateTemplate({ name: '', numberOfPlayers: 0, roles: [] }));

    expect(deps.client.updateTemplate).toHaveBeenCalledWith({
      name: '',
      numberOfPlayers: 0,
      roles: [],
    });
  });

  it('updateTemplate should skip when not host', async () => {
    const deps = createDeps({ isHost: false });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.updateTemplate({ name: '', numberOfPlayers: 0, roles: [] }));

    expect(deps.client.updateTemplate).not.toHaveBeenCalled();
  });

  it('assignRoles should call client and toast on failure', async () => {
    const client = createMockClient({
      assignRoles: jest.fn().mockResolvedValue(domainRejected('role_count_mismatch')),
    });
    const deps = createDeps({ client });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.assignRoles());

    expect(mockShowAlert).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('分配角色失败', {
      description: '角色数量与座位数不匹配',
    });
  });

  it('assignRoles should NOT alert on success', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.assignRoles());

    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it('startGame should call client.startNight (BGM driven by gameStatus effect)', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.startGame());

    expect(deps.client.startNight).toHaveBeenCalled();
    // BGM is no longer started imperatively here — useWerewolfBgmControl's reactive
    // effect starts BGM when gameStatus transitions to Ongoing.
    expect(deps.bgm.startBgmIfEnabled).not.toHaveBeenCalled();
  });

  it('restartGame should stop BGM, clear debug seat, and call client', async () => {
    const deps = createDeps({ debug: createMockDebug({ controlledSeat: 2 }) });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.restartGame());

    expect(deps.bgm.stopBgm).toHaveBeenCalled();
    expect(deps.debug.releaseBot).toHaveBeenCalledTimes(1);
    expect(deps.client.restartGame).toHaveBeenCalled();
  });

  it('clearAllSeats should call the shared seat command', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.clearAllSeats());

    expect(deps.clearSeats).toHaveBeenCalled();
  });

  it('shareNightReview should call client with allowedSeats', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.shareNightReview([1, 3, 5]));

    expect(deps.client.shareNightReview).toHaveBeenCalledWith([1, 3, 5]);
  });

  it('postProgression should return true on success for host', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.postProgression();
    });

    expect(deps.client.postProgression).toHaveBeenCalled();
    expect(ok).toBe(true);
  });

  it('postProgression should return false on failure for host', async () => {
    const deps = createDeps({
      client: createMockClient({
        postProgression: jest.fn().mockResolvedValue(deliveryUnknown('NETWORK_ERROR')),
      }),
    });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.postProgression();
    });

    expect(deps.client.postProgression).toHaveBeenCalled();
    expect(ok).toBe(false);
  });

  it('postProgression should return false for non-host', async () => {
    const deps = createDeps({ isHost: false });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.postProgression();
    });

    expect(deps.client.postProgression).not.toHaveBeenCalled();
    expect(ok).toBe(false);
  });
});

describe('useWerewolfGameActions - player night actions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('viewedRole should use mySeat when no controlled seat', async () => {
    const deps = createDeps({ mySeat: 3 });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.viewedRole());

    expect(deps.client.markViewedRole).toHaveBeenCalledWith(null);
  });

  it('viewedRole should use debug.controlledSeat when set', async () => {
    const deps = createDeps({ debug: createMockDebug({ controlledSeat: 5 }) });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.viewedRole());

    expect(deps.client.markViewedRole).toHaveBeenCalledWith(5);
  });

  it('viewedRole fails fast when both seats are null', async () => {
    const deps = createDeps({
      mySeat: null,
      debug: createMockDebug({ controlledSeat: null }),
    });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await expect(result.current.viewedRole()).rejects.toThrow(
      '[FAIL-FAST] Viewing a Werewolf role requires an effective seat',
    );

    expect(deps.client.markViewedRole).not.toHaveBeenCalled();
  });

  it('submitAction should send typed input and null controlledSeat for self', async () => {
    const deps = createDeps({
      debug: createMockDebug({ effectiveSeat: 2, effectiveRole: 'seer' }),
    });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.submitAction({ kind: 'target', target: 4 }));

    expect(deps.client.submitAction).toHaveBeenCalledWith({ kind: 'target', target: 4 }, null);
  });

  it('submitAction fails fast when effectiveSeat is null', async () => {
    const deps = createDeps({ debug: createMockDebug({ effectiveSeat: null }) });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await expect(result.current.submitAction({ kind: 'target', target: 4 })).rejects.toThrow(
      '[FAIL-FAST] Submitting a Werewolf action requires an effective seat',
    );

    expect(deps.client.submitAction).not.toHaveBeenCalled();
  });

  it('submitRevealAck should call client', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.submitRevealAck());

    expect(deps.client.submitRevealAck).toHaveBeenCalledWith(null);
  });

  it('reveal and group-confirm acks pass the controlled bot seat', async () => {
    const deps = createDeps({
      debug: createMockDebug({ controlledSeat: 6, effectiveSeat: 6 }),
    });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.submitRevealAck());
    await act(() => result.current.submitGroupConfirmAck());

    expect(deps.client.submitRevealAck).toHaveBeenCalledWith(6);
    expect(deps.client.submitGroupConfirmAck).toHaveBeenCalledWith(6);
  });

  it('sendWolfRobotHunterStatusViewed should pass controlledSeat from debug state', async () => {
    const deps = createDeps({ debug: createMockDebug({ controlledSeat: 7, effectiveSeat: 7 }) });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.sendWolfRobotHunterStatusViewed());

    expect(deps.client.sendWolfRobotHunterStatusViewed).toHaveBeenCalledWith(7);
  });
});

describe('useWerewolfGameActions - game state queries', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getLastNightInfo should return "昨夜平安夜" when no deaths', () => {
    const deps = createDeps({
      gameState: { lastNightDeaths: [], wolfVotes: new Map(), currentNightResults: {} },
    });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    expect(result.current.getLastNightInfo()).toBe('昨夜平安夜');
  });

  it('getLastNightInfo should format death list (0-indexed → 1-indexed)', () => {
    const deps = createDeps({
      gameState: {
        lastNightDeaths: [0, 2, 5],
        wolfVotes: new Map(),
        currentNightResults: {},
      },
    });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    expect(result.current.getLastNightInfo()).toBe('昨夜死亡: 1号, 3号, 6号');
  });

  it('getLastNightInfo should include silencedSeat info', () => {
    const deps = createDeps({
      gameState: {
        lastNightDeaths: [],
        wolfVotes: new Map(),
        currentNightResults: { silencedSeat: 2 },
      },
    });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    expect(result.current.getLastNightInfo()).toBe('昨夜平安夜\n3号被禁言');
  });

  it('getLastNightInfo should include votebannedSeat info', () => {
    const deps = createDeps({
      gameState: {
        lastNightDeaths: [],
        wolfVotes: new Map(),
        currentNightResults: { votebannedSeat: 4 },
      },
    });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    expect(result.current.getLastNightInfo()).toBe('昨夜平安夜\n5号被禁票');
  });

  it('getLastNightInfo should include both silence and voteban with deaths', () => {
    const deps = createDeps({
      gameState: {
        lastNightDeaths: [0],
        wolfVotes: new Map(),
        currentNightResults: { silencedSeat: 1, votebannedSeat: 3 },
      },
    });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    expect(result.current.getLastNightInfo()).toBe('昨夜死亡: 1号\n2号被禁言\n4号被禁票');
  });

  it('hasWolfVoted should check wolfVotes map', () => {
    const wolfVotes = new Map([[3, 5]]);
    const deps = createDeps({
      gameState: { lastNightDeaths: [], wolfVotes, currentNightResults: {} },
    });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    expect(result.current.hasWolfVoted(3)).toBe(true);
    expect(result.current.hasWolfVoted(1)).toBe(false);
  });
});

describe('useWerewolfGameActions - handleCommandOutcome', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a shared seat-command rejection without duplicating presentation', async () => {
    const rejection = domainRejected('invalid_status', 'clear-command');
    const clearSeats = jest.fn(async (): Promise<WerewolfCommandDispatchOutcome> => rejection);
    const deps = createDeps({ clearSeats });
    const { result } = renderHook(() => useWerewolfGameActions(deps));
    let clearResult: WerewolfCommandDispatchOutcome | null = null;

    await act(async () => {
      clearResult = await result.current.clearAllSeats();
    });

    expect(clearResult).toEqual(rejection);
    expect(mockShowAlert).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('keeps a recoverable action pending without presenting network uncertainty as failure', async () => {
    const client = createMockClient({
      submitAction: jest.fn().mockResolvedValue(deliveryUnknown('NETWORK_ERROR')),
    });
    const deps = createDeps({
      client,
      debug: createMockDebug({ effectiveSeat: 1, effectiveRole: 'wolf' }),
    });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.submitAction({ kind: 'target', target: 2 }));

    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it('keeps a recoverable action pending when the server outcome is unknown', async () => {
    const client = createMockClient({
      submitAction: jest.fn().mockResolvedValue(deliveryUnknown('SERVER_ERROR')),
    });
    const deps = createDeps({
      client,
      debug: createMockDebug({ effectiveSeat: 1, effectiveRole: 'wolf' }),
    });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.submitAction({ kind: 'target', target: 2 }));

    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it('presents definitive non-delivery so the player can retry the action', async () => {
    const client = createMockClient({
      submitAction: jest.fn().mockResolvedValue(notDecided('no_state')),
    });
    const deps = createDeps({
      client,
      debug: createMockDebug({ effectiveSeat: 1, effectiveRole: 'wolf' }),
    });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.submitAction({ kind: 'target', target: 2 }));

    expect(mockShowAlert).toHaveBeenCalledWith('提交行动失败', '服务暂时不可用，请稍后重试');
  });

  it('should NOT alert on business rejection without onBusinessError callback', async () => {
    const client = createMockClient({
      submitAction: jest.fn().mockResolvedValue(domainRejected('invalid_action')),
    });
    const deps = createDeps({
      client,
      debug: createMockDebug({ effectiveSeat: 1, effectiveRole: 'wolf' }),
    });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.submitAction({ kind: 'target', target: 2 }));

    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it('should show toast on business rejection with toastError callback (submitRevealAck)', async () => {
    const client = createMockClient({
      submitRevealAck: jest.fn().mockResolvedValue(domainRejected('forbidden_while_audio_playing')),
    });
    const deps = createDeps({ client });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.submitRevealAck());

    expect(mockShowAlert).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('确认揭示失败', {
      description: '请等待语音播放完毕',
    });
  });

  it('should alert on NETWORK_ERROR even with toastError callback', async () => {
    const client = createMockClient({
      submitRevealAck: jest.fn().mockResolvedValue(deliveryUnknown('NETWORK_ERROR')),
    });
    const deps = createDeps({ client });
    const { result } = renderHook(() => useWerewolfGameActions(deps));

    await act(() => result.current.submitRevealAck());

    expect(mockShowAlert).toHaveBeenCalledWith('确认揭示失败', '网络异常，请检查网络后重试');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
